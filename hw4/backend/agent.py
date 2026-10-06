"""Builds the Campus Customs shopping-assistant PydanticAI agent.

Model + provider wiring follows the repo's Portkey convention (see
AGENTS.md), adapted for PydanticAI: instead of using the portkey-ai SDK's
Portkey client directly (PydanticAI needs an OpenAI-Python-compatible async
client), we build an openai.AsyncOpenAI client pointed at Portkey's gateway
and hand it to PydanticAI's OpenAIProvider.
"""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

from models import ChatReply
from tools import get_product_details, get_stock_by_size, search_products

# hw4/.env is the documented location (see hw4/.env.example); backend/.env
# is still read as a fallback. load_dotenv never overrides a variable that's
# already set, so the first file found wins.
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR.parent / ".env")
load_dotenv(_BACKEND_DIR / ".env")

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")

# Loop limits for one chat turn. A normal turn is 2-3 model requests
# (decide on tools -> read results -> answer) and 1-3 tool calls, so these
# leave headroom while stopping a runaway loop quickly. Hitting either
# raises UsageLimitExceeded, which /api/chat turns into a graceful handoff.
REQUEST_LIMIT = 6
TOOL_CALLS_LIMIT = 8
USAGE_LIMITS = UsageLimits(request_limit=REQUEST_LIMIT, tool_calls_limit=TOOL_CALLS_LIMIT)

# How many times the model may retry after a tool or output validation
# error before the run fails.
AGENT_RETRIES = 1
PROMPT_PATH = _BACKEND_DIR / "prompts" / "prompt.md"

_client = AsyncOpenAI(
    api_key=os.environ["PORTKEY_API_KEY"],
    base_url="https://api.portkey.ai/v1",
    default_headers={"x-portkey-provider": "openai"},
)

_model = OpenAIChatModel(
    MODEL_NAME,
    provider=OpenAIProvider(openai_client=_client),
)

_system_prompt = PROMPT_PATH.read_text(encoding="utf-8")


@dataclass
class ChatDeps:
    """Per-request context that isn't part of the conversation text itself:
    who's asking (if anyone is logged in) and which product page they're
    currently looking at (if any)."""

    user_name: str | None = None
    user_email: str | None = None
    current_product_id: str | None = None


shopping_agent = Agent(
    _model,
    output_type=ChatReply,
    # Deliberately `instructions=`, not `system_prompt=`: PydanticAI only
    # (re-)inserts `system_prompt` content on a conversation's first turn —
    # once we pass in our own reconstructed `message_history` for a
    # returning customer, a `system_prompt` never gets added at all for
    # that run. `instructions` (and the `@instructions` decorator below)
    # are recomputed on every single request regardless of message_history
    # length, which is what we actually need: the ground rules and
    # per-request customer/product context must apply on every turn, not
    # just a conversation's very first message.
    instructions=_system_prompt,
    deps_type=ChatDeps,
    tools=[search_products, get_product_details, get_stock_by_size],
    retries=AGENT_RETRIES,
)


@shopping_agent.instructions
def customer_context(ctx: RunContext[ChatDeps]) -> str:
    """Added on top of the static prompt.md on every run, so the agent
    always knows who it's talking to (if anyone) and what they're looking
    at — without that ever being baked into the saved conversation text."""
    deps = ctx.deps
    lines: list[str] = []

    if deps.user_name:
        lines.append(
            f'This is a logged-in customer: {deps.user_name} ({deps.user_email}). '
            "You may use their own name/email to personalize your reply (e.g. greet "
            "them by name) — but this is the only customer's information you have "
            "access to; never reveal, guess, or discuss any other customer's details."
        )
    else:
        lines.append(
            "This shopper is a guest (not logged in). You have no account details "
            "for them, and should not ask for or invent any."
        )

    if deps.current_product_id:
        lines.append(
            f'The customer is RIGHT NOW looking at the product page for product_id='
            f'"{deps.current_product_id}". This is live, current context about where '
            "they are this very message — it takes priority over whatever product "
            "(if any) came up earlier in the conversation history, even if the "
            'history is about a different item. If they refer to "this", "it", or '
            'the item without naming one, assume they mean THIS product_id — look '
            "it up with get_product_details or get_stock_by_size using this exact "
            "product_id rather than guessing, asking which product they mean, or "
            "defaulting to a product from earlier in the conversation."
        )
    else:
        lines.append(
            "The customer is not currently viewing any specific product page. If "
            'they refer to "this" or "it" without naming or having just found a '
            "product in this conversation, ask a short clarifying question about "
            "which product they mean instead of guessing."
        )

    return "\n".join(lines)
