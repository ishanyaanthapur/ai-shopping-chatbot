import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../api";
import { FREE_SHIPPING_THRESHOLD, useBag } from "./BagContext";
import "./BagDrawer.css";

export default function BagDrawer() {
  const { items, count, subtotal, isOpen, close, setQuantity, remove } = useBag();
  const [checkoutNote, setCheckoutNote] = useState(false);

  // Escape closes the drawer; body scroll is locked while it's open.
  useEffect(() => {
    if (!isOpen) {
      setCheckoutNote(false);
      return undefined;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close]);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <>
      <div
        className={`bag-scrim${isOpen ? " bag-scrim-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={`bag-drawer${isOpen ? " bag-drawer-open" : ""}`}
        aria-label="Shopping bag"
        aria-hidden={!isOpen}
      >
        <header className="bag-head">
          <h2>
            Your Bag <span className="bag-head-count">({count})</span>
          </h2>
          <button type="button" className="bag-close" onClick={close} aria-label="Close bag">
            ×
          </button>
        </header>

        {items.length > 0 && (
          <div className="bag-shipping">
            <p>
              {remaining > 0 ? (
                <>
                  You're <strong>${remaining.toFixed(2)}</strong> away from free shipping
                </>
              ) : (
                <>
                  <strong>Boola boola!</strong> You've unlocked free shipping
                </>
              )}
            </p>
            <div className="bag-shipping-track">
              <div className="bag-shipping-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="bag-empty">
            <span className="bag-empty-mark" aria-hidden="true">
              Y
            </span>
            <p>Your bag is empty.</p>
            <Link to="/products" className="btn" onClick={close}>
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="bag-items">
            {items.map((item) => (
              <li className="bag-item" key={`${item.productId}-${item.size}`}>
                <Link to={`/products/${item.productId}`} onClick={close} className="bag-item-img">
                  <img src={`${API_BASE_URL}${item.imageUrl}`} alt={item.name} />
                </Link>
                <div className="bag-item-info">
                  <Link to={`/products/${item.productId}`} onClick={close} className="bag-item-name">
                    {item.name}
                  </Link>
                  <span className="bag-item-size">Size {item.size}</span>
                  <div className="bag-item-row">
                    <div className="qty-stepper">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity(item.productId, item.size, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQuantity(item.productId, item.size, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="bag-item-price">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="bag-item-remove"
                    onClick={() => remove(item.productId, item.size)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <footer className="bag-foot">
            <div className="bag-subtotal">
              <span>Subtotal</span>
              <strong>${subtotal.toFixed(2)}</strong>
            </div>
            <p className="bag-foot-note">Taxes and shipping calculated at checkout.</p>
            <button type="button" className="btn bag-checkout" onClick={() => setCheckoutNote(true)}>
              Checkout
            </button>
            {checkoutNote && (
              <p className="bag-checkout-note" role="status">
                This is a demo storefront — checkout isn't connected yet. Your bag is saved on
                this device.
              </p>
            )}
            <button type="button" className="bag-continue" onClick={close}>
              Continue shopping
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
