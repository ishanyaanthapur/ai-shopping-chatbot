# AI Prompts Log — HW4

## Problem 2 — Analyze the database

**Main prompt:**

I want to udnerstand the structure and contensts of campus_customs.db. Give me a useful summary of the fields of the table (if there are more than 10, then tell me so and only give me the most importnat 10 including catalogue, inventory, and users).

**Follow-up prompt(s):**

"ok i have many followups. i want to definitley understand catalogue, inventory, and users. so give me the breakdown of these tables' fields specifically. tell me broadly what each of the 5 tables is used for/can be used for."

**What was lacking:**

The prompt said "the fields of the table" (singular) but the database actually has 5 tables, so a follow-up was needed to get detailed per-field breakdowns of catalogue/inventory/users specifically.

---

## Problem 3 — Build the Campus Customs website

**Main prompt:**

Help me build a Campus Customs storefront using React + Vite + TypeScript. First inspect my existing project, product database, and image files so you can build on what is already there.
Design and vibe
Use https://yalebulldogblue.com/ as inspiration for the visual style and brand voice:

* Straightforward and approachable: Use a white background, simple navigation, and prominent shopping sections to create a familiar campus-store feel. Add warmth through relevant lifestyle photography when available.
* Preppy and collegiate: Use Yale blue and white, bold varsity-style lettering for key headings, and available Yale logos or university imagery to convey tradition and school pride. Keep body text clean and easy to read.
* The overall feeling should be casual, welcoming, cozy, and sporty—think fall on campus, comfortable sweatshirts, and game-day energy.
* Use generous spacing, clear product images, subtle borders, and Yale-blue buttons. Keep the layout easy to browse on both desktop and mobile.

Pages and navigation
Create a top navigation bar with working links to:

* Home
* Products
* About Us
* Log in
* Create account

Use consistent branding, navigation, and styling across the pages.
Home and About Us
Review the reference website for Campus Customs' tone and relevant information, but write original copy rather than copying its text. Emphasize campus community, Yale pride, and comfortable everyday merchandise. Avoid inventing company history or unsupported claims.
For Home, include a welcoming hero section, a clear "Shop Products" button, and a featured merchandise section using actual catalogue products. Use relevant lifestyle photography if available; otherwise, create a clean layout with existing product imagery.
For About Us, write a short, friendly introduction consistent with the campus-store identity.
Products page
Load products from the existing catalogue database. Use the image paths stored in the database rather than inventing image URLs or substituting unrelated products.
Display a responsive grid of clickable product cards, each showing:

* Product image
* Name
* Price
* Short description

Include loading, empty, and error states, plus a graceful fallback for missing images or information. Do not invent prices, sizes, or stock availability.
Individual product pages
Clicking a product card should open a dedicated page for that product. On desktop, show a large product image on one side and product details on the other. Stack these sections on mobile.
Include the product name, full description, price, and sizes or stock information when available in the database. Add an easy way to return to Products and handle invalid product URLs gracefully.
Log in and Create account
Create styled forms with clearly labeled fields and basic validation. Reuse existing authentication if the project already has it. Otherwise, keep these as clearly identified front-end placeholders without pretending that accounts are actually created or authenticated.
Chat interface
Add a floating chat interface in the bottom-right corner across the site. It should open and close, display messages, and include a text input and send button.
For now, implement a stub with a clearly identified placeholder response. Keep the message-handling function separate so it can connect to the agent backend later. Do not build the actual AI agent yet.
Backend and integration
If needed to access the database, create a small FastAPI app in `backend/main.py` to serve product data and images. Reuse the existing schema and make sure database image paths resolve correctly in the browser. Keep this backend simple so it can be extended for the agent in Problem 5.
Completion
Implement the working front end, verify navigation, catalogue loading, images, product detail pages, and the chat stub, and check the layout on desktop and mobile. Provide the commands needed to run the front end and backend, and briefly explain what you built and which features are still placeholders.

**Follow-up prompt(s):**

"i want to make the website more engaging and modern. I want a more interesting home page banner. can you brainstorm 5-6 banners it shoudl rotate through? also we can drastically improve the UI to make it more dynamic and enaging."

**What was lacking:**

The initial build was functionally complete but the spec's minimum ("welcoming hero section") led to a fairly plain static banner, so a follow-up was needed to make the home page and UI feel more dynamic/modern.

---

## Problem 4 — Create account and login

**Main prompt:**

Build working Create Account and Log In flows for my existing Campus Customs website, matching its current styling.

* Create Account: first name, last name, email, password, and confirm password. Validate inputs, check passwords match, and prevent duplicate emails.
* Save new accounts in the existing `users` table. Store passwords securely using salted password hashes, never plaintext.
* Log In: authenticate using email and password, with clear error messages for failed attempts.
* Keep users signed in across refreshes, show their name in the navigation, and add a working Log Out option.
* Connect the forms to the backend with secure session handling.

Verify login works for the seeded user (`test@campuscustoms.yale.edu`, password: `password`) and for a newly created account.
Update `output/harness.md` to explain what user data is stored, how passwords are protected, and how authentication works.

**Follow-up prompt(s):**

None needed — worked on the first try, including the seeded-user login check.

**What was lacking:**

Nothing significant; the prompt was fully specified (fields, validation rules, hashing requirement, session behavior, and a concrete test case to verify against).

---

## Problem 5 — PydanticAI agent backend

**Main prompt:**

Replace the chat stub with a real PydanticAI agent on the FastAPI backend, split across `backend/prompts/prompt.md` (system prompt — friendly voice, safety rules against leaking private info or inventing product details), `agent.py` (model/agent setup), `tools.py` (agent tools), `models.py` (structured reply/product-card types), and `main.py` (new chat endpoint alongside the existing product/auth routes). API key must load from a backend env var only. Keep it simple/extensible, verify a real end-to-end reply via the site, and update `output/harness.md` on the frontend↔backend communication and prompt/model loading. Backend still runs via `uvicorn main:app --reload --port 8000` from `backend/`.

**Follow-up prompt(s):**

None from the user — while verifying live in the browser I found the bot would claim to show products ("here are some hoodies...") while returning an empty product list for plural search terms, and fixed it myself before reporting the problem done.

**What was lacking:**

The initial implementation's catalogue search only matched the literal query string, so plural phrasing like "hoodies" missed the singular "hoodie" text in the DB and silently returned zero results, which the agent's reply text didn't reflect.

---

## Problem 6 — Tools: product info and stock

**Main prompt:**

Give the chatbot dedicated DB-backed tools (beyond the existing catalogue search) covering: a product's description and price, and its stock by size when the customer asks. Document in `prompts/prompt.md` when/why the agent should call each tool. Add/update the structured return types in `models.py` for these lookups. Add a new section to `output/harness.md` listing each tool, which model fields were chosen for the lookup results, and why. Hard rule: never invent product/price/stock info — always pull from the DB; if a requested size is out of stock, say so clearly and apologetically, and the agent may suggest a similar product.

**Follow-up prompt(s):**

None needed — worked on the first try, verified live with both a description/price question and an out-of-stock-size question.

**What was lacking:**

Nothing significant; the prompt specified the exact tool coverage, the hard no-invention rule, the out-of-stock tone, and where to document it (prompt.md, models.py, harness.md).

---

## Problem 7 — Chat search that updates the page

**Main prompt:**

Extend the chatbot so a product search done in chat also surfaces real product cards (image, name, price, short description) directly on the website page itself, not just described in chat text — reusing the existing chatbot/search tools and returning structured matches the frontend can render. Each surfaced card, including these new chat-driven ones, must open the same existing product detail view on click. Update `prompts/prompt.md` and `output/harness.md` to explain how search results get from chat to the page, and verify both the on-page update and that cards open the correct detail view. Then launch the site and share the link to test.

**Follow-up prompt(s):**

After testing, the user found that clicking a chat-search card did navigate correctly but looked broken (the persistent results banner stayed on top and the page didn't scroll, hiding the real detail page below the fold); separately, they asked that the detail page's "Back to Products" link return to the same filtered list from the chat search rather than the full catalog.

**What was lacking:**

The initial build didn't scroll to top on navigation or clear the banner on click (making working navigation look broken), and didn't preserve the chat search's result set for the "Back to Products" link to reuse. Fixed by adding a `ScrollToTop` route listener, splitting the chat-search context into persistent result data vs. a dismissible banner-visible flag, and having the Products page read `?from=chat` to filter down to the exact chat-returned products, with a "Show all products" reset.

---

## Problem 8 — Customer memory

**Main prompt:**

Give the chatbot persistent memory for logged-in customers, building on the existing login system and product tools. When logged in, save both the customer's messages and the bot's replies to a DB table tied to their account; restore that conversation on return/refresh; and actually use that history (not just display it) when generating replies. Make the logged-in customer's name/email available to the agent as context. Keep histories strictly separate per account, with no leakage across logout/account-switch. Also give the agent the current product page the customer is viewing, so ambiguous references like "do you have this in pink" resolve correctly via the real product tools; update that context on navigation, and have the agent ask a short clarifying question if no product context exists. Guests can still chat without persistence. Update `output/harness.md` on storage/restoration, what customer context the agent gets, and how page context is passed in. Verify: returning-user continuity, per-account isolation, correct product resolution, and guest chat still working — explained in plain language.

**Follow-up prompt(s):**

None from the user — while verifying live, I found that resuming a conversation with saved history made the agent ignore the current product page (and even the ground rules) and instead latch onto a different product mentioned earlier in that history. I diagnosed and fixed it myself before reporting the problem done.

**What was lacking:**

The initial implementation used PydanticAI's `system_prompt=`/`@agent.system_prompt`, which only gets (re-)applied on a conversation's first turn — once a returning customer's `message_history` was supplied, neither the ground rules nor the per-request customer/product context reached the model on any later turn. Fixed by switching both to PydanticAI's `instructions=`/`@agent.instructions` mechanism, which is recomputed on every single request regardless of history length.

---

## Problem 9 — Usability improvements

**Main prompt:**

Make four usability improvements to Campus Customs — two frontend, two agent/backend — and document all of them in a new `output/usability.md` explaining, for each, what was added or changed and why it helps a shopper or the business. Two were already built as follow-up fixes during earlier problems and just needed writing up: the frontend "Back to Products" link that returns to the filtered chat-search list, and the backend cleanup of three catalogue descriptions containing non-customer-facing stub text. For the new frontend improvement, add a product search/filter bar to the Products page modelled on the Quince shop layout — only filters the catalogue data can actually support, definitely including product type and a price range slider. For the new backend improvement, handle chat failures gracefully: when the agent can't answer, it should help the customer submit an email inquiry to a "Campus Customs Live Agent" (placeholder address `ishanya.anthapur@yale.edu`) using comforting language like *"I'm so sorry, I can't help you further. I'll connect you to a real human"*, and the whole experience should feel seamless. Note in `usability.md` that this one was chosen because the user has hit timeouts and API usage limits on their own vibecoded products and knows the risk is real — they don't want customers left feeling stuck, unhappy, or out of control.

**Follow-up prompt(s):**

Mid-build, the user added the documentation requirement explicitly: create and update `output/usability.md` before or as the improvements are implemented, documenting all four (including the two already made) with, for each, what was added or changed and why it helps a Campus Customs shopper or the business.

**What was lacking:**

Nothing was wrong with the work in progress — the follow-up pinned down the deliverable's format and timing, which the opening ask had left implicit. Separately, while verifying live I found that two filter checkboxes toggled within a single React batch would drop one of them, because each handler read a closed-over copy of `searchParams`; the updaters were switched to `setSearchParams`' functional form. (Real clicks commit a navigation between events, so this was never reachable by an actual shopper.)

---

## Problem 10 — Style the website

**Main prompt:**

Improve the website's UI and UX using the original Campus Customs store (yalebulldogblue.com) as inspiration, so it feels like a true Campus Customs storefront and a best-in-class e-commerce site — with extra credit for imaginative, creative design. Write a brief `output/design.md` explaining what changed and how it helps customers use the site and buy products.

**Follow-up prompt(s):**

**What was lacking:**

---

## Problem 11 — Site testing (app check)

**Main prompt:**

Test the live Campus Customs site and document it in `output/app_check.html` with three checks: (1) ask the chatbot about an item's stock and price and verify the answer against the database, (2) ask a category question like "What hoodies do you have?" and confirm matching product cards appear dynamically, and (3) demonstrate one Problem 9 usability improvement from `output/usability.md`. Each check gets a heading, a real screenshot from the live app saved in `output/app_check_images/` (relative paths), and 1–2 sentences on what it proves, with any failures reported honestly. Keep it clean and easy to grade, and verify the HTML opens correctly with all screenshots when double-clicked.

**Follow-up prompt(s):**

**What was lacking:**

---

## Problem 12 — Audit trail, safety, finish harness

**Main prompt:**

Finish the audit trail, safety rules and documentation for the existing Campus Customs agent. (1) Keep an append-only `output/audit_trail.json` of real agent-loop activity — timestamps, tool names, short argument/result summaries and why each run stopped — preserving earlier entries, staying valid JSON, and never logging passwords, API keys or unnecessary personal information. (2) Add practical safety rules to `prompts/prompt.md` (database facts only, don't invent missing information, protect customer data, reject bypass attempts or requests for another customer's data, stop gracefully on tool errors or loop limits) and make sure the running agent actually uses them. (3) Finish `output/harness.md` covering the `models.py` fields and why, the tools and abilities, the safety rules, loop limits / result caps / models, and how to run the frontend and backend. Reuse what exists, verify multiple runs preserve earlier audit entries, keep the docs accurate, and summarize what changed and was tested.

**Follow-up prompt(s):**

**What was lacking:**
