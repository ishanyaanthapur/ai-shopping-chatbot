# Design

Problem 10 restyled Campus Customs as a collegiate-heritage storefront, using the original
[Yale Bulldog Blue](https://yalebulldogblue.com/) store as the reference: browse by garment
*and* by who you are (college, team, family, school).

## Visual identity

- **Yale Blue on limestone.** A warm paper background instead of stark white, so product
  photos read like mounted prints, with navy, a brass accent, and a secondary Yale blue.
- **Three typefaces.** A Caslon serif for headlines, a varsity block face (Graduate) for
  labels and the wordmark, and Inter for body text.
- **Gothic arches.** Hero, category tiles, the product gallery, and About frame products in
  arched "windows", a nod to Yale's collegiate-gothic architecture.
- **Campus details.** A felt-pennant wall for the residential colleges, a spinning
  "Boola Boola" seal, a chenille "Y" patch on the footer and chat launcher, polaroid-style
  family photos, and an athletics "scoreboard".
- **Clean photography.** 75 of 102 product photos had black backgrounds baked in (a
  transparent-PNG export bug). `backend/scripts/clean_product_images.py` repaints only the
  background connected to the edge of each photo white. The originals are kept, so the
  catalogue now looks consistent.

## How it helps customers find and buy

| Change | Why it helps |
|---|---|
| **Category nav** (Hoodies, Crewnecks, Tees, Quarter-Zips, Outerwear, Colleges, Athletics, Family, Schools) | Every product is two clicks away, and shoppers can browse the way the real store does |
| **Live search** with thumbnails and popular terms | Shoppers who know what they want ("saybrook", "dad hoodie") skip browsing entirely |
| **Collections** (`?collection=`, exact `?name=` for a college or team) | "Morse" or "Hockey" goes straight to the right gear without crewnecks showing up under rowing |
| **Rotating hero tied to real products** with a hang-tag price link | The first screen sells a specific item instead of just decorating the page |
| **Cleaner product cards**: type label, color swatches, collection badge, hover "Shop now" | Shoppers can scan 102 items faster, and the cards show color options before anyone clicks |
| **Product page**: size pills with live stock, low-stock dots, "Only N left", sold-out strike-through, cursor zoom, accordions | Choosing a size is the step before buying, so it is now the clearest thing on the page, and low stock nudges a decision |
| **Shopping bag**: slide-out drawer, quantity controls, free-shipping meter, saved across refreshes | The core storefront loop (pick, collect, see the total) exists now, and the meter encourages adding one more item |
| **"You might also like"** rail on every product | Shoppers keep browsing instead of hitting a dead end |
| **"Ask our assistant"** on product pages opens chat pre-filled with that product | Product questions get answered right where the purchase decision happens |
| **Chat**: markdown renders, Enter sends / Shift+Enter adds a newline, a branded launcher | Assistant replies are readable (bold names, lists), and the chat feels like part of the store |
| **Footer, breadcrumbs, sign-in ↔ create-account links** | Shoppers always know where they are and how to get back |
| **Responsive**: hamburger menu, collapsing filters, swipeable rails | The site works on the phone a student actually shops from |

## Notes

- Checkout is a demo. The bag works, but the Checkout button explains that payments aren't
  connected yet.
- The "free shipping over $75" and "campus pickup at 57 Broadway" lines are placeholder
  policy copy. The address comes from the original store.
