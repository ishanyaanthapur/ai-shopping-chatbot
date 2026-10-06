"""Tools the shopping-assistant agent can call.

Queries reuse the shared DB helpers in db.py rather than duplicating the
SQL that main.py's REST endpoints already use.

Every tool is wrapped in `_guarded`: if the database itself fails, the tool
raises ToolUnavailableError instead of a raw sqlite3 error, so /api/chat
can stop the run with a clear "tool_error" reason (in the audit trail) and
hand the shopper to a human, rather than the model improvising an answer.
A product that simply doesn't exist is *not* an error — those tools return
None / an empty list, which the prompt tells the agent to report honestly.
"""

import functools
import sqlite3

from db import (
    get_product_by_id,
    get_stock_by_size as db_get_stock_by_size,
    get_total_stock,
    search_catalogue,
)
from models import ProductDetails, ProductSummary, SizeStock, StockLookup

# Cap on how many products one search can hand the model (and the page).
SEARCH_RESULT_LIMIT = 5


class ToolUnavailableError(RuntimeError):
    """A tool couldn't reach its data source, so the run can't be grounded."""

    def __init__(self, tool_name: str):
        super().__init__(f"{tool_name} could not reach the product database")
        self.tool_name = tool_name


def _guarded(fn):
    # functools.wraps keeps the name, docstring and type hints, which
    # PydanticAI reads to build each tool's schema for the model.
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except sqlite3.Error as exc:
            raise ToolUnavailableError(fn.__name__) from exc

    return wrapper


@_guarded

def search_products(query: str) -> list[ProductSummary]:
    """Search the real Campus Customs catalogue for products matching a query.

    Args:
        query: Free-text search terms, e.g. "yale hoodie", "crewneck", "Berkeley".

    Returns:
        Up to 5 matching products with real name/price/description/stock info,
        pulled live from the database. An empty list means nothing matched.
    """
    rows = search_catalogue(query, limit=SEARCH_RESULT_LIMIT)
    results: list[ProductSummary] = []
    for row in rows:
        total_stock = get_total_stock(row["product_id"])
        results.append(
            ProductSummary(
                product_id=row["product_id"],
                name=row["name"],
                garment_type=row["garment_type"],
                description=row["description"],
                price=row["price"],
                image_url=row["image_url"],
                in_stock=total_stock > 0,
            )
        )
    return results


@_guarded
def get_product_details(product_id: str) -> ProductDetails | None:
    """Look up the real description, price, and colors for one specific product.

    Use this once you know which exact product the shopper is asking about
    (e.g. after `search_products` found it, or they gave you its product_id/
    name directly) and they want more detail — "how much is it", "what does
    it look like", "what colors does it come in".

    Args:
        product_id: The exact catalogue product_id, e.g. "basic-hoodie-big-yale".

    Returns:
        The product's real description/price/colors, or None if that
        product_id doesn't exist in the catalogue.
    """
    row = get_product_by_id(product_id)
    if row is None:
        return None
    return ProductDetails(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        description=row["description"],
        price=row["price"],
        colors=row["colors"],
        image_url=row["image_url"],
    )


@_guarded
def get_stock_by_size(product_id: str) -> StockLookup | None:
    """Look up real, live stock counts for every size of one specific product.

    Use this whenever a shopper asks about availability, stock, or a
    specific size ("do you have this in medium", "is this in stock", "what
    sizes are left") — never guess or estimate stock, always call this.

    Args:
        product_id: The exact catalogue product_id, e.g. "basic-hoodie-big-yale".

    Returns:
        Per-size quantities (each size flagged in_stock if quantity > 0) and
        a total across all sizes, or None if that product_id doesn't exist
        or has no inventory rows on file.
    """
    product = get_product_by_id(product_id)
    rows = db_get_stock_by_size(product_id)
    if product is None or not rows:
        return None
    sizes = [
        SizeStock(size=row["size"], quantity=row["quantity"], in_stock=row["quantity"] > 0)
        for row in rows
    ]
    return StockLookup(
        product_id=product_id,
        name=product["name"],
        sizes=sizes,
        total_in_stock=sum(s.quantity for s in sizes),
    )
