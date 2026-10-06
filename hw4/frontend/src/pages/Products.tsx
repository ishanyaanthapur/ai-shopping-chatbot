import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProducts } from "../api";
import type { Product } from "../api";
import { useChatSearch } from "../chat/ChatSearchContext";
import ProductCard from "../components/ProductCard";
import { SPORTS, findCollection, matchesQuery, nameHasWord } from "../catalog";
import {
  COLOR_FACETS,
  SORT_OPTIONS,
  TYPE_FACETS,
  countBy,
  productColorIds,
  productTypeId,
  sortProducts,
} from "./productFilters";
import type { Facet, SortId } from "./productFilters";
import "./Products.css";

type Status = "loading" | "ready" | "error";

function matchesTag(product: Product, tag: string): boolean {
  const needle = tag.toLowerCase();
  const haystack = [
    product.garment_type ?? "",
    product.name ?? "",
    ...(product.search_tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Read a comma-separated multi-select param (`?type=hoodies,jackets`). */
function parseList(raw: string | null): string[] {
  return raw ? raw.split(",").filter(Boolean) : [];
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { results: chatResults, query: chatQuery } = useChatSearch();

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchProducts()
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fromChat = searchParams.get("from") === "chat" && chatResults.length > 0;
  const tag = searchParams.get("tag");
  const collection = findCollection(searchParams.get("collection"));
  const query = searchParams.get("q")?.trim() ?? "";
  // Exact name phrase for a single college or team (e.g. "Morse",
  // "Crew Left Chest"), where free-text search would be too loose.
  const namePhrase = searchParams.get("name")?.trim() ?? "";
  const nameLabel = SPORTS.find((s) => s.phrase === namePhrase)?.label ?? namePhrase;

  // The set the filter sidebar operates on: normally the whole catalogue,
  // but narrowed first if the shopper arrived from a chat search, a tag
  // link, a collection or a header search, so those entry points stay
  // intact and are still refinable.
  const baseProducts = useMemo(() => {
    let base = products;
    if (fromChat) {
      const chatIds = new Set(chatResults.map((p) => p.id));
      base = base.filter((product) => chatIds.has(product.product_id));
    } else if (tag) {
      const filtered = base.filter((product) => matchesTag(product, tag));
      base = filtered.length === 0 ? base : filtered;
    }
    if (collection) base = base.filter(collection.match);
    if (namePhrase) base = base.filter((p) => nameHasWord(p, [namePhrase]));
    if (query) base = base.filter((p) => matchesQuery(p, query));
    return base;
  }, [products, fromChat, chatResults, tag, collection, namePhrase, query]);

  // Price bounds come from the live catalogue rather than hard-coded
  // brackets, so the slider can never offer a range with nothing in it.
  const [priceFloor, priceCeiling] = useMemo(() => {
    if (baseProducts.length === 0) return [0, 100];
    const prices = baseProducts.map((p) => p.price);
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [baseProducts]);

  const selectedTypes = parseList(searchParams.get("type"));
  const selectedColors = parseList(searchParams.get("color"));
  const sort = (searchParams.get("sort") as SortId) ?? "featured";
  const minPrice = Number(searchParams.get("min") ?? priceFloor);
  const maxPrice = Number(searchParams.get("max") ?? priceCeiling);
  const priceTouched =
    searchParams.has("min") || searchParams.has("max");

  const typeCounts = useMemo(
    () => countBy(baseProducts, (p) => [productTypeId(p)].filter((id): id is string => !!id)),
    [baseProducts],
  );
  const colorCounts = useMemo(() => countBy(baseProducts, productColorIds), [baseProducts]);

  const displayed = useMemo(() => {
    const filtered = baseProducts.filter((product) => {
      if (selectedTypes.length > 0) {
        const typeId = productTypeId(product);
        if (!typeId || !selectedTypes.includes(typeId)) return false;
      }
      if (selectedColors.length > 0) {
        const colorIds = productColorIds(product);
        if (!colorIds.some((id) => selectedColors.includes(id))) return false;
      }
      if (product.price < minPrice || product.price > maxPrice) return false;
      return true;
    });
    return sortProducts(filtered, sort);
  }, [baseProducts, selectedTypes, selectedColors, minPrice, maxPrice, sort]);

  /** Writes one filter into the URL, so a filtered view is shareable and
   *  survives the back button. Updaters take `setSearchParams`' functional
   *  form so each one reads the params it's actually amending rather than a
   *  closed-over copy. Removing a param entirely (rather than writing an
   *  empty value) keeps the URL clean, and `replace: true` stops a slider
   *  drag flooding the back button with one entry per pixel. */
  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  function toggleFacet(key: "type" | "color", id: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const current = parseList(prev.get(key));
        const updated = current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id];
        if (updated.length === 0) {
          next.delete(key);
        } else {
          next.set(key, updated.join(","));
        }
        return next;
      },
      { replace: true },
    );
  }

  function setPrice(min: number, max: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("min", String(min));
        next.set("max", String(max));
        return next;
      },
      { replace: true },
    );
  }

  function clearAll() {
    const next = new URLSearchParams();
    // Preserve how the shopper got here — clearing *filters* shouldn't also
    // throw away their chat search, tag link or the collection they're in.
    if (fromChat) next.set("from", "chat");
    if (tag) next.set("tag", tag);
    if (collection) next.set("collection", collection.id);
    if (namePhrase) next.set("name", namePhrase);
    setSearchParams(next, { replace: true });
  }

  const activePills = [
    ...(query
      ? [
          {
            key: "q",
            label: `“${query}”`,
            remove: () => updateParam("q", null),
          },
        ]
      : []),
    ...selectedTypes.map((id) => ({
      key: `type:${id}`,
      label: TYPE_FACETS.find((f) => f.id === id)?.label ?? id,
      remove: () => toggleFacet("type", id),
    })),
    ...selectedColors.map((id) => ({
      key: `color:${id}`,
      label: COLOR_FACETS.find((f) => f.id === id)?.label ?? id,
      remove: () => toggleFacet("color", id),
    })),
    ...(priceTouched
      ? [
          {
            key: "price",
            label: `$${minPrice} – $${maxPrice}`,
            remove: () =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("min");
                  next.delete("max");
                  return next;
                },
                { replace: true },
              ),
          },
        ]
      : []),
  ];

  function renderFacetGroup(
    title: string,
    facets: Facet[],
    counts: Record<string, number>,
    key: "type" | "color",
    selected: string[],
  ) {
    const available = facets.filter((facet) => (counts[facet.id] ?? 0) > 0);
    if (available.length === 0) return null;
    return (
      <fieldset className="filter-group">
        <legend>{title}</legend>
        {available.map((facet) => (
          <label className="filter-option" key={facet.id}>
            <input
              type="checkbox"
              checked={selected.includes(facet.id)}
              onChange={() => toggleFacet(key, facet.id)}
            />
            {facet.swatch && (
              <span
                className="filter-swatch"
                style={{ background: facet.swatch }}
                aria-hidden="true"
              />
            )}
            <span className="filter-option-label">{facet.label}</span>
            <span className="filter-option-count">{counts[facet.id]}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  // Page title reflects where the shopper is: a collection, a search, a
  // single category, or the whole store.
  const singleType = selectedTypes.length === 1 ? TYPE_FACETS.find((f) => f.id === selectedTypes[0]) : undefined;
  const title = namePhrase
    ? nameLabel
    : collection
    ? collection.label
    : query
      ? `Results for “${query}”`
      : singleType
        ? singleType.label
        : "Shop All";
  const eyebrow = collection ? collection.eyebrow : query ? "Search" : "Yale Bulldog Blue";

  return (
    <div className="container products-page">
      <div className="products-page-header">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          {title === "Shop All" ? <span>Shop All</span> : <Link to="/products">Shop All</Link>}
          {title !== "Shop All" && (
            <>
              <span>/</span>
              {collection && namePhrase ? (
                <>
                  <Link to={`/products?collection=${collection.id}`}>{collection.label}</Link>
                  <span>/</span>
                  <span>{nameLabel}</span>
                </>
              ) : (
                <span>{collection ? collection.label : query ? "Search" : title}</span>
              )}
            </>
          )}
        </nav>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {collection && !namePhrase && <p className="products-blurb">{collection.blurb}</p>}
        {fromChat && (
          <div className="products-chat-filter-banner">
            <span>
              Showing results for your chat search{chatQuery ? <>: &ldquo;{chatQuery}&rdquo;</> : null}
            </span>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setSearchParams({})}
            >
              Show all products
            </button>
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="product-skeleton" key={i} />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="state-message state-error">
          <p>We couldn't reach the store right now. Please make sure the backend is running and try again.</p>
        </div>
      )}

      {status === "ready" && (
        <div className="products-layout">
          <button
            type="button"
            className="btn-outline filters-toggle"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            {filtersOpen ? "Hide filters" : "Filters"}
            {activePills.length > 0 && <span className="filters-badge">{activePills.length}</span>}
          </button>

          <aside className={`products-filters${filtersOpen ? " products-filters-open" : ""}`}>
            <div className="filter-head">
              <h2>Filters</h2>
              {activePills.length > 0 && (
                <button type="button" className="filter-clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>

            {renderFacetGroup("Product type", TYPE_FACETS, typeCounts, "type", selectedTypes)}
            {renderFacetGroup("Color", COLOR_FACETS, colorCounts, "color", selectedColors)}

            <fieldset className="filter-group">
              <legend>Price</legend>
              <div className="price-values">
                <span>${minPrice}</span>
                <span>${maxPrice}</span>
              </div>
              {/* Two overlaid range inputs make the dual-handle slider; each
                  handle is clamped so they can't cross over each other. */}
              <div className="price-slider">
                <div className="price-slider-track" />
                <div
                  className="price-slider-fill"
                  style={{
                    left: `${((minPrice - priceFloor) / (priceCeiling - priceFloor)) * 100}%`,
                    right: `${100 - ((maxPrice - priceFloor) / (priceCeiling - priceFloor)) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  aria-label="Minimum price"
                  min={priceFloor}
                  max={priceCeiling}
                  value={minPrice}
                  onChange={(e) => setPrice(Math.min(Number(e.target.value), maxPrice), maxPrice)}
                />
                <input
                  type="range"
                  aria-label="Maximum price"
                  min={priceFloor}
                  max={priceCeiling}
                  value={maxPrice}
                  onChange={(e) => setPrice(minPrice, Math.max(Number(e.target.value), minPrice))}
                />
              </div>
            </fieldset>
          </aside>

          <section className="products-results">
            <div className="products-toolbar">
              <span className="products-count">
                {displayed.length} {displayed.length === 1 ? "product" : "products"}
              </span>
              <label className="products-sort">
                Sort by
                <select value={sort} onChange={(e) => updateParam("sort", e.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activePills.length > 0 && (
              <div className="active-pills">
                {activePills.map((pill) => (
                  <button
                    type="button"
                    className="active-pill"
                    key={pill.key}
                    onClick={pill.remove}
                  >
                    {pill.label}
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
              </div>
            )}

            {displayed.length === 0 ? (
              <div className="state-message">
                <p>
                  No products match these filters.{" "}
                  <button type="button" className="link-button" onClick={clearAll}>
                    Clear all filters
                  </button>{" "}
                  to see everything.
                </p>
              </div>
            ) : (
              <div className="product-grid">
                {displayed.map((product) => (
                  <ProductCard key={product.product_id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
