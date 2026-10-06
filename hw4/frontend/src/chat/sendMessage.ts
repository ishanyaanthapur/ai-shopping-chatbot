// Isolated seam for the shopping-assistant chat backend.
//
// Talks to the real FastAPI /api/chat endpoint (see hw4/backend/main.py),
// which runs the message through a PydanticAI agent backed by gpt-5.6-luna
// via Portkey and returns a structured ChatReply (message + optional grounded
// product list). Requests are sent with credentials so the backend can tell
// which logged-in customer (if any) is chatting, for persistent per-account
// history — see ChatHistoryMessage/fetchChatHistory below.

import { API_BASE_URL } from "../api";

export interface ChatProduct {
  id: string;
  name: string;
  price: number;
  image_url: string;
  description: string;
}

// Present only when the agent couldn't answer (model timeout, rate limit,
// exhausted credit). Carries everything needed to put a human in front of
// the shopper with nothing left for them to retype.
export interface LiveAgentHandoff {
  agent_name: string;
  agent_email: string;
  reason: string;
  subject: string;
  prefill_name: string | null;
  prefill_email: string | null;
  prefill_message: string;
}

export interface ChatReply {
  message: string;
  products: ChatProduct[] | null;
  handoff?: LiveAgentHandoff | null;
}

export interface SupportInquiryReply {
  reference: string;
  agent_name: string;
  agent_email: string;
  message: string;
}

export const LIVE_AGENT_NAME = "Campus Customs Live Agent";
export const LIVE_AGENT_EMAIL = "ishanya.anthapur@yale.edu";

// Used when the request never reaches the backend at all (server down,
// network dropped). The shopper gets the exact same handoff experience as a
// server-side failure rather than a dead-end error bubble.
export function localHandoff(userMessage: string): LiveAgentHandoff {
  return {
    agent_name: LIVE_AGENT_NAME,
    agent_email: LIVE_AGENT_EMAIL,
    reason: "unreachable",
    subject: `Campus Customs help request: ${userMessage.slice(0, 60)}`,
    prefill_name: null,
    prefill_email: null,
    prefill_message: userMessage,
  };
}

export const HANDOFF_FALLBACK_MESSAGE =
  "I'm so sorry — I can't help you any further right now. I don't want to leave you stuck, " +
  "so let me connect you to a real human on our team.";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  products: ChatProduct[] | null;
}

export async function sendMessage(
  userMessage: string,
  currentProductId?: string | null,
): Promise<ChatReply> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message: userMessage,
      current_product_id: currentProductId ?? null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed (status ${res.status})`);
  }

  return res.json();
}

// Restores a logged-in customer's saved conversation (empty for guests or
// anyone with no prior history yet — never throws just because there's
// nothing to restore).
export async function fetchChatHistory(): Promise<ChatHistoryMessage[]> {
  const res = await fetch(`${API_BASE_URL}/api/chat/history`, {
    credentials: "include",
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

// Submits the handoff card from inside the chat panel, so a shopper whose
// question the agent couldn't answer reaches a human without leaving the
// page or opening a mail client.
export async function submitSupportInquiry(inquiry: {
  name: string;
  email: string;
  message: string;
}): Promise<SupportInquiryReply> {
  const res = await fetch(`${API_BASE_URL}/api/support/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(inquiry),
  });

  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => b?.detail)
      .catch(() => null);
    throw new Error(typeof detail === "string" ? detail : "We couldn't send that just now.");
  }

  return res.json();
}

// Last-resort escape hatch: a plain mailto: the shopper can use even if the
// backend is completely unreachable.
export function handoffMailtoHref(handoff: LiveAgentHandoff): string {
  const body = [
    handoff.prefill_name ? `Name: ${handoff.prefill_name}` : null,
    handoff.prefill_email ? `Email: ${handoff.prefill_email}` : null,
    "",
    handoff.prefill_message,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return `mailto:${handoff.agent_email}?subject=${encodeURIComponent(
    handoff.subject,
  )}&body=${encodeURIComponent(body)}`;
}
