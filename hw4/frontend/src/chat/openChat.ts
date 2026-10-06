// Lets any page open the floating chat panel (e.g. "Ask about this product"
// on a product page) without lifting the widget's open state into context.
export const OPEN_CHAT_EVENT = "campus-customs:open-chat";

export function openChat(prefill?: string): void {
  window.dispatchEvent(
    new CustomEvent<string | undefined>(OPEN_CHAT_EVENT, {
      detail: typeof prefill === "string" ? prefill : undefined,
    }),
  );
}
