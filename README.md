# Shopping Paradise For Deals — prototype (Phase 1 + Phase 2)

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

## Routes

- `/` homepage · `/products` shop + search/filter · `/products/:id` detail
- `/cart`, `/checkout`, `/orders/:id`
- `/seller/signup`, `/seller/login`, `/seller/dashboard`,
  `/seller/products/new`, `/seller/products/:id/edit`
- `/pricing` seller pricing explainer · `/admin` platform stats
