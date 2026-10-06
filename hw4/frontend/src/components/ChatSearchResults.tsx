// Renders the chatbot's latest structured product matches as real product
// cards directly on the page (Problem 7) — reuses ProductCard so these
// cards look identical to, and open the same detail view as, every other
// product card on the site.

import type { Product } from "../api";
import type { ChatProduct } from "../chat/sendMessage";
import { useChatSearch } from "../chat/ChatSearchContext";
import ProductCard from "./ProductCard";
import "./ChatSearchResults.css";

function chatProductToProduct(p: ChatProduct): Product {
  return {
    product_id: p.id,
    name: p.name,
    garment_type: "",
    description: p.description,
    colors: [],
    search_tags: [],
    image_url: p.image_url,
    price: p.price,
  };
}

export default function ChatSearchResults() {
  const { results, query, bannerVisible, hideBanner, clearResults } = useChatSearch();

  if (!bannerVisible || results.length === 0) {
    return null;
  }

  return (
    <section className="chat-search-results">
      <div className="container chat-search-results-inner">
        <div className="chat-search-results-header">
          <h2>
            From your chat search{query ? <>: &ldquo;{query}&rdquo;</> : null}
          </h2>
          <button type="button" className="btn-outline" onClick={clearResults}>
            Clear results
          </button>
        </div>
        <div className="chat-search-results-grid">
          {results.map((p) => (
            // Hide (not clear) the banner on click so the product detail
            // page you're navigating to isn't left sitting underneath it —
            // otherwise it can look like the click did nothing until you
            // scroll down. The results/query themselves are kept so
            // ProductDetail's "Back to Products" link can return to this
            // same filtered list.
            <div key={p.id} onClick={hideBanner}>
              <ProductCard product={chatProductToProduct(p)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
