/**
 * Payments module — DEMO mode by default.
 *
 * charge({ amountCents, currency, orderId, buyerEmail })
 *   -> { success: true, demo: true, id: 'demo_...' }
 *
 * To go live later: set STRIPE_SECRET_KEY in the environment and install
 * your own Stripe account keys. The stripe SDK is only required when the
 * key exists, so demo mode has zero external dependencies.
 */
async function charge({ amountCents, currency = 'cad', orderId, buyerEmail }) {
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      description: `Shopping Paradise For Deals — order #${orderId}`,
      receipt_email: buyerEmail,
      metadata: { order_id: String(orderId), platform: 'shopping-paradise-for-deals' },
    });
    return { success: true, demo: false, id: intent.id };
  }

  // Demo mode: no real money moves.
  const id = 'demo_' + Date.now().toString(36);
  console.log(`[payments:demo] charged ${amountCents} ${currency} for order #${orderId} (${buyerEmail}) -> ${id}`);
  return { success: true, demo: true, id };
}

module.exports = { charge };
