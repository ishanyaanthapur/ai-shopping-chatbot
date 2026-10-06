import { useEffect, useState } from "react";
import { fetchProducts } from "../api";
import type { LoadStatus, Product } from "../api";

/** The full catalogue plus load status, backed by fetchProducts' shared cache. */
export function useProducts(): { products: Product[]; status: LoadStatus } {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;
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

  return { products, status };
}
