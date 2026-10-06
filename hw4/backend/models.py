"""Pydantic models shared by the chat agent and the /api/chat endpoint."""

from pydantic import BaseModel, Field


class ProductSummary(BaseModel):
    """What the search_products tool hands back to the agent."""

    product_id: str
    name: str
    garment_type: str
    description: str
    price: float
    image_url: str
    in_stock: bool


class ProductDetails(BaseModel):
    """What the get_product_details tool hands back: the description/price
    lookup for one specific, already-identified product."""

    product_id: str
    name: str
    garment_type: str
    description: str
    price: float
    colors: list[str]
    image_url: str


class SizeStock(BaseModel):
    """Stock for a single size of a single product."""

    size: str
    quantity: int
    in_stock: bool


class StockLookup(BaseModel):
    """What the get_stock_by_size tool hands back: every size Campus
    Customs carries for a product, with real per-size quantities."""

    product_id: str
    name: str
    sizes: list[SizeStock]
    total_in_stock: int


class ProductCard(BaseModel):
    """Lightweight product info the frontend chat widget can render as a chip."""

    id: str
    name: str
    price: float
    image_url: str
    description: str


class ChatReply(BaseModel):
    """Structured output the agent produces for every chat turn."""

    message: str = Field(description="The assistant's reply, in plain conversational text.")
    products: list[ProductCard] | None = Field(
        default=None,
        description="Real products (from search_products results) relevant to this reply, if any.",
    )


# --- Live agent handoff (graceful chat failure) ---------------------------
#
# The model call can time out or be rate-limited, and when it does the
# shopper should never hit a dead end. These types carry everything the chat
# widget needs to put a human in front of them with nothing left to retype.

LIVE_AGENT_NAME = "Campus Customs Live Agent"
LIVE_AGENT_EMAIL = "ishanya.anthapur@yale.edu"


class LiveAgentHandoff(BaseModel):
    """Attached to a chat reply when the agent couldn't answer, so the
    frontend can render a pre-filled 'talk to a human' card instead of a
    dead-end error bubble."""

    agent_name: str = LIVE_AGENT_NAME
    agent_email: str = LIVE_AGENT_EMAIL
    reason: str = Field(
        description=(
            "Why the agent stopped: 'timeout', 'loop_limit', 'tool_error' or 'model_error' "
            "(or 'unreachable', set by the frontend when the backend can't be reached)."
        )
    )
    subject: str = Field(description="Pre-filled subject line for the inquiry.")
    prefill_name: str | None = Field(
        default=None, description="Logged-in customer's name, if we know it."
    )
    prefill_email: str | None = Field(
        default=None, description="Logged-in customer's email, if we know it."
    )
    prefill_message: str = Field(
        description="Pre-filled body — the question the customer just asked."
    )


class SupportInquiryRequest(BaseModel):
    """What the shopper submits from the handoff card in the chat widget."""

    name: str
    email: str
    message: str


class SupportInquiryReply(BaseModel):
    """Confirmation for a submitted inquiry, including a reference number
    the shopper can quote so they leave the conversation holding something
    concrete rather than just hoping it went through."""

    reference: str
    agent_name: str = LIVE_AGENT_NAME
    agent_email: str = LIVE_AGENT_EMAIL
    message: str


class ChatApiReply(ChatReply):
    """What POST /api/chat actually returns.

    A superset of the agent's own structured output: `handoff` is populated
    by the endpoint, never by the model, so it's kept off `ChatReply` to
    avoid putting a field in the agent's output schema that it must never
    fill in itself.
    """

    handoff: LiveAgentHandoff | None = None


class ChatRequest(BaseModel):
    message: str
    current_product_id: str | None = Field(
        default=None,
        description="product_id of the product page the customer is currently viewing, if any.",
    )


class ChatHistoryMessage(BaseModel):
    """One stored turn, returned by GET /api/chat/history to restore a
    logged-in customer's conversation on page load."""

    role: str
    content: str
    products: list[ProductCard] | None = None
