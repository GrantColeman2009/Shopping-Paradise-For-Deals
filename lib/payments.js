/**
 * Payments module — Stripe Checkout Sessions when STRIPE_SECRET_KEY is set,
 * demo mode otherwise (no real money moves).
 *
 * Live flow:
 *   1. POST /checkout creates a pending order, then createCheckoutSession()
 *      builds a Stripe-hosted payment page and the buyer is redirected to it.
 *   2. Stripe redirects back to /checkout/success?session_id=... — we verify
 *      payment_status === 'paid' via the API before marking the order paid.
 *   3. POST /webhooks/stripe (signature-verified) marks orders paid even if
 *      the buyer closes the tab before the redirect. Stock is decremented
 *      only when an order flips pending -> paid, and the flip is idempotent.
 *
 * Test mode: use an sk_test_... key and card 4242 4242 4242 4242.
 */

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

function isLive() {
  return !!process.env.STRIPE_SECRET_KEY;
}

function isTestMode() {
  return isLive() && process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
}

// "live" | "test" | "demo" — for views and status messaging.
function mode() {
  if (!isLive()) return 'demo';
  return isTestMode() ? 'test' : 'live';
}

async function createCheckoutSession({ items, orderId, buyerEmail, successUrl, cancelUrl }) {
  const stripe = stripeClient();
  if (!stripe) return null;
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: buyerEmail,
    line_items: items.map((i) => ({
      price_data: {
        currency: 'cad',
        product_data: { name: i.name },
        unit_amount: i.unit, // cents; shipping is baked into the price
      },
      quantity: i.qty,
    })),
    metadata: { order_id: String(orderId), platform: 'shopping-paradise-for-deals' },
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
  });
}

async function retrieveSession(sessionId) {
  const stripe = stripeClient();
  if (!stripe || !sessionId) return null;
  return stripe.checkout.sessions.retrieve(sessionId);
}

// Throws on bad signature; returns null when webhooks aren't configured.
function verifyWebhookSignature(rawBody, signature) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return null;
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// Demo-mode stand-in: pretends the charge succeeded.
async function demoCharge({ amountCents, currency = 'cad', orderId, buyerEmail }) {
  const id = 'demo_' + Date.now().toString(36);
  console.log(`[payments:demo] charged ${amountCents} ${currency} for order #${orderId} (${buyerEmail}) -> ${id}`);
  return { success: true, demo: true, id };
}

module.exports = {
  isLive,
  isTestMode,
  mode,
  createCheckoutSession,
  retrieveSession,
  verifyWebhookSignature,
  demoCharge,
};
