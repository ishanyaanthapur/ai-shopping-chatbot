import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../api";
import { imageUrl } from "../api";
import "./HeroBanner.css";

interface Slide {
  eyebrow: string;
  headline: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string;
  productId: string;
}

// Each slide is anchored to one real product, shown in the arch and linked
// from the price tag, so the hero sells something specific rather than
// being decoration.
const SLIDES: Slide[] = [
  {
    eyebrow: "The classic",
    headline: "Big Pride, Big Yale.",
    copy: "The heavyweight navy hoodie that's been on every walk across Old Campus.",
    ctaLabel: "Shop Hoodies",
    ctaHref: "/products?type=hoodies",
    productId: "basic-hoodie-big-yale",
  },
  {
    eyebrow: "Game day",
    headline: "Gear up for The Game.",
    copy: "Rivalry-ready tees and crews for every kickoff, tailgate and Saturday in the Bowl.",
    ctaLabel: "Shop Athletics",
    ctaHref: "/products?collection=sports",
    productId: "2025-yale-vs-harvard-t-shirt",
  },
  {
    eyebrow: "Your college",
    headline: "Rep your residential college.",
    copy: "Crests, quarter-zips and fleece for the house that made Yale home.",
    ctaLabel: "Shop Colleges",
    ctaHref: "/products?collection=colleges",
    productId: "benjamin-franklin-1-4-zip",
  },
  {
    eyebrow: "For the family",
    headline: "Bulldogs run in the family.",
    copy: "Gifts for the moms, dads and grandparents cheering from home.",
    ctaLabel: "Shop Family",
    ctaHref: "/products?collection=family",
    productId: "yale-dad-crewneck",
  },
  {
    eyebrow: "Fall layers",
    headline: "Built for New Haven winters.",
    copy: "Fleece, bombers and quarter-zips for crisp walks up Hillhouse Avenue.",
    ctaLabel: "Shop Outerwear",
    ctaHref: "/products?type=jackets",
    productId: "brooks-brothers-bomber-jacket-yale",
  },
];

const AUTOPLAY_MS = 6500;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function HeroBanner({ products }: { products: Product[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = SLIDES.map((slide, i) => ({
    ...slide,
    product: products.find((p) => p.product_id === slide.productId) ?? products[i],
  }));

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const timer = setTimeout(() => setActive((prev) => (prev + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [active, paused]);

  const current = slides[active];

  return (
    <section
      className={`hero${paused ? " hero-paused" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="hero-copy-panel">
        <div className="hero-copy" key={active}>
          <span className="eyebrow">{current.eyebrow}</span>
          <h1>{current.headline}</h1>
          <p>{current.copy}</p>
          <div className="hero-ctas">
            <Link to={current.ctaHref} className="btn btn-light">
              {current.ctaLabel}
            </Link>
            <Link to="/products" className="hero-link">
              Shop all {products.length} styles →
            </Link>
          </div>
        </div>

        <div className="hero-controls">
          <span className="hero-counter">
            {String(active + 1).padStart(2, "0")}
            <span> / {String(SLIDES.length).padStart(2, "0")}</span>
          </span>
          <div className="hero-progress">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.productId}
                type="button"
                className={`hero-progress-seg${i === active ? " active" : ""}${i < active ? " done" : ""}`}
                aria-label={`Show slide ${i + 1}: ${slide.headline}`}
                onClick={() => setActive(i)}
              >
                <span style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-visual">
        {/* Rotating "Boola Boola" seal — a little bit of school spirit. */}
        <svg className="hero-seal" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <path id="seal-circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
          </defs>
          <text>
            <textPath href="#seal-circle">BOOLA BOOLA ✦ BULLDOG BLUE ✦ NEW HAVEN ✦ </textPath>
          </text>
          <text x="60" y="72" textAnchor="middle" className="hero-seal-y">
            Y
          </text>
        </svg>

        <div className="hero-arch arch">
          {slides.map((slide, i) =>
            slide.product ? (
              <img
                key={slide.productId}
                src={imageUrl(slide.product)}
                alt={i === active ? slide.product.name : ""}
                className={i === active ? "active" : ""}
              />
            ) : null,
          )}
        </div>

        {current.product && (
          <Link to={`/products/${current.product.product_id}`} className="hero-tag" key={`tag-${active}`}>
            <span className="hero-tag-label">Featured</span>
            <span className="hero-tag-name">{current.product.name}</span>
            <span className="hero-tag-price">${current.product.price.toFixed(2)} →</span>
          </Link>
        )}
      </div>
    </section>
  );
}
