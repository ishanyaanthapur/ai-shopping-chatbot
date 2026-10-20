# Usability Improvements

Problem 9 asked for four usability improvements to Campus Customs — two on the
frontend and two on the agent/backend side. Two of them already existed as
follow-up fixes made while building earlier problems; this document writes those
up properly and adds two new ones.

| # | Side | Improvement | Status |
|---|------|-------------|--------|
| FE-1 | Frontend | Chat search results survive a round-trip into a product page | Shipped in Problem 7 |
| FE-2 | Frontend | Filter & sort sidebar on the Products page | New in Problem 9 |
| BE-1 | Backend / data | Removed non-customer-facing stub text from catalogue descriptions | Shipped after Problem 7 |
| BE-2 | Agent / backend | Graceful chat failure → handoff to a Campus Customs Live Agent | New in Problem 9 |

---

## FE-1 — Chat search results survive a round-trip into a product page

### What was added or changed

When the chatbot answers a product question, the matching items are rendered as
real `ProductCard`s on the page itself (the Problem 7 feature). The usability
problem was what happened *next*: clicking one of those cards took the shopper to
the product detail page, but the page didn't scroll to the top and the chat
results banner stayed pinned above it, so the detail page the shopper had just
asked for was below the fold. It looked like the click had done nothing. And the
"Back to Products" link on that detail page dumped them into the full 102-item
catalogue, throwing away the short, relevant list they had just asked the chatbot
to build for them.

Three changes fixed it:

- A `ScrollToTop` route listener (`src/components/ScrollToTop.tsx`) scrolls to the
  top of the document on every navigation.
- `ChatSearchContext` was split into *persistent result data* and a separate
  *banner-visible* flag, so clicking a card dismisses the banner without
  discarding the underlying result set.
- `ProductDetail.tsx` checks whether the product being viewed is one of the chat
  search's matches; if so its "Back to Products" link points at
  `/products?from=chat` instead of `/products`. `Products.tsx` reads that param
  and filters the grid down to exactly those product IDs — not a re-run keyword
  search — and shows a *"Showing results for your chat search: '…'"* banner with a
  "Show all products" button to escape back to the full catalogue.

### Why it helps a Campus Customs shopper or the business

Asking the chatbot "what do you have for my dad?" is only useful if the shopper
can then *browse* the answer. Before this fix, comparing two of the chatbot's
suggestions meant re-asking the chatbot every single time, because going back
destroyed the result set. Now the chat acts like a real search: narrow down,
drill in, come back, drill into the next one. That compare-two-things loop is
where purchase decisions actually get made, so protecting it directly protects
conversions — and it makes the chatbot feel like a trustworthy part of the store
rather than a gimmick bolted onto the corner of the page.

---

## FE-2 — Filter & sort sidebar on the Products page

### What was added or changed

The Products page rendered all 102 items in one flat, unsorted grid. The only
filtering that existed was a `?tag=` URL parameter with no UI to set it, or going
through the chatbot — a shopper looking at the page had no visible way to narrow
anything down.

Modelled on the Quince shop page layout, the Products page now has a left
filter sidebar plus a sort control, with only the facets this catalogue can
actually support:

- **Product type** — the `catalogue.garment_type` column holds 22 near-duplicate
  free-text values (`short-sleeve t-shirt`, `short-sleeve T-shirt`, `t-shirt`,
  `heavyweight short-sleeve t-shirt`, …). A `categorize()` helper normalizes those
  into six shopper-facing categories — T-Shirts (25), Crewnecks (29), Hoodies
  (27), Quarter-Zips (11), Jackets (8), Long-Sleeve & Performance (2).
- **Color** — `catalogue.colors` is a JSON array with the same problem
  (`navy blue` vs `navy`, `heather gray` vs `gray` vs `dark heather charcoal`),
  normalized into eight swatch options.
- **Price** — a dual-handle range slider bounded by the real catalogue min/max
  ($32–$98) rather than invented brackets.
- **Sort by** — Featured (A–Z), Price: Low to High, Price: High to Low.
- A live **result count**, removable **active-filter pills**, and a **Clear all**
  control; filters are written into the URL so a filtered view is shareable and
  survives the browser back button. On narrow screens the sidebar collapses into a
  "Filters" toggle.

Every facet is derived from the live catalogue at render time, so the counts are
always accurate and categories with zero products never appear.

### Why it helps a Campus Customs shopper or the business

102 products is past the point where scrolling is a search strategy. A shopper who
wants "a hoodie under $60" had to eyeball the entire grid; now it's two clicks and
a slider drag. Normalizing the messy `garment_type` and `colors` values matters as
much as the UI does — without it the filter list would show "hoodie", "pullover
hoodie", "hooded sweatshirt" and "full-zip hooded sweatshirt" as four separate
options, which is worse than no filter at all because it hides products from
shoppers who picked the "wrong" synonym. Putting the filter state in the URL means
a student can send a friend a link to "navy crewnecks under $70" instead of
describing it, which is free word-of-mouth traffic for the store.

---

## BE-1 — Removed non-customer-facing stub text from catalogue descriptions

### What was added or changed

Three rows in the `catalogue` table had placeholder descriptions containing
literal "vision blocked" stub text — artifacts of how the catalogue data was
originally generated, not anything a customer should ever read. They were
rewritten by hand into real product descriptions in the same voice as the rest of
the catalogue. The shortest description in the table is now 93 characters, and no
row matches `%vision%` or `%blocked%`.

### Why it helps a Campus Customs shopper or the business

This is a backend fix with two separate blast radii, which is what makes it worth
doing. On the storefront, those three product pages were showing shoppers internal
tooling noise — the single fastest way to make a store look abandoned or fake, on
exactly the screen where someone is deciding whether to spend $60.

The bigger problem was the chatbot. The agent's `search_products` and
`get_product_details` tools read `description` straight from this table, and the
system prompt forbids inventing product information — so the agent was faithfully
relaying "vision blocked" to customers as if it were a product feature, with no
way to know better. Fixing the data fixed the agent too. Garbage in a column the
agent is explicitly told to trust is worse than garbage on a page, because it
propagates into conversations the business can't see.

---

## BE-2 — Graceful chat failure → handoff to a Campus Customs Live Agent

### What was added or changed

`POST /api/chat` had no failure path. If the call to the model timed out, hit a
rate limit, or errored for any other reason, FastAPI returned a raw 500, the
frontend's `catch` block fired, and the shopper got a red bubble reading
*"Something went wrong — please try again."* — a dead end with no next step.

The endpoint now wraps the agent call in a timeout and a broad exception handler
and, instead of a 500, returns a normal `200` `ChatReply` carrying a new
`handoff` field (`LiveAgentHandoff` in `models.py`). When that field is present:

- The assistant's reply switches to apologetic, in-control language — *"I'm so
  sorry, I'm not able to help you further right now. Let me connect you with a
  real person on our team."*
- The chat renders an inline handoff card for the **Campus Customs Live Agent**
  (`ishanya.anthapur@yale.edu`), pre-filled with the shopper's name and email if
  they're logged in and with the question they just asked as the message body, so
  there is nothing to retype.
- Submitting it posts to a new `POST /api/support/inquiry` endpoint, which writes
  the inquiry to a `support_inquiries` table and returns a reference number the
  shopper can quote. The confirmation appears in the chat thread itself.
- A plain `mailto:` link is offered alongside it as a last-resort escape hatch, so
  even if the backend is completely unreachable (the frontend synthesizes the same
  handoff card locally when the `fetch` itself throws) the shopper still leaves
  with a working way to contact a human.

### Why it helps a Campus Customs shopper or the business

I specifically wanted this one because I've hit timeouts and run out of API usage
limits on my own vibecoded products, so I know first-hand that this failure is not
hypothetical — it *will* happen, usually without warning, and usually to someone
who was in the middle of something. What stuck with me is how it feels on the
other side: you're mid-question, the thing stops answering, and there's no
indication whether it's broken, whether you did something wrong, or what you're
supposed to do now. I didn't want Campus Customs customers left feeling stuck,
unhappy, or out of control.

So the goal here isn't to hide the failure — it's to make sure the shopper never
loses control of their own task. The apology is explicit, the next step is
pre-filled and one click away, and the reference number gives them something
concrete to hold onto. For the business, the payoff is that an outage stops being
a silently lost customer and becomes a captured lead sitting in a table with the
question they were already asking — which is a far better outcome than a red error
bubble that quietly costs a sale nobody ever finds out about.
