import { useRef } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../api";
import ProductCard from "./ProductCard";
import "./ProductRail.css";

interface Props {
  eyebrow: string;
  title: string;
  products: Product[];
  viewAllHref?: string;
}

/** Horizontally scrolling, snap-aligned row of product cards. */
export default function ProductRail({ eyebrow, title, products, viewAllHref }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="rail container">
      <div className="rail-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <div className="rail-actions">
          {viewAllHref && (
            <Link to={viewAllHref} className="rail-view-all">
              View all
            </Link>
          )}
          <button type="button" className="rail-arrow" aria-label="Scroll left" onClick={() => scrollBy(-1)}>
            ←
          </button>
          <button type="button" className="rail-arrow" aria-label="Scroll right" onClick={() => scrollBy(1)}>
            →
          </button>
        </div>
      </div>
      <div className="rail-track" ref={trackRef}>
        {products.map((p) => (
          <div className="rail-item" key={p.product_id}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
