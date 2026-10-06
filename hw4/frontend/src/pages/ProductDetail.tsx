import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProduct, imageUrl } from "../api";
import type { Product } from "../api";
import { useBag } from "../bag/BagContext";
import { useChatSearch } from "../chat/ChatSearchContext";
import { openChat } from "../chat/openChat";
import ProductRail from "../components/ProductRail";
import { useProducts } from "../hooks/useProducts";
import { COLOR_FACETS, TYPE_FACETS, productColorIds, productTypeId } from "./productFilters";
import "./ProductDetail.css";

type Status = "loading" | "ready" | "not-found" | "error";

const LOW_STOCK = 5;

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [imageFailed, setImageFailed] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [sizeHint, setSizeHint] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const { results: chatResults } = useChatSearch();
  const { products } = useProducts();
  const { add } = useBag();

  // If this product was one of the chatbot's last search matches, "Back to
  // Products" should return to that same filtered list instead of the full
  // catalog — see Products.tsx's `?from=chat` handling.
  const cameFromChatSearch = chatResults.some((p) => p.id === productId);
  const backToProductsHref = cameFromChatSearch ? "/products?from=chat" : "/products";

  useEffect(() => {
    if (!productId) {
      setStatus("not-found");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setImageFailed(false);
    setSize(null);
    setSizeHint(false);
    fetchProduct(productId)
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof Error && err.message === "NOT_FOUND" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (status === "loading") {
    return (
      <div className="container product-detail-page">
        <div className="pdp-skeleton">
          <div className="pdp-skeleton-img arch" />
          <div className="pdp-skeleton-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="container product-detail-page">
        <div className="pdp-missing">
          <span className="eyebrow">404</span>
          <h1>We couldn't find that piece.</h1>
          <p className="muted">It may have sold out or moved. Let's get you back to the shop.</p>
          <Link to={backToProductsHref} className="btn">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error" || !product) {
    return (
      <div className="container product-detail-page">
        <div className="pdp-missing">
          <h1>Something went wrong.</h1>
          <p className="muted">We couldn't load this product. Please try again later.</p>
          <Link to={backToProductsHref} className="btn btn-outline">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const typeId = productTypeId(product);
  const typeFacet = TYPE_FACETS.find((f) => f.id === typeId);
  const colorIds = productColorIds(product);
  const inventory = product.inventory ?? [];
  const selected = inventory.find((e) => e.size === size);
  const totalStock = inventory.reduce((n, e) => n + e.quantity, 0);
  const related = products
    .filter((p) => p.product_id !== product.product_id && productTypeId(p) === typeId)
    .slice(0, 10);

  function handleAdd() {
    if (!product) return;
    if (!size) {
      setSizeHint(true);
      return;
    }
    add({
      productId: product.product_id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      size,
    });
  }

  function handleZoomMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to={backToProductsHref}>{cameFromChatSearch ? "Your chat results" : "Shop All"}</Link>
          {typeFacet && !cameFromChatSearch && (
            <>
              <span>/</span>
              <Link to={`/products?type=${typeFacet.id}`}>{typeFacet.label}</Link>
            </>
          )}
        </nav>

        <div className="pdp-grid">
          <div
            className={`pdp-gallery arch${zoom ? " zooming" : ""}`}
            onMouseMove={handleZoomMove}
            onMouseLeave={() => setZoom(null)}
          >
            {imageFailed ? (
              <div className="pdp-image-fallback">Image unavailable</div>
            ) : (
              <img
                src={imageUrl(product)}
                alt={product.name}
                onError={() => setImageFailed(true)}
                style={zoom ? { transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            )}
            <span className="pdp-zoom-hint">Hover to zoom</span>
          </div>

          <div className="pdp-info">
            {typeFacet && <span className="eyebrow">{typeFacet.label}</span>}
            <h1>{product.name}</h1>
            <p className="pdp-price">${product.price.toFixed(2)}</p>

            {colorIds.length > 0 && (
              <div className="pdp-block">
                <span className="pdp-label">
                  Colors <span className="pdp-label-value">{product.colors.join(", ")}</span>
                </span>
                <div className="pdp-swatches">
                  {colorIds.map((id) => {
                    const facet = COLOR_FACETS.find((f) => f.id === id);
                    return (
                      <span
                        key={id}
                        className="pdp-swatch"
                        style={{ background: facet?.swatch }}
                        title={facet?.label}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pdp-block">
              <span className="pdp-label">
                Size{" "}
                <span className="pdp-label-value">
                  {selected ? selected.size : "Select a size"}
                </span>
              </span>
              {inventory.length > 0 ? (
                <div className={`size-grid${sizeHint && !size ? " size-grid-hint" : ""}`}>
                  {inventory.map((entry) => {
                    const soldOut = entry.quantity <= 0;
                    return (
                      <button
                        key={entry.size}
                        type="button"
                        className={`size-pill${size === entry.size ? " selected" : ""}${soldOut ? " sold-out" : ""}`}
                        disabled={soldOut}
                        aria-pressed={size === entry.size}
                        aria-label={soldOut ? `${entry.size}, sold out` : `Size ${entry.size}`}
                        onClick={() => {
                          setSize(entry.size);
                          setSizeHint(false);
                        }}
                      >
                        {entry.size}
                        {!soldOut && entry.quantity <= LOW_STOCK && (
                          <span className="size-low-dot" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">Size information isn't available for this item.</p>
              )}
              <p className="pdp-stock" role="status">
                {sizeHint && !size && <span className="pdp-stock-warn">Please choose a size first.</span>}
                {selected && selected.quantity <= LOW_STOCK && (
                  <span className="pdp-stock-low">Only {selected.quantity} left in {selected.size} — don't wait.</span>
                )}
                {selected && selected.quantity > LOW_STOCK && (
                  <span className="pdp-stock-ok">In stock and ready to ship.</span>
                )}
                {!selected && !sizeHint && totalStock === 0 && inventory.length > 0 && (
                  <span className="pdp-stock-warn">Sold out in every size.</span>
                )}
              </p>
            </div>

            <button
              type="button"
              className="btn pdp-add"
              onClick={handleAdd}
              disabled={inventory.length > 0 && totalStock === 0}
            >
              {size ? `Add to bag — $${product.price.toFixed(2)}` : "Add to bag"}
            </button>

            <button
              type="button"
              className="pdp-ask"
              onClick={() => openChat(`Can you tell me more about the ${product.name}?`)}
            >
              Questions about this piece? <strong>Ask our assistant →</strong>
            </button>

            <div className="pdp-accordions">
              <details open>
                <summary>Description</summary>
                <p>{product.description}</p>
              </details>
              <details>
                <summary>Size &amp; fit</summary>
                <p>
                  Stocked in {inventory.map((e) => e.size).join(", ") || "XS–XXL"}. Unisex sizing —
                  if you're between sizes, size up for a relaxed, lived-in fit. A dot on a size
                  means only a few are left.
                </p>
              </details>
              <details>
                <summary>Pickup &amp; shipping</summary>
                <p>
                  Pick up at 57 Broadway, New Haven, or have it shipped. Shipping is free on
                  orders of $75 or more.
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>

      <ProductRail
        eyebrow="Complete the look"
        title="You might also like"
        products={related}
        viewAllHref={typeFacet ? `/products?type=${typeFacet.id}` : "/products"}
      />
    </div>
  );
}
