// Base URL for the Campus Customs FastAPI backend (see hw4/backend/main.py).
// The backend runs locally on port 8000 during development.
export const API_BASE_URL = "http://localhost:8000";

export interface InventoryEntry {
  size: string;
  quantity: number;
}

export interface Product {
  product_id: string;
  name: string;
  garment_type: string;
  description: string;
  colors: string[];
  search_tags: string[];
  image_url: string;
  price: number;
  inventory?: InventoryEntry[];
}

function imageUrl(product: Pick<Product, "image_url">): string {
  return `${API_BASE_URL}${product.image_url}`;
}

// The header search, home page and Products page all need the catalogue;
// share one in-flight request instead of fetching it three times. A failed
// request is dropped from the cache so the next caller can retry.
let productsPromise: Promise<Product[]> | null = null;

export function fetchProducts(): Promise<Product[]> {
  if (!productsPromise) {
    productsPromise = fetch(`${API_BASE_URL}/api/products`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load products (status ${res.status})`);
        return res.json() as Promise<Product[]>;
      })
      .catch((err) => {
        productsPromise = null;
        throw err;
      });
  }
  return productsPromise;
}

/** Shared hook-friendly loader state for components that need the catalogue. */
export type LoadStatus = "loading" | "ready" | "error";

export async function fetchProduct(productId: string): Promise<Product> {
  const res = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(productId)}`);
  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error(`Failed to load product (status ${res.status})`);
  }
  return res.json();
}

export { imageUrl };
