# Putting Shopping Paradise For Deals online (demo)

This puts the prototype on a real public web address you can open on your
phone. It uses Render's free tier. Nothing is launched as a business here —
it is a private demo link for your review only.

## What you need

- A free Render account (render.com) — sign up with your email.
- A free GitHub account (github.com) — to hold the code.

## Steps (about 10 minutes)

1. **Put the code on GitHub.**
   - On github.com, create a new repository called
     `shopping-paradise-for-deals`. Make it private.
   - Click "uploading an existing file" and drag in the contents of the
     `spfd-deploy.zip` file Adam gave you (unzip it first). Commit.

2. **Deploy on Render.**
   - On dashboard.render.com, click New → Blueprint.
   - Connect your GitHub account and pick the
     `shopping-paradise-for-deals` repo.
   - Render reads `render.yaml` and fills everything in. Click
     "Apply". The first deploy takes a few minutes.

3. **Open your link.** Render gives you an address like
   `https://shopping-paradise-for-deals.onrender.com`. Open it on your
   phone and click through: storefront, Brand-Name Deals, cart, checkout,
   seller signup, admin.

## Demo logins

- Seller: `hello@northstarelec.ca` / `password123`
- Seller: `shop@maplehomegoods.ca` / `password123`
- Seller: `team@pacificactive.ca` / `password123`
- Admin page: `/admin` — protected with HTTP Basic Auth. Set strong
  `ADMIN_USER` / `ADMIN_PASS` values in the Render dashboard (never commit
  real credentials to the repo).

## Good to know

- The free tier sleeps after inactivity, so the first page load can take
  ~30 seconds to wake up. That is normal.
- Demo data resets when Render redeploys. Fine for review; a real launch
  would use a hosted database instead of the built-in file.
- When you are ready for real payments, your own Stripe account plugs into
  the existing demo-payments module — nothing else changes.

## Taking it down

Render dashboard → the service → Settings → "Delete service". The demo
link stops working immediately.
