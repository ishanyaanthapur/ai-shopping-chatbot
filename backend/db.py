"""Shared read-only DB access helpers for the product catalogue.

Both the REST endpoints in main.py and the chat agent's tools in tools.py
need to query the same catalogue/inventory tables and shape rows the same
way, so that logic lives here once instead of being duplicated.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "campus_customs.db"
# Prefer the white-background copies made by scripts/clean_product_images.py
# (most originals have the background baked in as solid black); fall back to
# the untouched originals if that script hasn't been run.
_CLEAN_IMAGES_DIR = DATA_DIR / "products_clean"
IMAGES_DIR = _CLEAN_IMAGES_DIR if _CLEAN_IMAGES_DIR.is_dir() else DATA_DIR / "products"


def get_connection() -> sqlite3.Connection:
    """Read-only connection to the catalogue/inventory tables."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def image_filename(image_file_path: str) -> str:
    """Strip a leading 'products/' (or any directory) so we're left with
    just the filename, matching how /images is mounted."""
    return Path(image_file_path).name


def row_to_product(row: sqlite3.Row) -> dict:
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "search_tags": json.loads(row["search_tags"]),
        "image_url": f"/images/{image_filename(row['image_file_path'])}",
        "price": row["price"],
    }


def _search_terms(query: str) -> list[str]:
    """Break a free-text query into per-word LIKE terms, adding a naive
    singular form for plurals (e.g. "hoodies" -> also try "hoodie") since
    the catalogue text is mostly written in the singular."""
    terms: set[str] = set()
    for word in query.strip().lower().split():
        word = word.strip(".,!?")
        if not word:
            continue
        terms.add(word)
        if word.endswith("ies") and len(word) > 3:
            terms.add(word[:-3] + "y")
        if word.endswith("s") and len(word) > 3:
            terms.add(word[:-1])
    return sorted(terms) or [query.strip().lower()]


def search_catalogue(query: str, limit: int = 5) -> list[dict]:
    """Keyword search over name/garment_type/description/search_tags.

    Matches if ANY search term (the query's words, plus naive singular
    forms) appears in any of those columns, so plural/singular phrasing
    ("hoodies" vs "hoodie") and multi-word queries ("yale hoodie") both
    work rather than requiring the whole query string as one substring.
    """
    conn = get_connection()
    try:
        terms = _search_terms(query)
        clause = " OR ".join(
            "(name LIKE ? OR garment_type LIKE ? OR description LIKE ? OR search_tags LIKE ?)"
            for _ in terms
        )
        params: list[str] = []
        for term in terms:
            like = f"%{term}%"
            params.extend([like, like, like, like])
        rows = conn.execute(
            f"""
            SELECT * FROM catalogue
            WHERE {clause}
            ORDER BY name
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
        return [row_to_product(row) for row in rows]
    finally:
        conn.close()


def get_total_stock(product_id: str) -> int:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory WHERE product_id = ?",
            (product_id,),
        ).fetchone()
        return int(row["total"]) if row is not None else 0
    finally:
        conn.close()


def get_product_by_id(product_id: str) -> dict | None:
    """A single catalogue row (description/price/colors/etc.), or None if
    the product_id doesn't exist."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?",
            (product_id,),
        ).fetchone()
        return row_to_product(row) if row is not None else None
    finally:
        conn.close()


def get_stock_by_size(product_id: str) -> list[dict]:
    """Per-size stock rows for a product, e.g. [{"size": "M", "quantity": 5}, ...].

    Empty list means the product_id has no inventory rows at all (either it
    doesn't exist, or it genuinely has no sizes on file)."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY id",
            (product_id,),
        ).fetchall()
        return [{"size": row["size"], "quantity": row["quantity"]} for row in rows]
    finally:
        conn.close()


# --- Chat history (per logged-in user) ------------------------------------
#
# Only ever written/read for a specific user_id, so one account's history
# can never surface in another account's conversation (or a guest's, since
# guests have no user_id to key by in the first place).


def save_chat_message(
    user_id: int, role: str, content: str, products_json: str | None = None
) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            INSERT INTO chat_messages (user_id, role, content, products_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, role, content, products_json, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


# --- Support inquiries (live agent handoff) -------------------------------
#
# Written when the chat agent can't answer and the shopper hands off to a
# human. Kept in the same SQLite file so an outage leaves behind a real,
# queryable lead instead of a customer who silently gave up.


def ensure_support_inquiries_table() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS support_inquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_support_inquiry(
    name: str,
    email: str,
    message: str,
    user_id: int | None = None,
    reason: str | None = None,
) -> str:
    """Store one inquiry and return a customer-facing reference number."""
    ensure_support_inquiries_table()
    created_at = datetime.now(timezone.utc)
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.execute(
            """
            INSERT INTO support_inquiries (user_id, name, email, message, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, name, email, message, reason, created_at.isoformat()),
        )
        conn.commit()
        inquiry_id = cursor.lastrowid
    finally:
        conn.close()
    return f"CC-{created_at:%Y%m%d}-{inquiry_id:04d}"


def get_chat_history(user_id: int, limit: int = 40) -> list[dict]:
    """This user's past messages, oldest first, capped at `limit` most
    recent rows so a long-running account doesn't balloon every prompt."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT role, content, products_json FROM chat_messages
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
        rows = list(reversed(rows))
        return [
            {
                "role": row["role"],
                "content": row["content"],
                "products_json": row["products_json"],
            }
            for row in rows
        ]
    finally:
        conn.close()
