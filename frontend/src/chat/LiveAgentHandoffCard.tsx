// Rendered inside the chat thread whenever a reply carries a `handoff` —
// i.e. the shopping agent couldn't answer (model timeout, rate limit,
// exhausted API credit, or the backend being unreachable entirely).
//
// The whole point is that the shopper never hits a dead end: the form is
// pre-filled with their name, email and the exact question they just asked,
// so reaching a human is one click rather than a retype. The mailto: link
// underneath is the escape hatch for the case where even this submission
// can't get through.

import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { handoffMailtoHref, submitSupportInquiry } from "./sendMessage";
import type { LiveAgentHandoff, SupportInquiryReply } from "./sendMessage";

type Status = "idle" | "sending" | "sent" | "error";

interface Props {
  handoff: LiveAgentHandoff;
  onSent: (reply: SupportInquiryReply) => void;
}

export default function LiveAgentHandoffCard({ handoff, onSent }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(handoff.prefill_name ?? user?.name ?? "");
  const [email, setEmail] = useState(handoff.prefill_email ?? user?.email ?? "");
  const [message, setMessage] = useState(handoff.prefill_message);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);

    try {
      const reply = await submitSupportInquiry({ name, email, message });
      setReference(reply.reference);
      setStatus("sent");
      onSent(reply);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "We couldn't send that just now.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="chat-handoff-card chat-handoff-sent">
        <strong>✓ Sent to our {handoff.agent_name}</strong>
        <p>
          Reference <code>{reference}</code> — we'll reply to {email} within one business day.
        </p>
      </div>
    );
  }

  return (
    <form className="chat-handoff-card" onSubmit={handleSubmit}>
      <div className="chat-handoff-head">
        <span className="chat-handoff-avatar" aria-hidden="true">
          🧑‍💼
        </span>
        <div>
          <strong>{handoff.agent_name}</strong>
          <span className="chat-handoff-sub">Usually replies within one business day</span>
        </div>
      </div>

      <label>
        Your name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          disabled={status === "sending"}
        />
      </label>

      <label>
        Your email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yale.edu"
          required
          disabled={status === "sending"}
        />
      </label>

      <label>
        How can we help?
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          required
          disabled={status === "sending"}
        />
      </label>

      {error && <p className="chat-handoff-error">{error}</p>}

      <button type="submit" className="btn" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send to a human"}
      </button>

      <a className="chat-handoff-mailto" href={handoffMailtoHref(handoff)}>
        or email {handoff.agent_email} directly
      </a>
    </form>
  );
}
