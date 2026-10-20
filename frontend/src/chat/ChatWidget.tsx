import { useState, useRef, useEffect, useMemo } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import { OPEN_CHAT_EVENT } from "./openChat";
import {
  sendMessage,
  fetchChatHistory,
  localHandoff,
  HANDOFF_FALLBACK_MESSAGE,
} from "./sendMessage";
import type { ChatProduct, LiveAgentHandoff } from "./sendMessage";
import LiveAgentHandoffCard from "./LiveAgentHandoffCard";
import { useChatSearch } from "./ChatSearchContext";
import { useAuth } from "../auth/AuthContext";
import { API_BASE_URL } from "../api";
import "./ChatWidget.css";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
  products?: ChatProduct[] | null;
  handoff?: LiveAgentHandoff | null;
}

let nextId = 1;

function greetingMessage(): ChatMessage {
  return {
    id: nextId++,
    role: "assistant",
    text: "Hi! I'm the Campus Customs shopping assistant. Ask me about sizes, stock, college gear or gift ideas — I'll pull up the pieces for you.",
  };
}

// Extracts the product_id from a /products/:productId URL, so the agent
// can be told which product page the customer is currently looking at
// (and resolve "do you have this in pink?" without them naming it).
function productIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/products\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { setResults, hideBanner } = useChatSearch();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const currentProductId = useMemo(
    () => productIdFromPath(location.pathname),
    [location.pathname],
  );

  // Load (or reset) the conversation whenever the logged-in account
  // changes — including logging out — so one account's history can never
  // bleed into a guest view or a different account's chat panel.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    if (!user) {
      setMessages([greetingMessage()]);
      return;
    }

    fetchChatHistory()
      .then((history) => {
        if (cancelled) return;
        if (history.length === 0) {
          setMessages([greetingMessage()]);
          return;
        }
        setMessages(
          history.map((m) => ({
            id: nextId++,
            role: m.role,
            text: m.content,
            products: m.products,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([greetingMessage()]);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Other pages (e.g. "Ask our assistant" on a product page) can open the
  // panel and pre-fill a question; the shopper still chooses to send it.
  useEffect(() => {
    function handleOpen(e: Event) {
      const prefill = (e as CustomEvent<string | undefined>).detail;
      setIsOpen(true);
      if (prefill) setDraft(prefill);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    window.addEventListener(OPEN_CHAT_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handleOpen);
  }, []);

  // Enter sends; Shift+Enter inserts a newline.
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isWaiting) return;

    setMessages((prev) => [...prev, { id: nextId++, role: "user", text }]);
    setDraft("");
    setIsWaiting(true);

    try {
      const reply = await sendMessage(text, currentProductId);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          role: "assistant",
          text: reply.message,
          products: reply.products,
          handoff: reply.handoff ?? null,
        },
      ]);
      if (reply.products && reply.products.length > 0) {
        setResults(text, reply.products);
      }
    } catch {
      // The request never reached the backend (server down, network
      // dropped). Rather than a dead-end error bubble, show the same
      // apology and live-agent handoff the backend would have sent.
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          role: "assistant",
          text: HANDOFF_FALLBACK_MESSAGE,
          handoff: localHandoff(text),
        },
      ]);
    } finally {
      setIsWaiting(false);
    }
  }

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span className="chat-avatar" aria-hidden="true">
              Y
            </span>
            <div className="chat-panel-title">
              <strong>Campus Customs</strong>
              <span>
                <span className="chat-online-dot" /> Shopping assistant · real humans on call
              </span>
            </div>
            <button
              type="button"
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              &times;
            </button>
          </div>
          <div className="chat-panel-messages" ref={listRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble chat-bubble-${m.role}${m.isError ? " chat-bubble-error" : ""}${m.handoff ? " chat-bubble-handoff" : ""}`}
              >
                {m.role === "assistant" ? (
                  <div className="chat-markdown">
                    <Markdown>{m.text}</Markdown>
                  </div>
                ) : (
                  m.text
                )}
                {m.products && m.products.length > 0 && (
                  <div className="chat-product-chips">
                    {m.products.map((p) => (
                      <Link
                        key={p.id}
                        className="chat-product-chip"
                        to={`/products/${encodeURIComponent(p.id)}`}
                        title={p.description}
                        onClick={hideBanner}
                      >
                        <img src={`${API_BASE_URL}${p.image_url}`} alt={p.name} />
                        <span className="chat-product-chip-name">{p.name}</span>
                        <span className="chat-product-chip-price">${p.price.toFixed(2)}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {m.handoff && (
                  <LiveAgentHandoffCard
                    handoff={m.handoff}
                    onSent={(reply) =>
                      setMessages((prev) => [
                        ...prev,
                        { id: nextId++, role: "assistant", text: reply.message },
                      ])
                    }
                  />
                )}
              </div>
            ))}
            {isWaiting && (
              <div className="chat-bubble chat-bubble-assistant chat-bubble-loading">
                <span className="chat-typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            )}
          </div>
          <form className="chat-panel-input" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask about sizes, colleges, gifts…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Chat message"
              disabled={isWaiting}
            />
            <button type="submit" className="chat-send" disabled={!draft.trim() || isWaiting} aria-label="Send">
              ↑
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className={`chat-bubble-toggle${isOpen ? " open" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          "×"
        ) : (
          <>
            <span className="chat-toggle-y" aria-hidden="true">
              Y
            </span>
            <span className="chat-toggle-label">Ask Campus Customs</span>
          </>
        )}
      </button>
    </div>
  );
}
