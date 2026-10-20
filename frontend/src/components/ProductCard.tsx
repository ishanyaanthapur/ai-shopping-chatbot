import { Link } from "react-router-dom";
import { useState } from "react";
import type { Product } from "../api";
import { imageUrl } from "../api";
import { COLLECTIONS } from "../catalog";
import { COLOR_FACETS, productColorIds, productTypeId } from "../pages/productFilters";
import "./ProductCard.css";

const TYPE_LABEL: Record<string, string> = {
  hoodies: "Hoodie",
  crewnecks: "Crewneck",
  "t-shirts": "Tee",
  "quarter-zips": "Quarter-Zip",
  jackets: "Outerwear",
  "long-sleeve": "Long-Sleeve",
};

const BADGE_LABEL: Record<string, string> = {
  colleges: "Residential College",
  sports: "Athletics",
  family: "Family",
  schools: "Grad School",
};

export default function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);

  const typeId = productTypeId(product);
  const colorIds = productColorIds(product);
  const badge = COLLECTIONS.find((c) => c.match(product));

  return (
    <Link to={`/products/${product.product_id}`} className="product-card">
      <div className="product-card-image">
        {badge && <span className="product-card-badge">{BADGE_LABEL[badge.id]}</span>}
        {imageFailed || !product.image_url ? (
          <div className="product-card-image-fallback">Image unavailable</div>
        ) : (
          <img
            src={imageUrl(product)}
            alt={product.name}
            onError={() => setImageFailed(true)}
            loading="lazy"
          />
        )}
        <span className="product-card-cta">Shop now →</span>
      </div>
      <div className="product-card-body">
        {typeId && <span className="product-card-type">{TYPE_LABEL[typeId]}</span>}
        <h3>{product.name || "Unnamed product"}</h3>
        <div className="product-card-meta">
          <span className="product-card-price">
            {typeof product.price === "number" ? `$${product.price.toFixed(2)}` : "Price unavailable"}
          </span>
          {colorIds.length > 0 && (
            <span className="product-card-colors" aria-label={`${colorIds.length} colors`}>
              {colorIds.slice(0, 4).map((id) => (
                <span
                  key={id}
                  className="product-card-swatch"
                  style={{ background: COLOR_FACETS.find((f) => f.id === id)?.swatch }}
                  title={COLOR_FACETS.find((f) => f.id === id)?.label}
                />
              ))}
              {colorIds.length > 4 && <span className="product-card-more">+{colorIds.length - 4}</span>}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
