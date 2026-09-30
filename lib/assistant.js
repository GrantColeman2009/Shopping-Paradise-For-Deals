// Rule-based support assistant brain. No paid APIs, no network calls:
// it matches the visitor's message against intents and returns a canned,
// plain-language answer. It is ALWAYS presented to visitors as an AI
// assistant, never as a human.
const INTENTS = [
  {
    id: 'greeting',
    match: /\b(hi|hello|hey|good (morning|afternoon|evening))\b/,
    reply:
      "Hello! I'm the Shopping Paradise For Deals AI assistant. I can help with orders, shipping, returns, selling on the marketplace, fees, and payouts. What's going on?",
    followups: ['Where is my order?', 'How does free shipping work?', 'How do I sell on here?'],
  },
  {
    id: 'payment_dispute',
    match: /\b(dispute|charged twice|double charg|unauthori[sz]ed|fraud|didn'?t (get|receive).*(paid|charged)|paid.*(didn'?t|never).*(get|receive|arrive))\b/,
    escalate: true,
    reply:
      "I'm sorry — a problem with a payment is something I can't fix myself. I've marked payment disputes for the marketplace owner to review personally. Please file a support ticket below and choose \"Payment dispute\" so the owner sees it right away. Include your order number and what happened.",
    followups: ['File a support ticket'],
  },
  {
    id: 'order_status',
    match: /\b(where.*(order|package)|track|tracking|order status|has.*(shipped|arrived)|delivery)\b/,
    reply:
      "You can check your order any time: sellers update the status (paid → shipped → delivered) as they pack and send it. If you have your order number from checkout, keep it handy — and if the status hasn't moved in a few days, file a support ticket with the order number and we'll chase it up.",
    followups: ['File a support ticket', 'What is your returns policy?'],
  },
  {
    id: 'shipping',
    match: /\b(ship|delivery|postage|free shipping)\b/,
    reply:
      "Every price you see already includes shipping — there are no extra charges at checkout, ever. Sellers build the shipping cost into the one price you pay, and you'll see a FREE shipping badge on every product.",
    followups: ['Where is my order?', 'What do the country labels mean?'],
  },
  {
    id: 'returns',
    match: /\b(return|refund|exchange|send (it )?back|money back)\b/,
    reply:
      "If something arrives damaged, wrong, or not as described, you're covered. Start by filing a support ticket with your order number — if the seller can't make it right, payment disputes go to the marketplace owner for a final decision.",
    followups: ['File a support ticket'],
  },
  {
    id: 'sell',
    match: /\b(sell|seller|become.*vendor|open.*(shop|store)|list.*product)\b/,
    reply:
      "Selling is three steps: 1) create a seller account, 2) add your products (you set the price and the shipping cost separately — buyers see one combined price), 3) get paid on the 14th and 28th of each month. Start at the Seller sign-up page.",
    followups: ['What are the seller fees?', 'When do sellers get paid?'],
  },
  {
    id: 'fees',
    match: /\b(fee|cost.*sell|how much|commission|subscription|14 ?\$|\$14)\b/,
    reply:
      "Sellers pay $14 per month plus 4% of each sale. That's it — no listing fees, no hidden charges. Buyers never pay any fee.",
    followups: ['When do sellers get paid?', 'How do I sell on here?'],
  },
  {
    id: 'payouts',
    match: /\b(pay ?out|payout|when.*paid|get paid|14th|28th)\b/,
    reply:
      "Sellers get paid twice a month — on the 14th and the 28th. Your dashboard shows your sales, the 4% marketplace fee on each sale, and totals any time.",
    followups: ['What are the seller fees?', 'How do I sell on here?'],
  },
  {
    id: 'countries',
    match: /\b(canada|canadian|made in|country|countries|flag|owned)\b/,
    reply:
      "Shopping Paradise For Deals is 100% Canadian owned and operated. Sellers from around the world are welcome, and every listing shows two things before you buy: the seller's home country (e.g. \"Canadian company\") and where the product was made (e.g. \"Made in Vietnam\").",
    followups: ['How does free shipping work?'],
  },
  {
    id: 'deals',
    match: /\b(deal|brand|amazon|affiliate)\b/,
    reply:
      "The Brand-Name Deals section collects notable deals on well-known brands in one place. Some links may earn the marketplace a small affiliate commission at no extra cost to you.",
    followups: [],
  },
  {
    id: 'human',
    match: /\b(human|real person|someone real|owner|contact|email|phone|speak to|talk to)\b/,
    reply:
      "I'm an AI assistant, so I can't bring a human to the chat. But every support ticket is read by the team, and payment disputes go directly to the marketplace owner. File a ticket and you'll get a real reply.",
    followups: ['File a support ticket'],
  },
  {
    id: 'account',
    match: /\b(password|log ?in|sign ?in|account|can'?t.*(access|enter))\b/,
    reply:
      "For seller account trouble: use the Seller login page, and make sure you're using the email you signed up with. If you're locked out, file a support ticket with your account email and we'll help.",
    followups: ['File a support ticket'],
  },
];

const FALLBACK = {
  reply:
    "I'm not sure I understood — I'm a simple automated assistant. Try asking about orders, shipping, returns, selling, fees, or payouts. Or file a support ticket and a real person will get back to you.",
  followups: ['Where is my order?', 'How do I sell on here?', 'File a support ticket'],
};

function answer(message) {
  const text = String(message || '').toLowerCase();
  for (const intent of INTENTS) {
    if (intent.match.test(text)) {
      return {
        intent: intent.id,
        reply: intent.reply,
        followups: intent.followups || [],
        escalate: !!intent.escalate,
      };
    }
  }
  return { intent: 'fallback', reply: FALLBACK.reply, followups: FALLBACK.followups, escalate: false };
}

module.exports = { answer, INTENTS };
