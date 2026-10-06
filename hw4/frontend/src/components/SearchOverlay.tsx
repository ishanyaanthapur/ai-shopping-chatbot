// Header search: live product matches as you type, with a hand-off to the
// full filtered Products page. Searching is the fastest path to purchase
// for shoppers who already know what they want ("saybrook", "dad hoodie").

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { imageUrl } from "../api";
import { matchesQuery, searchProducts } from "../catalog";
import { useProducts } from "../hooks/useProducts";
import { SearchIcon } from "./icons";
import "./SearchOverlay.css";

const POPULAR = ["Navy hoodie", "Quarter-zip", "Dad", "Hockey", "Saybrook", "Fleece jacket"];

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { products } = useProducts();
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => searchProducts(products, query, 6), [products, query]);
  const total = useMemo(
    () => (query.trim() ? products.filter((p) => matchesQuery(p, query)).length : 0),
    [products, query],
  );

  function goToResults(q: string) {
    if (!q.trim()) return;
    navigate(`/products?q=${encodeURIComponent(q.trim())}`);
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goToResults(query);
  }

  return (
    <div className="search-overlay" role="dialog" aria-label="Search products">
      <div className="search-scrim" onClick={onClose} />
      <div className="search-panel">
        <div className="container">
          <form className="search-form" onSubmit={handleSubmit}>
            <SearchIcon />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hoodies, colleges, sports…"
              aria-label="Search products"
            />
            <button type="button" className="search-close" onClick={onClose}>
              Close
            </button>
          </form>

          {!query.trim() && (
            <div className="search-popular">
              <span className="eyebrow">Popular searches</span>
              <div className="search-popular-chips">
                {POPULAR.map((term) => (
                  <button type="button" key={term} onClick={() => setQuery(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <p className="search-empty">
              No matches for &ldquo;{query}&rdquo;. Try a garment, a college or a sport — or ask our
              assistant in the chat.
            </p>
          )}

          {results.length > 0 && (
            <>
              <div className="search-results">
                {results.map((p) => (
                  <Link
                    key={p.product_id}
                    to={`/products/${p.product_id}`}
                    className="search-result"
                    onClick={onClose}
                  >
                    <img src={imageUrl(p)} alt="" />
                    <span className="search-result-name">{p.name}</span>
                    <span className="search-result-price">${p.price.toFixed(2)}</span>
                  </Link>
                ))}
              </div>
              <button type="button" className="search-all" onClick={() => goToResults(query)}>
                See all {total} results for &ldquo;{query.trim()}&rdquo; →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
