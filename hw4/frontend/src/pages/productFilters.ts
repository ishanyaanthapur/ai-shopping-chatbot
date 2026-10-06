// Facet normalization for the Products filter sidebar.
//
// The catalogue's `garment_type` and `colors` columns are free text written
// by whoever entered each product, so the same thing appears under many
// spellings: "short-sleeve t-shirt" / "short-sleeve T-shirt" / "t-shirt" /
// "heavyweight short-sleeve t-shirt" are 22 distinct garment_type values
// across 102 products, and colors range over "navy" vs "navy blue" and five
// different shades of "gray".
//
// Showing those raw values as filter options would be worse than having no
// filter at all — a shopper who picks "hoodie" would never see the products
// filed as "pullover hoodie". So everything is collapsed into a small set of
// shopper-facing buckets here, and the sidebar only ever renders buckets
// that actually match products in the live catalogue.

import type { Product } from "../api";

export interface Facet {
  id: string;
  label: string;
  swatch?: string;
}

// Order matters: the first rule that matches wins. "short-sleeve crew-neck
// t-shirt" has to land in T-Shirts rather than Crewnecks, and anything
// hooded is a hoodie even when it's spelled "...sweatshirt".
const TYPE_RULES: { id: string; label: string; match: (t: string) => boolean }[] = [
  { id: "jackets", label: "Jackets", match: (t) => t.includes("jacket") },
  { id: "quarter-zips", label: "Quarter-Zips", match: (t) => t.includes("quarter-zip") },
  { id: "hoodies", label: "Hoodies", match: (t) => t.includes("hood") },
  {
    id: "long-sleeve",
    label: "Long-Sleeve & Performance",
    match: (t) => t.includes("performance") || t.includes("long-sleeve"),
  },
  { id: "t-shirts", label: "T-Shirts", match: (t) => t.includes("t-shirt") },
  {
    id: "crewnecks",
    label: "Crewnecks & Sweatshirts",
    match: (t) => t.includes("crewneck") || t.includes("crew-neck") || t.includes("sweatshirt"),
  },
];

export const TYPE_FACETS: Facet[] = TYPE_RULES.map(({ id, label }) => ({ id, label }));

export function productTypeId(product: Product): string | null {
  const garmentType = (product.garment_type ?? "").toLowerCase();
  return TYPE_RULES.find((rule) => rule.match(garmentType))?.id ?? null;
}

// Again order-sensitive: "navy blue" must be caught by the navy rule before
// the generic blue rule sees it.
const COLOR_RULES: { id: string; label: string; swatch: string; match: (c: string) => boolean }[] = [
  { id: "navy", label: "Navy", swatch: "#0a2240", match: (c) => c.includes("navy") },
  {
    id: "gray",
    label: "Gray",
    swatch: "#9aa5b1",
    match: (c) => c.includes("gray") || c.includes("grey") || c.includes("charcoal"),
  },
  {
    id: "white",
    label: "White",
    swatch: "#ffffff",
    match: (c) => c.includes("white") || c.includes("cream") || c.includes("ivory"),
  },
  { id: "black", label: "Black", swatch: "#16232f", match: (c) => c.includes("black") },
  { id: "blue", label: "Blue", swatch: "#2f6fb5", match: (c) => c.includes("blue") },
  {
    id: "red",
    label: "Red",
    swatch: "#b3261e",
    match: (c) => c.includes("red") || c.includes("coral"),
  },
  {
    id: "gold",
    label: "Gold & Yellow",
    swatch: "#d4a017",
    match: (c) => c.includes("gold") || c.includes("yellow"),
  },
  { id: "green", label: "Green", swatch: "#1b7a3a", match: (c) => c.includes("green") },
];

export const COLOR_FACETS: Facet[] = COLOR_RULES.map(({ id, label, swatch }) => ({
  id,
  label,
  swatch,
}));

/** Every normalized color bucket a product belongs to (products are usually
 *  offered in several colors, so this is a set, not a single value). */
export function productColorIds(product: Product): string[] {
  const ids = new Set<string>();
  for (const raw of product.colors ?? []) {
    const color = raw.toLowerCase();
    const rule = COLOR_RULES.find((r) => r.match(color));
    if (rule) ids.add(rule.id);
  }
  return [...ids];
}

/** How many of `products` fall into each bucket, so the sidebar can show
 *  real counts and hide buckets nothing matches. */
export function countBy(
  products: Product[],
  bucketsOf: (product: Product) => string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of products) {
    for (const id of bucketsOf(product)) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

export const SORT_OPTIONS = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

export function sortProducts(products: Product[], sort: SortId): Product[] {
  if (sort === "featured") return products;
  const sorted = [...products];
  sorted.sort((a, b) => (sort === "price-asc" ? a.price - b.price : b.price - a.price));
  return sorted;
}
