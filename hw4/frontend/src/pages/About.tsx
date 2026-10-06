import { Link } from "react-router-dom";
import { imageUrl } from "../api";
import { useInView } from "../hooks/useInView";
import { useProducts } from "../hooks/useProducts";
import "./About.css";

export default function About() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const { products } = useProducts();
  const cover = products.find((p) => p.product_id === "t-felt-y-heavyweight") ?? products[0];

  return (
    <div className="about-page">
      <div ref={ref} className={`container about-hero reveal${inView ? " reveal-visible" : ""}`}>
        <div className="about-copy">
          <span className="eyebrow">Our story</span>
          <h1>A little corner of campus, stitched in Yale Blue.</h1>
          <p className="about-lede">
            Campus Customs is here for the walk to class on a cold morning, the crowd at The Game,
            and the quiet Sunday spent studying in a well-worn sweatshirt.
          </p>
          <p>
            We put together pieces that feel like they belong on campus: soft crewnecks, cozy
            hoodies and classic tees that carry a bit of Bulldog pride wherever you go. Whether
            you're a student, an alum, or a parent visiting for the weekend, we hope you find
            something that feels like home.
          </p>
          <p className="about-sign">Thanks for stopping by — and go Bulldogs.</p>
        </div>
        <div className="about-visual">
          <div className="arch about-arch">{cover && <img src={imageUrl(cover)} alt="" />}</div>
        </div>
      </div>

      <div className="container about-values">
        <div>
          <span className="about-num">01</span>
          <h3>Made for campus life</h3>
          <p>Heavyweight fleece and soft tees chosen to survive four New Haven winters.</p>
        </div>
        <div>
          <span className="about-num">02</span>
          <h3>Every college, every team</h3>
          <p>Residential college crests, varsity sports and grad schools — not just the big Y.</p>
        </div>
        <div>
          <span className="about-num">03</span>
          <h3>Real people, close by</h3>
          <p>57 Broadway, New Haven — and a real person on the other end of the chat.</p>
        </div>
      </div>

      <div className="container about-cta">
        <Link to="/products" className="btn">
          Shop the collection
        </Link>
      </div>
    </div>
  );
}
