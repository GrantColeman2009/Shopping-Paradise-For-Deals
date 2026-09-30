# Shopping Paradise For Deals — prototype (all phases: storefront, sellers, security, support)

A working demo marketplace: sellers list products, buyers shop with a cart
and demo checkout, sellers manage products and see fees, and an admin view
shows platform stats. **No real payments are processed.**

## Run it

```bash
npm install
npm run seed   # creates marketplace.db with 3 sellers, 12 products, 8 deals
npm start      # serves on http://localhost:3000
```

Demo seller logins (password for all three): `password123`
- hello@northstarelec.ca (NorthStar Electronics)
- shop@maplehomegoods.ca (Maple Home Goods)
- team@pacificactive.ca (Pacific Activewear)

## What is in the prototype

- Storefront: homepage, product catalogue, search, category filters,
  product pages, session cart, demo checkout, order confirmation.
- **Brand-Name Deals** (`/deals`): affiliate-style deal cards with an
  "Affiliate pick" badge and Associates disclosure. Links are placeholders
  until the owner's Amazon Associates account is connected; the tag ID is
  editable on the admin page.
- **Reviews:** buyers can leave a 1–5 star rating and comment on any
  product; average rating shown on the product page.
- **Seller order management:** sellers see orders containing their
  products and can mark them pending / shipped / delivered. Sellers can
  only touch their own orders.
- **Admin** (`/admin`): orders, gross volume, fees, seller count, revenue
  by month, top sellers, deals management, Associates tag setting, and the
  seller payout schedule (14th and 28th of each month, 10:00 AM PST, with
  the next payout date computed automatically).
- Pricing page, seller sign-up/login, seller dashboard with product
  create/edit/delete and fee views.
- **Country of origin, front and centre:** the platform carries a "100%
  Canadian Owned & Operated" badge in the header, footer, and homepage
  hero. Every seller picks their home country at sign-up, and every
  product lists where it was made ("Made in …" dropdown, defaulting to the
  seller's country — a Canadian company can sell a product made anywhere).
  Product cards show compact badges ("🍁 Canadian company",
  "🇨🇦 Made in Canada", "Made in 🇨🇳 China", …) and product pages show a
  full origin panel — all visible *before* purchase. The admin sellers
  list shows each seller's home country.
- **SEO basics:** meta descriptions and Open Graph tags on every page
  (product pages include their image), plus `/sitemap.xml` and
  `/robots.txt`.

## Security (all free, no paid services)

- **helmet** — secure HTTP headers, with a tuned Content Security Policy
  (external images allowed; inline `onsubmit` confirm dialogs permitted).
- **express-rate-limit** — a generous global limit plus stricter limits on
  seller login (10 attempts / 15 min), review submission
  (30 / hour), and support endpoints (60 / hour), guarding against
  brute-force and spam.
- **CSRF protection** (`csrf-csrf`, double-submit cookie pattern) — every
  POST form carries a token; token-less or forged posts get a 403.
- **Session cookie hardening** — `httpOnly`, `SameSite=Lax`, and the
  `Secure` flag automatically enabled in production (`NODE_ENV=production`).
- **Output escaping** — all user-supplied content renders through EJS
  `<%= %>` (escaped); no raw `<%- %>` output of user data anywhere.
- Passwords are hashed with bcrypt. Note: this is still a demo — before a
  real launch, add an admin login, move secrets into a proper secret
  store, and put the database on a hosted service instead of a file.

## Deploying the demo online

See `DEPLOY.md` for the one-click Render deploy (free tier). A
`Dockerfile` and `render.yaml` blueprint are included.

## Business rules (as approved)

- Seller pricing: **$14/month** subscription (stored as a status field, no
  real billing) + **4% per-sale marketplace fee**, taken from the seller's
  proceeds — never added to the buyer's price.
- **FREE shipping:** sellers enter item price + estimated shipping cost
  separately. Buyers always see ONE combined price with a "FREE shipping"
  badge. Shipping is never shown as a separate buyer-facing charge.
- **Shipping carriers:** sellers choose how they ship each product —
  **Canada Post, UPS, or Purolator**. The carrier is shown to shoppers on
  the product page and in the cart before they buy.
- All prices in CAD.

## Going live with Stripe later

`lib/payments.js` exports `charge({ amountCents, currency, orderId,
buyerEmail })`. With no `STRIPE_SECRET_KEY` set it runs in demo mode and
just logs. To accept real payments later:

1. Create your own Stripe account and get a **secret key**.
2. `export STRIPE_SECRET_KEY=sk_live_...` before starting the server.
3. The `stripe` npm package is already a dependency but is only `require()`d
   when the key exists, so demo mode needs no Stripe account.

You will also need, before any public launch: business registration, terms
of service, a privacy policy, tax handling, and real seller payouts through
your own Stripe/bank setup. None of that is in this prototype.

## Support (AI-only, all free)

- **Help centre** (`/help`) — plain-language FAQs for buyers and sellers.
- **AI support assistant** — floating Help button on every page, backed by
  `POST /api/assistant`. It is rule-based (keyword intents, no paid APIs)
  and is always labelled "AI — automated, not a human" in the UI.
  It handles common issues: order tracking, free shipping, returns,
  selling, fees, payouts, country labels. Payment-dispute language
  triggers an escalation reply pointing the visitor at a ticket.
- **Support tickets** (`/support/new`) — stored in SQLite. Category
  "Payment dispute" is automatically flagged `needs-owner` and sorted
  first in the admin view with a highlight, so the marketplace owner
  reviews it personally. Visitors can check status at `/support/status`
  with their ticket number + email.
- **Admin** (`/admin`) — ticket queue with status workflow
  (open → needs-owner → answered → closed) and internal notes.

## Routes

- `/` homepage · `/products` shop + search/filter · `/products/:id` detail
- `/cart`, `/checkout`, `/orders/:id`
- `/help` help centre · `/support/new` file a ticket · `/support/status` check a ticket
- `POST /api/assistant` AI assistant (JSON, CSRF-protected)
- `/seller/signup`, `/seller/login`, `/seller/dashboard`,
  `/seller/products/new`, `/seller/products/:id/edit`
- `/pricing` seller pricing explainer · `/admin` platform stats
