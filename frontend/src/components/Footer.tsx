import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-crest" aria-hidden="true">
        <span>Y</span>
      </div>
      <div className="container footer-grid">
        <div className="footer-brand">
          <span className="footer-word">Campus Customs</span>
          <p>
            Yale Bulldog Blue gear for students, alumni, and every Bulldog cheering from home.
          </p>
          <address>
            57 Broadway
            <br />
            New Haven, CT 06511
          </address>
        </div>

        <nav className="footer-col" aria-label="Shop">
          <h3>Shop</h3>
          <Link to="/products?type=hoodies">Hoodies</Link>
          <Link to="/products?type=crewnecks">Crewnecks</Link>
          <Link to="/products?type=t-shirts">Tees</Link>
          <Link to="/products?type=quarter-zips">Quarter-Zips</Link>
          <Link to="/products?type=jackets">Outerwear</Link>
        </nav>

        <nav className="footer-col" aria-label="Collections">
          <h3>Collections</h3>
          <Link to="/products?collection=colleges">Residential Colleges</Link>
          <Link to="/products?collection=sports">Bulldog Athletics</Link>
          <Link to="/products?collection=family">Bulldog Family</Link>
          <Link to="/products?collection=schools">Graduate &amp; Professional</Link>
        </nav>

        <nav className="footer-col" aria-label="Help">
          <h3>Help</h3>
          <Link to="/about">Our Story</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/create-account">Create account</Link>
          <span className="footer-note">Need a hand? Open the chat — a real person is a click away.</span>
        </nav>
      </div>
      <div className="container footer-base">
        <span>© {new Date().getFullYear()} Yale Bulldog Blue by Campus Customs</span>
        <span className="footer-boola">Boola Boola</span>
      </div>
    </footer>
  );
}
