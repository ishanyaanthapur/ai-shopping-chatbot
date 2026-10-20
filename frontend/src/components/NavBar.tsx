import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useBag } from "../bag/BagContext";
import SearchOverlay from "./SearchOverlay";
import { BagIcon, MenuIcon, SearchIcon, UserIcon } from "./icons";
import "./NavBar.css";

const TICKER = [
  "Free shipping on orders $75+",
  "Campus pickup at 57 Broadway, New Haven",
  "Every style in sizes XS–XXL",
  "Questions? Our assistant — and real humans — are one click away",
  "Boola Boola!",
];

// Category nav mirrors how the original Bulldog Blue store is browsed:
// by garment first, then by who you're shopping for.
const CATEGORY_LINKS: { label: string; to: string }[] = [
  { label: "Shop All", to: "/products" },
  { label: "Hoodies", to: "/products?type=hoodies" },
  { label: "Crewnecks", to: "/products?type=crewnecks" },
  { label: "Tees", to: "/products?type=t-shirts" },
  { label: "Quarter-Zips", to: "/products?type=quarter-zips" },
  { label: "Outerwear", to: "/products?type=jackets" },
  { label: "Colleges", to: "/products?collection=colleges" },
  { label: "Athletics", to: "/products?collection=sports" },
  { label: "Family", to: "/products?collection=family" },
  { label: "Schools", to: "/products?collection=schools" },
];

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { count, open: openBag } = useBag();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  function isCategoryActive(to: string): boolean {
    const [path, query = ""] = to.split("?");
    if (location.pathname !== path) return false;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(location.search);
    if (!query) return !have.has("type") && !have.has("collection") && !have.has("q");
    return [...want.entries()].every(([k, v]) => have.get(k) === v);
  }

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <>
      <div className="ticker" aria-label="Store announcements">
        <div className="ticker-track">
          {[...TICKER, ...TICKER].map((msg, i) => (
            <span key={i} aria-hidden={i >= TICKER.length}>
              {msg}
              <span className="ticker-dot">✦</span>
            </span>
          ))}
        </div>
      </div>

      <header className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="container navbar-main">
          <div className="navbar-side">
            <button
              type="button"
              className="icon-btn navbar-menu-btn"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MenuIcon />
            </button>
            <button
              type="button"
              className="icon-btn navbar-search-btn"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
              <span className="navbar-search-label">Search</span>
            </button>
          </div>

          <Link to="/" className="brand" aria-label="Campus Customs home">
            <span className="brand-word">Campus Customs</span>
            <span className="brand-sub">
              <span className="brand-rule" />
              Yale Bulldog Blue · New Haven
              <span className="brand-rule" />
            </span>
          </Link>

          <div className="navbar-side navbar-side-right">
            {!loading && user ? (
              <div className="navbar-account">
                <span className="navbar-hello">Hi, {user.first_name || user.name}</span>
                <button type="button" className="navbar-text-btn" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            ) : (
              !loading && (
                <Link to="/login" className="icon-btn" aria-label="Sign in">
                  <UserIcon />
                  <span className="navbar-account-label">Sign in</span>
                </Link>
              )
            )}
            <button type="button" className="icon-btn bag-btn" onClick={openBag} aria-label={`Bag, ${count} items`}>
              <BagIcon />
              {count > 0 && <span className="bag-count">{count}</span>}
            </button>
          </div>
        </div>

        <nav className={`category-nav${menuOpen ? " category-nav-open" : ""}`} aria-label="Shop by category">
          <div className="container category-nav-inner">
            {CATEGORY_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={isCategoryActive(link.to) ? "active" : ""}
              >
                {link.label}
              </Link>
            ))}
            <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
              Our Story
            </NavLink>
          </div>
        </nav>
      </header>

      {searchOpen && <SearchOverlay onClose={closeSearch} />}
    </>
  );
}
