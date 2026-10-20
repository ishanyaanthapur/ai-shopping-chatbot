import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { imageUrl } from "../api";
import type { Product } from "../api";
import { collegesInCatalogue, findCollection, sportsInCatalogue } from "../catalog";
import HeroBanner from "../components/HeroBanner";
import ProductRail from "../components/ProductRail";
import { ChatIcon, PinIcon, RulerIcon } from "../components/icons";
import { openChat } from "../chat/openChat";
import { useInView } from "../hooks/useInView";
import { useProducts } from "../hooks/useProducts";
import { TYPE_FACETS, productTypeId } from "./productFilters";
import "./Home.css";

// Hand-picked cover shot for each category arch; falls back to the first
// product of that type if an ID ever disappears from the catalogue.
const CATEGORY_COVERS: Record<string, string> = {
  hoodies: "yale-sports-hoodie-hockey",
  crewnecks: "poly-twill-crewneck-arched-yale",
  "t-shirts": "t-felt-y-heavyweight",
  "quarter-zips": "berkeley-1-4-zip",
  jackets: "benjamin-franklin-fleece-jacket",
  "long-sleeve": "dry-zone-long-sleeve",
};

const CATEGORY_NAMES: Record<string, string> = {
  hoodies: "Hoodies",
  crewnecks: "Crewnecks",
  "t-shirts": "Tees",
  "quarter-zips": "Quarter-Zips",
  jackets: "Outerwear",
  "long-sleeve": "Long-Sleeve",
};

const FAMILY_CHIPS = ["Mom", "Dad", "Grandma", "Grandpa", "Aunt", "Uncle", "Brother", "Cousin"];
const FAMILY_COLLAGE = ["yale-mom-hoodie", "yale-dad-crewneck", "yale-grandpa-hoodie"];

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal${inView ? " reveal-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

function byId(products: Product[], id: string): Product | undefined {
  return products.find((p) => p.product_id === id);
}

export default function Home() {
  const { products, status } = useProducts();

  if (status === "error") {
    return (
      <div className="container home-error">
        <h1>We're having trouble reaching the store.</h1>
        <p className="muted">Please make sure the backend is running and refresh the page.</p>
      </div>
    );
  }

  if (status === "loading") {
    return <div className="hero-skeleton" aria-label="Loading" />;
  }

  const categories = TYPE_FACETS.map((facet) => {
    const ofType = products.filter((p) => productTypeId(p) === facet.id);
    return {
      id: facet.id,
      name: CATEGORY_NAMES[facet.id],
      count: ofType.length,
      cover: byId(products, CATEGORY_COVERS[facet.id]) ?? ofType[0],
    };
  }).filter((c) => c.count > 0);

  const colleges = collegesInCatalogue(products);
  const sports = sportsInCatalogue(products);
  const hoodies = products.filter((p) => productTypeId(p) === "hoodies").slice(0, 12);
  const layers = products
    .filter((p) => ["quarter-zips", "jackets"].includes(productTypeId(p) ?? ""))
    .slice(0, 12);
  const family = findCollection("family")!;
  const collage = FAMILY_COLLAGE.map((id) => byId(products, id)).filter(Boolean) as Product[];

  return (
    <div className="home">
      <HeroBanner products={products} />

      {/* Shop by category — gothic arch tiles */}
      <section className="container home-section">
        <Reveal className="section-head">
          <span className="eyebrow">Find your fit</span>
          <h2>Shop by category</h2>
        </Reveal>
        <div className="arch-grid">
          {categories.map((c) => (
            <Link key={c.id} to={`/products?type=${c.id}`} className="arch-tile">
              <div className="arch arch-tile-frame">
                {c.cover && <img src={imageUrl(c.cover)} alt="" loading="lazy" />}
              </div>
              <span className="arch-tile-name">{c.name}</span>
              <span className="arch-tile-count">{c.count} styles</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Residential college pennant wall */}
      <section className="pennant-section">
        <div className="container">
          <Reveal className="section-head section-head-center">
            <span className="eyebrow">Residential Colleges</span>
            <h2>Rep your college</h2>
            <p className="section-sub">
              Fourteen colleges, one Yale. Find the crest you call home.
            </p>
          </Reveal>
        </div>
        <div className="pennant-line">
          <div className="pennant-string" aria-hidden="true" />
          <div className="pennants">
            {colleges.map((c, i) => (
              <Link
                key={c.name}
                to={`/products?collection=colleges&name=${encodeURIComponent(c.name)}`}
                className={`pennant pennant-${i % 3}`}
                style={{ animationDelay: `${(i % 5) * -0.7}s` }}
              >
                <span className="pennant-name">{c.name}</span>
                <span className="pennant-count">{c.count}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="container pennant-cta">
          <Link to="/products?collection=colleges" className="btn btn-outline">
            Shop all college gear
          </Link>
        </div>
      </section>

      <ProductRail
        eyebrow="Big pride, big Yale"
        title="Hoodies we love"
        products={hoodies}
        viewAllHref="/products?type=hoodies"
      />

      {/* Family feature */}
      <section className="container home-section">
        <Reveal className="family-band">
          <div className="family-copy">
            <span className="eyebrow">{family.eyebrow}</span>
            <h2>Gifts for the whole Bulldog family</h2>
            <p>{family.blurb}</p>
            <div className="family-chips">
              {FAMILY_CHIPS.map((who) => (
                <Link key={who} to={`/products?q=${who}`} className="family-chip">
                  {who}
                </Link>
              ))}
            </div>
            <Link to="/products?collection=family" className="btn btn-light">
              Shop family gifts
            </Link>
          </div>
          <div className="family-collage">
            {collage.map((p, i) => (
              <Link
                key={p.product_id}
                to={`/products/${p.product_id}`}
                className={`family-photo family-photo-${i}`}
              >
                <img src={imageUrl(p)} alt={p.name} loading="lazy" />
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      <ProductRail
        eyebrow="New Haven winters"
        title="Layers for the walk to class"
        products={layers}
        viewAllHref="/products?type=quarter-zips,jackets"
      />

      {/* Athletics scoreboard */}
      <section className="container home-section">
        <Reveal className="section-head">
          <span className="eyebrow">Bulldog Athletics</span>
          <h2>Every team, every season</h2>
        </Reveal>
        <div className="scoreboard">
          {sports.map((s) => (
            <Link
              key={s.name}
              to={`/products?collection=sports&name=${encodeURIComponent(s.query)}`}
              className="scoreboard-cell"
            >
              <span className="scoreboard-name">{s.name}</span>
              <span className="scoreboard-count">{String(s.count).padStart(2, "0")}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Service promises */}
      <section className="container home-section">
        <div className="promises">
          <div className="promise">
            <RulerIcon />
            <h3>Sizes XS–XXL</h3>
            <p>Every style is stocked in six sizes, with live stock shown on each product.</p>
          </div>
          <div className="promise">
            <PinIcon />
            <h3>Campus pickup</h3>
            <p>Grab your order at 57 Broadway — steps from Old Campus.</p>
          </div>
          <button type="button" className="promise promise-action" onClick={() => openChat()}>
            <ChatIcon />
            <h3>Ask the assistant</h3>
            <p>Not sure what to get? Our shopping assistant — and real humans — are one click away.</p>
          </button>
        </div>
      </section>
    </div>
  );
}
