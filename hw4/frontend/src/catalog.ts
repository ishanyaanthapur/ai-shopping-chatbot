// Curated collections and free-text search over the catalogue.
//
// The original Yale Bulldog Blue store navigates by *who you are* as much as
// by garment — Residential Colleges, Sports, Relatives, Graduate & Professional
// Schools. The catalogue has no column for any of that, so each collection is
// a rule over product names, and the header, home page and Products page all
// share these definitions.

import type { Product } from "./api";

export const RESIDENTIAL_COLLEGES = [
  "Benjamin Franklin",
  "Berkeley",
  "Branford",
  "Davenport",
  "Ezra Stiles",
  "Grace Hopper",
  "Jonathan Edwards",
  "Morse",
  "Pauli Murray",
  "Pierson",
  "Saybrook",
  "Silliman",
  "Timothy Dwight",
  "Trumbull",
];

// `phrase` is what identifies the sport in a product name. Rowing is the one
// that needs care: plenty of crewneck names end in a bare "Crew", so only
// the "Crew Left Chest ..." line counts as the rowing team's gear.
export const SPORTS: { label: string; phrase: string }[] = [
  { label: "Football", phrase: "Football" },
  { label: "Baseball", phrase: "Baseball" },
  { label: "Basketball", phrase: "Basketball" },
  { label: "Hockey", phrase: "Hockey" },
  { label: "Soccer", phrase: "Soccer" },
  { label: "Lacrosse", phrase: "Lacrosse" },
  { label: "Tennis", phrase: "Tennis" },
  { label: "Squash", phrase: "Squash" },
  { label: "Track", phrase: "Track" },
  { label: "Diving", phrase: "Diving" },
  { label: "Swimming", phrase: "Swimming" },
  { label: "Fencing", phrase: "Fencing" },
  { label: "Sailing", phrase: "Sailing" },
  { label: "Volleyball", phrase: "Volleyball" },
  { label: "Golf", phrase: "Golf" },
  { label: "Crew", phrase: "Crew Left Chest" },
];

const SPORT_PHRASES = SPORTS.map((s) => s.phrase);

const FAMILY = ["Mom", "Dad", "Grandma", "Grandpa", "Aunt", "Uncle", "Brother", "Sister", "Cousin"];

export function nameHasWord(product: Product, words: string[]): boolean {
  const name = product.name.toLowerCase();
  return words.some((w) => new RegExp(`\\b${w.toLowerCase()}\\b`).test(name));
}

export interface Collection {
  id: string;
  label: string;
  eyebrow: string;
  blurb: string;
  match: (product: Product) => boolean;
}

export const COLLECTIONS: Collection[] = [
  {
    id: "colleges",
    label: "Residential Colleges",
    eyebrow: "Your college, your colors",
    blurb: "Crests and crewnecks for the fourteen houses that make Yale feel like home.",
    match: (p) => nameHasWord(p, RESIDENTIAL_COLLEGES),
  },
  {
    id: "sports",
    label: "Bulldog Athletics",
    eyebrow: "Every team, every season",
    blurb: "From the Bowl to the boathouse — gear for every Bulldog team.",
    match: (p) => nameHasWord(p, SPORT_PHRASES),
  },
  {
    id: "family",
    label: "Bulldog Family",
    eyebrow: "Bulldogs run in the family",
    blurb: "For the moms, dads, grandparents and cousins cheering from home.",
    match: (p) => nameHasWord(p, FAMILY),
  },
  {
    id: "schools",
    label: "Graduate & Professional Schools",
    eyebrow: "Beyond the college",
    blurb: "Law, Medicine, Art, Music, Divinity and more — wear your school.",
    match: (p) => /school|divinity/i.test(p.name),
  },
];

export function findCollection(id: string | null): Collection | undefined {
  return id ? COLLECTIONS.find((c) => c.id === id) : undefined;
}

/** Residential colleges that actually have products, in canonical order. */
export function collegesInCatalogue(products: Product[]): { name: string; count: number }[] {
  return RESIDENTIAL_COLLEGES.map((name) => ({
    name,
    count: products.filter((p) => nameHasWord(p, [name])).length,
  })).filter((c) => c.count > 0);
}

/** Sports that actually have products, with the phrase to search them by. */
export function sportsInCatalogue(
  products: Product[],
): { name: string; query: string; count: number }[] {
  return SPORTS.map(({ label, phrase }) => ({
    name: label,
    query: phrase,
    count: products.filter((p) => nameHasWord(p, [phrase])).length,
  })).filter((s) => s.count > 0);
}

function searchWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w-]/g, ""))
    .filter(Boolean);
}

function haystack(product: Product): string {
  return [
    product.name,
    product.garment_type,
    product.description,
    ...(product.colors ?? []),
    ...(product.search_tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

/** Every word must match somewhere (with a naive singular fallback), so
 *  "navy hoodies" narrows rather than widens. */
export function matchesQuery(product: Product, query: string): boolean {
  const text = haystack(product);
  return searchWords(query).every((word) => {
    if (text.includes(word)) return true;
    if (word.endsWith("ies")) return text.includes(word.slice(0, -3) + "y");
    if (word.endsWith("s")) return text.includes(word.slice(0, -1));
    return false;
  });
}

/** Ranks name hits above description-only hits for the live search panel. */
export function searchProducts(products: Product[], query: string, limit = 6): Product[] {
  if (!query.trim()) return [];
  const words = searchWords(query);
  return products
    .filter((p) => matchesQuery(p, query))
    .map((p) => ({
      p,
      score: words.filter((w) => p.name.toLowerCase().includes(w.replace(/s$/, ""))).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => p);
}
