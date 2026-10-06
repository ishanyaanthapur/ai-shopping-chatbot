"""Append-only audit trail of every shopping-agent run.

Each call to POST /api/chat appends one entry to output/audit_trail.json
describing what the agent loop actually did: which tools it called with
what arguments, a short summary of what each returned, how many model
requests it took, and why the run stopped (a final answer, a loop limit,
a timeout, or an error).

The file is a single JSON array so it stays valid JSON at all times.
Appending reads the existing array, adds one entry and atomically replaces
the file (write to a temp file, then os.replace), so a crash mid-write can't
leave a half-written file behind and earlier entries are never rewritten.
If the existing file is somehow not valid JSON, it's moved aside rather than
overwritten, so history is never silently lost.

Privacy: entries record only whether the shopper was a guest or logged in —
never their name, email, user id or password — and the shopper's message is
truncated with email addresses and long digit runs redacted.
"""

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    ToolCallPart,
    ToolReturnPart,
)

AUDIT_PATH = Path(__file__).resolve().parents[1] / "output" / "audit_trail.json"

# PydanticAI delivers structured output through an internal tool call; it's
# the run's answer, not a tool the agent chose to use, so it isn't logged
# as a step.
OUTPUT_TOOL_NAMES = {"final_result"}

MAX_TEXT = 160
_EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
_LONG_DIGITS = re.compile(r"\d{7,}")
_SECRETISH = re.compile(r"\b(sk|pk|rk)[-_][A-Za-z0-9_-]{8,}")

_lock = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def redact(text: str, limit: int = MAX_TEXT) -> str:
    """Strip things that look like personal data or credentials, then truncate."""
    text = _EMAIL.sub("[email]", text)
    text = _SECRETISH.sub("[redacted]", text)
    text = _LONG_DIGITS.sub("[number]", text)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _summarize_args(part: ToolCallPart) -> str:
    try:
        args = part.args_as_dict()
    except Exception:
        return redact(str(part.args), 80)
    return ", ".join(f"{k}={redact(str(v), 60)!r}" for k, v in args.items())


def _summarize_result(tool_name: str, content: Any) -> str:
    """One line describing what a tool returned, specific to each tool."""
    if content is None:
        return {
            "get_product_details": "not found",
            "get_stock_by_size": "no inventory on file",
        }.get(tool_name, "None")

    if tool_name == "search_products" and isinstance(content, list):
        ids = [getattr(p, "product_id", None) or (p.get("product_id") if isinstance(p, dict) else "?") for p in content]
        return f"{len(ids)} result(s): " + ", ".join(ids) if ids else "0 results"

    if tool_name == "get_product_details":
        name = getattr(content, "name", None)
        price = getattr(content, "price", None)
        if name is not None:
            return f"{name} — ${price:.2f}"

    if tool_name == "get_stock_by_size":
        sizes = getattr(content, "sizes", None)
        if sizes is not None:
            per_size = ", ".join(f"{s.size}={s.quantity}" for s in sizes)
            return f"{per_size} (total {content.total_in_stock})"

    if isinstance(content, BaseModel):
        content = content.model_dump()
    return redact(json.dumps(content, default=str) if not isinstance(content, str) else content, 120)


def summarize_steps(messages: list[ModelMessage]) -> tuple[list[dict], int]:
    """Turn this run's messages into ordered tool steps, plus the number of
    model requests (responses) the loop made."""
    steps: list[dict] = []
    by_call_id: dict[str, dict] = {}
    model_requests = 0

    for message in messages:
        if isinstance(message, ModelResponse):
            model_requests += 1
            for part in message.parts:
                if isinstance(part, ToolCallPart) and part.tool_name not in OUTPUT_TOOL_NAMES:
                    step = {
                        "at": message.timestamp.isoformat(timespec="milliseconds"),
                        "tool": part.tool_name,
                        "args": _summarize_args(part),
                        "result": "(no result — run stopped first)",
                    }
                    steps.append(step)
                    by_call_id[part.tool_call_id] = step
        elif isinstance(message, ModelRequest):
            for part in message.parts:
                if isinstance(part, ToolReturnPart) and part.tool_call_id in by_call_id:
                    by_call_id[part.tool_call_id]["result"] = _summarize_result(
                        part.tool_name, part.content
                    )
                elif isinstance(part, RetryPromptPart) and part.tool_call_id in by_call_id:
                    by_call_id[part.tool_call_id]["result"] = "retry requested: " + redact(
                        part.model_response(), 100
                    )

    return steps, model_requests


def build_entry(
    *,
    started_at: str,
    started_monotonic: float,
    finished_monotonic: float,
    model: str,
    customer: str,
    current_product_id: str | None,
    user_message: str,
    messages: list[ModelMessage],
    stop_reason: str,
    stop_detail: str | None,
    reply_message: str,
    reply_product_ids: list[str],
    handoff: bool,
    limits: dict,
) -> dict:
    steps, model_requests = summarize_steps(messages)
    return {
        "run_id": uuid.uuid4().hex[:12],
        "started_at": started_at,
        "finished_at": now_iso(),
        "duration_ms": round((finished_monotonic - started_monotonic) * 1000),
        "endpoint": "POST /api/chat",
        "model": model,
        "customer": customer,
        "current_product_id": current_product_id,
        "user_message": redact(user_message),
        "steps": steps,
        "tool_calls": len(steps),
        "model_requests": model_requests,
        "limits": limits,
        "stop_reason": stop_reason,
        "stop_detail": stop_detail,
        "reply": redact(reply_message),
        "products_returned": reply_product_ids,
        "live_agent_handoff": handoff,
    }


def _load_existing() -> list:
    if not AUDIT_PATH.exists():
        return []
    try:
        data = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    # Never overwrite an unreadable trail — keep it for inspection.
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    os.replace(AUDIT_PATH, AUDIT_PATH.with_name(f"audit_trail.unreadable-{stamp}.json"))
    return []


def append_entry(entry: dict) -> None:
    """Append one entry, keeping the file a valid JSON array throughout."""
    with _lock:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        entries = _load_existing()
        entries.append(entry)
        tmp = AUDIT_PATH.with_name(AUDIT_PATH.name + ".tmp")
        tmp.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp, AUDIT_PATH)
