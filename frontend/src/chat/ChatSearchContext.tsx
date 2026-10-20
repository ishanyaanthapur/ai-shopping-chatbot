// Shares the chatbot's structured product matches with the rest of the
// page, so a search done in chat can surface real product cards on the
// site itself (not just inside the chat panel), per Problem 7.
//
// `results`/`query` persist across navigation (they're only replaced by a
// newer chat search, or fully wiped by "Clear results") so that the
// Products page can later reconstruct "the list the customer had asked
// for" when they click "Back to Products" from a chat-originated product
// detail page — see `bannerVisible` below for why this is separate from
// whether the on-page banner is currently shown.

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { ChatProduct } from "./sendMessage";

interface ChatSearchContextValue {
  results: ChatProduct[];
  query: string | null;
  bannerVisible: boolean;
  setResults: (query: string, products: ChatProduct[]) => void;
  hideBanner: () => void;
  clearResults: () => void;
}

const ChatSearchContext = createContext<ChatSearchContextValue | undefined>(undefined);

export function ChatSearchProvider({ children }: { children: ReactNode }) {
  const [results, setResultsState] = useState<ChatProduct[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  const setResults = useCallback((newQuery: string, products: ChatProduct[]) => {
    setQuery(newQuery);
    setResultsState(products);
    setBannerVisible(true);
  }, []);

  // Hides the on-page banner (e.g. when clicking into a product's detail
  // page) without forgetting what the last chat search was.
  const hideBanner = useCallback(() => {
    setBannerVisible(false);
  }, []);

  // Fully resets — used by the explicit "Clear results" button.
  const clearResults = useCallback(() => {
    setQuery(null);
    setResultsState([]);
    setBannerVisible(false);
  }, []);

  return (
    <ChatSearchContext.Provider
      value={{ results, query, bannerVisible, setResults, hideBanner, clearResults }}
    >
      {children}
    </ChatSearchContext.Provider>
  );
}

export function useChatSearch(): ChatSearchContextValue {
  const ctx = useContext(ChatSearchContext);
  if (!ctx) {
    throw new Error("useChatSearch must be used within a ChatSearchProvider");
  }
  return ctx;
}
