// Client-side shopping bag, persisted to localStorage so it survives a
// refresh. There is no order/payment backend yet — this exists so shoppers
// can collect the pieces they want (size included) and see a running total,
// which is the core loop of any storefront.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface BagItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  size: string;
  quantity: number;
}

interface BagContextValue {
  items: BagItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  lastAdded: BagItem | null;
  open: () => void;
  close: () => void;
  add: (item: Omit<BagItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, size: string, quantity: number) => void;
  remove: (productId: string, size: string) => void;
}

const STORAGE_KEY = "campus-customs-bag";
export const FREE_SHIPPING_THRESHOLD = 75;

const BagContext = createContext<BagContextValue | null>(null);

function loadBag(): BagItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BagItem[]>(loadBag);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<BagItem | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: Omit<BagItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId && i.size === item.size);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { ...item, quantity }];
    });
    setLastAdded({ ...item, quantity });
    setIsOpen(true);
  }, []);

  const setQuantity = useCallback((productId: string, size: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => !(i.productId === productId && i.size === size))
        : prev.map((i) =>
            i.productId === productId && i.size === size ? { ...i, quantity } : i,
          ),
    );
  }, []);

  const remove = useCallback((productId: string, size: string) => {
    setItems((prev) => prev.filter((i) => !(i.productId === productId && i.size === size)));
  }, []);

  const value = useMemo<BagContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      isOpen,
      lastAdded,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQuantity,
      remove,
    }),
    [items, isOpen, lastAdded, add, setQuantity, remove],
  );

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagContextValue {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used inside <BagProvider>");
  return ctx;
}
