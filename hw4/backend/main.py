"""Campus Customs storefront API.

FastAPI app — run with: uvicorn main:app --reload --port 8000
(from hw4/backend, using its .venv).

Serves the product catalogue, per-product inventory and product images
from ../data/campus_customs.db, handles accounts and sessions, runs the
shopping-assistant agent (agent.py / tools.py) behind POST /api/chat with
an audit trail (audit.py), and takes live-agent support inquiries.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import re
import secrets
import sqlite3
import time
from datetime import datetime, timezone

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic_ai import capture_run_messages
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded
from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart

import audit
from agent import (
    MODEL_NAME,
    REQUEST_LIMIT,
    TOOL_CALLS_LIMIT,
    USAGE_LIMITS,
    ChatDeps,
    shopping_agent,
)
from db import (
    DB_PATH,
    IMAGES_DIR,
    get_chat_history,
    get_connection,
    image_filename,
    row_to_product,
    save_chat_message,
    save_support_inquiry,
)
from models import (
    LIVE_AGENT_EMAIL,
    LIVE_AGENT_NAME,
    ChatApiReply,
    ChatHistoryMessage,
    ChatRequest,
    LiveAgentHandoff,
    SupportInquiryReply,
    SupportInquiryRequest,
)
from tools import SEARCH_RESULT_LIMIT, ToolUnavailableError

app = FastAPI(title="Campus Customs API")

# Cookie-based sessions require a specific origin (not "*") when
# allow_credentials=True, so the frontend dev server is named explicitly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth: session store + password hashing -------------------------------
#
# In-memory session store: session token -> user id. Fine for this homework
# project (single backend process, no need for Redis/JWT/DB-backed sessions).
SESSIONS: dict[str, int] = {}
SESSION_COOKIE_NAME = "session_token"
PBKDF2_ITERATIONS = 120_000
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def hash_password(password: str, salt: str | None = None) -> str:
    """Return a 'pbkdf2_sha256$<salt>$<hex_digest>' formatted hash."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, hex_digest = stored_hash.split("$")
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(candidate, hex_digest)


def get_write_connection() -> sqlite3.Connection:
    """Read-write connection, used only by the auth endpoints below."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def public_user_fields(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
    }


def create_session(user_id: int, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = user_id
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        # secure=False because this runs on local http during development;
        # this should be secure=True behind HTTPS in production.
        secure=False,
        path="/",
    )


def get_current_user(session_token: str | None) -> sqlite3.Row | None:
    if not session_token or session_token not in SESSIONS:
        return None
    user_id = SESSIONS[session_token]
    conn = get_write_connection()
    try:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    finally:
        conn.close()


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    email: str
    password: str

# Serve product images. image_file_path in the DB looks like
# "products/basic-hoodie-big-yale.jpg" — we mount the products/ folder
# directly at /images so the frontend can request
# http://localhost:8000/images/basic-hoodie-big-yale.jpg
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


@app.get("/api/products")
def list_products():
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        return [row_to_product(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")

        product = row_to_product(row)

        inventory_rows = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY id",
            (product_id,),
        ).fetchall()
        product["inventory"] = [
            {"size": r["size"], "quantity": r["quantity"]} for r in inventory_rows
        ]
        return product
    finally:
        conn.close()


@app.post("/api/auth/register")
def register(body: RegisterRequest, response: Response):
    first_name = body.first_name.strip()
    last_name = body.last_name.strip()
    email = body.email.strip()
    password = body.password
    confirm_password = body.confirm_password

    if not first_name or not last_name or not email or not password or not confirm_password:
        raise HTTPException(status_code=400, detail="All fields are required")
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    conn = get_write_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE lower(email) = lower(?)", (email,)
        ).fetchone()
        if existing is not None:
            raise HTTPException(
                status_code=400, detail="An account with this email already exists"
            )

        name = f"{first_name} {last_name}"
        password_hash = hash_password(password)
        created_at = datetime.now(timezone.utc).isoformat()

        cursor = conn.execute(
            """
            INSERT INTO users (name, email, password_hash, created_at, first_name, last_name)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, email, password_hash, created_at, first_name, last_name),
        )
        conn.commit()
        user_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    finally:
        conn.close()

    create_session(user_id, response)
    return public_user_fields(row)


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response):
    email = body.email.strip()
    password = body.password

    conn = get_write_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = lower(?)", (email,)
        ).fetchone()
    finally:
        conn.close()

    if row is None or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    create_session(row["id"], response)
    return public_user_fields(row)


@app.post("/api/auth/logout")
def logout(response: Response, session_token: str | None = Cookie(default=None)):
    if session_token and session_token in SESSIONS:
        del SESSIONS[session_token]
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}


@app.get("/api/auth/me")
def me(session_token: str | None = Cookie(default=None)):
    user = get_current_user(session_token)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return public_user_fields(user)


def _build_message_history(rows: list[dict]) -> list:
    """Turn stored (role, content) rows into the simple prior-turn objects
    PydanticAI expects for `message_history=`, so the model actually sees
    and uses earlier turns rather than just the frontend displaying them."""
    history = []
    for row in rows:
        if row["role"] == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=row["content"])]))
        else:
            history.append(ModelResponse(parts=[TextPart(content=row["content"])]))
    return history


# How long to wait on the model before giving up and handing the customer
# to a human. Long enough for a slow tool-using turn, short enough that a
# shopper isn't left staring at typing dots wondering if it's broken.
CHAT_TIMEOUT_SECONDS = 30.0

# Most recent saved turns replayed to the model for a returning customer.
CHAT_HISTORY_LIMIT = 40

logger = logging.getLogger("campus_customs")

HANDOFF_MESSAGES = {
    "timeout": (
        "I'm so sorry — I'm taking far too long to get you an answer, and I don't want to "
        "leave you waiting. Let me connect you to a real human on our team who can pick this "
        "up right away."
    ),
    "unavailable": (
        "I'm so sorry — I can't help you any further right now. I don't want to leave you "
        "stuck, so let me connect you to a real human on our team."
    ),
    "loop_limit": (
        "I'm so sorry — I wasn't able to finish looking that up, and I'd rather not guess. "
        "Let me connect you to a real human on our team who can check it properly."
    ),
    "tool_error": (
        "I'm so sorry — I can't reach our product records right now, so I can't confirm "
        "prices or stock. Let me connect you to a real human on our team."
    ),
}

# The model provider (Azure OpenAI behind Portkey) rejects some prompts
# outright — typically jailbreak / prompt-injection attempts — with HTTP 400
# and code "content_filter". That's a refusal, not an outage, so the shopper
# gets a polite decline instead of a live-agent handoff.
CONTENT_FILTER_MESSAGE = (
    "Sorry, I can't help with that request. I'm happy to help you find Campus Customs "
    "gear, though — ask me about products, prices, sizes or stock."
)


def _is_content_filter(exc: ModelHTTPError) -> bool:
    body = exc.body if isinstance(exc.body, dict) else {}
    return exc.status_code == 400 and body.get("code") == "content_filter"


AUDIT_LIMITS = {
    "request_limit": REQUEST_LIMIT,
    "tool_calls_limit": TOOL_CALLS_LIMIT,
    "timeout_seconds": CHAT_TIMEOUT_SECONDS,
    "search_result_limit": SEARCH_RESULT_LIMIT,
    "history_messages_limit": CHAT_HISTORY_LIMIT,
}


def _build_handoff(reason: str, body: ChatRequest, user: sqlite3.Row | None) -> LiveAgentHandoff:
    """Everything the chat widget needs to put a human in front of a stuck
    shopper without them retyping a single thing."""
    return LiveAgentHandoff(
        reason=reason,
        subject=f"Campus Customs help request: {body.message.strip()[:60]}",
        prefill_name=user["name"] if user is not None else None,
        prefill_email=user["email"] if user is not None else None,
        prefill_message=body.message.strip(),
    )


@app.post("/api/chat", response_model=ChatApiReply)
async def chat(body: ChatRequest, session_token: str | None = Cookie(default=None)) -> ChatApiReply:
    user = get_current_user(session_token)

    message_history = []
    if user is not None:
        message_history = _build_message_history(get_chat_history(user["id"], limit=CHAT_HISTORY_LIMIT))

    deps = ChatDeps(
        user_name=user["name"] if user is not None else None,
        user_email=user["email"] if user is not None else None,
        current_product_id=body.current_product_id,
    )

    # The model call is the one part of this request that routinely fails in
    # ways we don't control — timeouts, rate limits, exhausted API credit,
    # a runaway tool loop. A 500 here would surface to the shopper as a
    # dead-end error bubble, so instead every failure becomes a normal 200
    # reply that carries a handoff to a real person, and the reason is
    # recorded in the audit trail.
    started_at = audit.now_iso()
    started = time.monotonic()
    handoff: LiveAgentHandoff | None = None
    stop_reason, stop_detail = "final_answer", None
    with capture_run_messages() as run_messages:
        try:
            # asyncio.timeout (not wait_for) keeps the run in this task, so
            # capture_run_messages still sees every message after a timeout.
            async with asyncio.timeout(CHAT_TIMEOUT_SECONDS):
                result = await shopping_agent.run(
                    body.message,
                    message_history=message_history or None,
                    deps=deps,
                    usage_limits=USAGE_LIMITS,
                )
            reply = ChatApiReply(**result.output.model_dump())
        except TimeoutError:
            stop_reason = "timeout"
            stop_detail = f"no answer within {CHAT_TIMEOUT_SECONDS:g}s"
        except UsageLimitExceeded as exc:
            stop_reason, stop_detail = "loop_limit", audit.redact(str(exc), 120)
        except ToolUnavailableError as exc:
            stop_reason, stop_detail = "tool_error", f"{exc.tool_name} could not reach the database"
        except ModelHTTPError as exc:
            if _is_content_filter(exc):
                stop_reason, stop_detail = "content_filter", "provider content filter rejected the prompt"
            else:
                stop_reason, stop_detail = "model_error", f"ModelHTTPError {exc.status_code}"
        except Exception as exc:
            # Class name only: provider error text can echo request details.
            stop_reason, stop_detail = "model_error", type(exc).__name__

    if stop_reason == "content_filter":
        reply = ChatApiReply(message=CONTENT_FILTER_MESSAGE)
    elif stop_reason != "final_answer":
        handoff_key = stop_reason if stop_reason in HANDOFF_MESSAGES else "unavailable"
        handoff = _build_handoff(stop_reason, body, user)
        reply = ChatApiReply(message=HANDOFF_MESSAGES[handoff_key], handoff=handoff)

    # Only this run's messages — not the replayed history it started with.
    this_run = list(run_messages)[len(message_history):]
    try:
        audit.append_entry(
            audit.build_entry(
                started_at=started_at,
                started_monotonic=started,
                finished_monotonic=time.monotonic(),
                model=MODEL_NAME,
                customer="logged_in" if user is not None else "guest",
                current_product_id=body.current_product_id,
                user_message=body.message,
                messages=this_run,
                stop_reason=stop_reason,
                stop_detail=stop_detail,
                reply_message=reply.message,
                reply_product_ids=[p.id for p in reply.products or []],
                handoff=handoff is not None,
                limits=AUDIT_LIMITS,
            )
        )
    except OSError:
        # The audit trail must never break the shopper's chat.
        logger.exception("Could not append to the audit trail")

    # Only persisted for logged-in customers — guests can still chat, but
    # nothing about a guest conversation is written to the database, so
    # there's nothing to leak or restore for them later. Failed turns are
    # saved too, so a reloaded conversation still reads coherently instead
    # of showing a question that was never answered.
    if user is not None:
        save_chat_message(user["id"], "user", body.message)
        products_json = (
            json.dumps([p.model_dump() for p in reply.products]) if reply.products else None
        )
        save_chat_message(user["id"], "assistant", reply.message, products_json=products_json)

    return reply


@app.post("/api/support/inquiry", response_model=SupportInquiryReply)
def support_inquiry(
    body: SupportInquiryRequest, session_token: str | None = Cookie(default=None)
) -> SupportInquiryReply:
    """Catch a shopper the chat agent couldn't help.

    Deliberately forgiving about who can call it (guests included) — the
    whole point is that someone already hit one failure and shouldn't hit a
    second one on the way to a human.
    """
    name = body.name.strip()
    email = body.email.strip()
    message = body.message.strip()

    if not message:
        raise HTTPException(status_code=400, detail="Please tell us what you need help with.")
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(
            status_code=400, detail="Please enter a valid email so our team can reply."
        )

    user = get_current_user(session_token)
    reference = save_support_inquiry(
        name=name or "Campus Customs shopper",
        email=email,
        message=message,
        user_id=user["id"] if user is not None else None,
        reason="chat_handoff",
    )

    return SupportInquiryReply(
        reference=reference,
        message=(
            f"Thank you — I've passed this to our {LIVE_AGENT_NAME} at {LIVE_AGENT_EMAIL}. "
            f"Your reference number is {reference}, and you'll get a reply at {email} within "
            "one business day. Sorry again for the trouble!"
        ),
    )


@app.get("/api/chat/history", response_model=list[ChatHistoryMessage])
def chat_history(session_token: str | None = Cookie(default=None)) -> list[ChatHistoryMessage]:
    """A logged-in customer's saved conversation, oldest first, so the
    frontend can restore it on load. Guests (no valid session) always get
    an empty list — there's nothing stored for them to restore."""
    user = get_current_user(session_token)
    if user is None:
        return []

    rows = get_chat_history(user["id"])
    return [
        ChatHistoryMessage(
            role=row["role"],
            content=row["content"],
            products=_coerce_stored_products(row["products_json"]),
        )
        for row in rows
    ]


def _coerce_stored_products(raw: str | None) -> list[dict] | None:
    """Normalize a stored `products_json` cell into today's ProductCard
    shape (id/name/price/image_url/description).

    This table can contain rows saved by an earlier/different schema (this
    project's seed data includes 22 pre-existing demo conversation rows
    using an older, richer product shape), so this tolerates unknown/extra
    fields and skips anything it can't make sense of rather than erroring
    out the whole history endpoint over one old row."""
    if not raw:
        return None
    try:
        items = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(items, list):
        return None

    products: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        product_id = item.get("id") or item.get("product_id")
        name = item.get("name")
        price = item.get("price")
        description = item.get("description")
        image_path = item.get("image_url") or item.get("image_file_path")
        if not (product_id and name and isinstance(price, (int, float)) and description and image_path):
            continue
        products.append(
            {
                "id": product_id,
                "name": name,
                "price": price,
                # Re-derive from whatever path was stored, rather than trust
                # an old row's image_url prefix, so it resolves against this
                # backend's actual /images mount.
                "image_url": f"/images/{image_filename(image_path)}",
                "description": description,
            }
        )
    return products or None


@app.get("/")
def root():
    return {"status": "ok", "service": "campus-customs-api"}
