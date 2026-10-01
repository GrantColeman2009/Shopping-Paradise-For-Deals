const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');
const db = require('./db');
const payments = require('./lib/payments');
const { answer: assistantAnswer } = require('./lib/assistant');
const { COUNTRIES, countryName, flagOf, isValidCountry } = require('./lib/countries');

const app = express();
const PORT = process.env.PORT || 3000;
const FEE_RATE = 0.04; // 4% marketplace fee per sale
const IS_PROD = process.env.NODE_ENV === 'production';

// Shipping carriers sellers can ship with (buyer-facing labels).
const SHIPPING_CARRIERS = {
  canada_post: 'Canada Post',
  ups: 'UPS',
  purolator: 'Purolator',
};
const carrierName = (code) => SHIPPING_CARRIERS[code] || SHIPPING_CARRIERS.canada_post;

// Behind Render / any reverse proxy, so rate limiting sees the real client IP
// and secure cookies work.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers. CSP is tuned so the site's own behavior keeps working:
// picsum images, and the inline onsubmit confirm() dialogs.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'script-src': ["'self'"],
        'script-src-attr': ["'unsafe-inline'"], // onsubmit confirm dialogs only
      },
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Stripe webhook: registered before express.json() and CSRF protection because
// signature verification needs the raw request body. No session/CSRF needed —
// the Stripe signature is the authentication.
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = payments.verifyWebhookSignature(req.body, sig);
  } catch (err) {
    console.error('stripe webhook: bad signature:', err.message);
    return res.status(400).send('bad signature');
  }
  if (!event) return res.status(200).send('webhook not configured');
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata && Number(session.metadata.order_id);
    if (orderId && session.payment_status === 'paid') markOrderPaid(orderId);
  }
  res.status(200).send('ok');
});

app.use(express.json({ limit: '16kb' })); // support-assistant API posts JSON
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'spfd-prototype-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD, // HTTPS only in production
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ---- rate limiting (free, in-memory) ----
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // generous for normal browsing
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts — please wait 15 minutes and try again.',
  standardHeaders: true,
  legacyHeaders: false,
});
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many reviews submitted — please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60, // tickets + assistant messages per hour per IP
  message: 'Too many support requests — please wait a while and try again.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ---- CSRF protection (double-submit cookie, no server state) ----
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'spfd-csrf-secret-change-in-prod',
  getSessionIdentifier: (req) => req.sessionID, // bind tokens to the session
  cookieName: 'spfd.csrf',
  cookieOptions: { httpOnly: true, sameSite: 'lax', secure: IS_PROD },
  getCsrfTokenFromRequest: (req) =>
    (req.body && req.body._csrf) || req.headers['x-csrf-token'],
});

// ---- shared helpers ----
const fmt = (cents) => '$' + (cents / 100).toFixed(2);
app.locals.fmt = fmt;
const buyerPrice = (p) => p.price_cents + p.shipping_cost_cents;

const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
};

// Build an affiliate URL, appending the Associates tag when the URL is real.
const affiliateLink = (deal) => {
  if (!deal.affiliate_url || deal.affiliate_url === '#') return '#';
  const tag = getSetting('amazon_tag');
  const sep = deal.affiliate_url.includes('?') ? '&' : '?';
  return `${deal.affiliate_url}${sep}tag=${encodeURIComponent(tag)}`;
};

// ---- payout schedule: 14th and 28th of each month, 10:00 AM America/Vancouver ----
function vancouverOffsetMs(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return asUTC - date.getTime();
}

// Instant of 10:00 AM on a given Y/M/D in America/Vancouver.
function vancouverTimeAt(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess - vancouverOffsetMs(new Date(guess)));
}

function nextPayoutDate() {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Vancouver', year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(now).map((p) => [p.type, +p.value])
  );
  const c14 = vancouverTimeAt(parts.year, parts.month, 14, 10, 0);
  const c28 = vancouverTimeAt(parts.year, parts.month, 28, 10, 0);
  if (now < c14) return c14;
  if (now < c28) return c28;
  const nm = parts.month === 12 ? 1 : parts.month + 1;
  const ny = parts.month === 12 ? parts.year + 1 : parts.year;
  return vancouverTimeAt(ny, nm, 14, 10, 0);
}

const fmtPayout = (d) =>
  d.toLocaleString('en-CA', {
    timeZone: 'America/Vancouver', weekday: 'long', year: 'numeric',
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short',
  });

app.use((req, res, next) => {
  res.locals.seller = req.session.sellerId
    ? db.prepare('SELECT id, business_name, email, subscription_status, country_code FROM sellers WHERE id = ?').get(req.session.sellerId)
    : null;
  const cart = req.session.cart || {};
  res.locals.cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  // Country helpers + CSRF token available in every view.
  res.locals.countries = COUNTRIES;
  res.locals.countryName = countryName;
  res.locals.flagOf = flagOf;
  res.locals.shippingCarriers = SHIPPING_CARRIERS;
  res.locals.carrierName = carrierName;
  // The CSRF token is bound to the session ID, so make sure a session
  // exists before generating it (otherwise the ID rotates per request).
  if (!req.session.csrfInit) req.session.csrfInit = 1;
  res.locals.csrfToken = generateCsrfToken(req, res);
  res.locals.stripeMode = payments.mode(); // 'live' | 'test' | 'demo'
  next();
});

// CSRF check on every unsafe request (GET/HEAD/OPTIONS pass through).
app.use(doubleCsrfProtection);

function getCart(req) {
  if (!req.session.cart) req.session.cart = {};
  return req.session.cart;
}

// Returns { items: [...], subtotal } with buyer-facing unit prices.
function cartDetails(cart) {
  const ids = Object.keys(cart);
  if (ids.length === 0) return { items: [], subtotal: 0 };
  const rows = db
    .prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids);
  const items = rows.map((p) => ({
    ...p,
    qty: cart[p.id],
    unit: buyerPrice(p),
  }));
  const subtotal = items.reduce((s, i) => s + i.unit * i.qty, 0);
  return { items, subtotal };
}

// Flips a pending order to paid and decrements stock. Idempotent: only acts
// when the order is still pending, so the success redirect and the Stripe
// webhook can both call it safely.
function markOrderPaid(orderId) {
  return db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o || o.status !== 'pending') return false;
    db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
    const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const it of db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId)) {
      dec.run(it.qty, it.product_id);
    }
    return true;
  })();
}

function requireSeller(req, res, next) {
  if (!req.session.sellerId) return res.redirect('/seller/login');
  next();
}

function sellerProduct(req, id) {
  return db
    .prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?')
    .get(id, req.session.sellerId);
}

// ---- storefront ----
app.get('/', (req, res) => {
  const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category);
  const featured = db
    .prepare('SELECT p.*, s.business_name, s.country_code AS seller_country FROM products p JOIN sellers s ON s.id = p.seller_id ORDER BY p.id LIMIT 8')
    .all();
  res.render('index', {
    featured, categories,
    description: 'Shopping Paradise For Deals — every price includes FREE shipping. A 100% Canadian owned marketplace with deals from sellers around the world.',
    ogImage: featured.length ? featured[0].image_url : undefined,
  });
});

app.get('/products', (req, res) => {
  const search = (req.query.search || '').trim();
  const category = (req.query.category || '').trim();
  const categories = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category);
  let sql = 'SELECT p.*, s.business_name, s.country_code AS seller_country FROM products p JOIN sellers s ON s.id = p.seller_id WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (search) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY p.id';
  const products = db.prepare(sql).all(...params);
  res.render('products', {
    products, categories, search, category,
    description: 'Shop all products on Shopping Paradise For Deals — one price with FREE shipping included, from a 100% Canadian owned marketplace.',
  });
});

app.get('/products/:id', (req, res) => {
  const product = db
    .prepare('SELECT p.*, s.business_name, s.country_code AS seller_country FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?')
    .get(req.params.id);
  if (!product) return res.status(404).render('404');
  const reviews = db
    .prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC')
    .all(product.id);
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  res.render('product', {
    product, reviews, avgRating: avg, reviewError: null,
    description: `${product.name} — ${fmt(product.price_cents + product.shipping_cost_cents)} with FREE shipping on Shopping Paradise For Deals, a 100% Canadian owned marketplace.`,
    ogImage: product.image_url,
  });
});

app.post('/products/:id/reviews', reviewLimiter, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).render('404');
  const name = (req.body.reviewer_name || '').trim();
  const rating = parseInt(req.body.rating, 10);
  const comment = (req.body.comment || '').trim();
  const fail = (msg) => {
    const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC').all(product.id);
    const full = db
      .prepare('SELECT p.*, s.business_name, s.country_code AS seller_country FROM products p JOIN sellers s ON s.id = p.seller_id WHERE p.id = ?')
      .get(product.id);
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;
    return res.status(400).render('product', { product: full, reviews, avgRating: avg, reviewError: msg });
  };
  if (!name) return fail('Please enter your name.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail('Rating must be between 1 and 5 stars.');
  db.prepare('INSERT INTO reviews (product_id, reviewer_name, rating, comment) VALUES (?, ?, ?, ?)')
    .run(product.id, name, rating, comment);
  res.redirect(`/products/${product.id}`);
});

// ---- brand-name deals (affiliate placeholder) ----
app.get('/deals', (req, res) => {
  const deals = db.prepare('SELECT * FROM deals ORDER BY id').all();
  const withLinks = deals.map((d) => ({ ...d, url: affiliateLink(d) }));
  res.render('deals', { deals: withLinks });
});

// ---- cart ----
app.get('/cart', (req, res) => {
  const { items, subtotal } = cartDetails(getCart(req));
  res.render('cart', { items, subtotal });
});

app.post('/cart/add', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.body.product_id);
  if (!product || product.stock < 1) return res.redirect('/products');
  const qty = Math.max(1, Math.min(parseInt(req.body.qty, 10) || 1, product.stock));
  const cart = getCart(req);
  cart[product.id] = Math.min((cart[product.id] || 0) + qty, product.stock);
  res.redirect('/cart');
});

app.post('/cart/update', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.body.product_id);
  const cart = getCart(req);
  if (!product) { delete cart[req.body.product_id]; return res.redirect('/cart'); }
  const qty = Math.max(1, Math.min(parseInt(req.body.qty, 10) || 1, product.stock));
  cart[product.id] = qty;
  res.redirect('/cart');
});

app.post('/cart/remove', (req, res) => {
  const cart = getCart(req);
  delete cart[req.body.product_id];
  res.redirect('/cart');
});

// ---- checkout ----
app.get('/checkout', (req, res) => {
  const { items, subtotal } = cartDetails(getCart(req));
  if (items.length === 0) return res.redirect('/cart');
  res.render('checkout', { items, subtotal });
});

app.post('/checkout', async (req, res) => {
  const { buyer_name, buyer_email, address } = req.body;
  const { items, subtotal } = cartDetails(getCart(req));
  if (items.length === 0) return res.redirect('/cart');
  if (!buyer_name || !buyer_email || !address) {
    return res.status(400).render('checkout', { items, subtotal, error: 'Please fill in every field.' });
  }

  const fee = Math.round(subtotal * FEE_RATE);
  const insertOrder = db.prepare(
    'INSERT INTO orders (buyer_name, buyer_email, address, subtotal_cents, platform_fee_cents, total_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES (?, ?, ?, ?)'
  );

  // Orders start as pending; stock is decremented only when payment confirms.
  const orderId = db.transaction(() => {
    const o = insertOrder.run(buyer_name.trim(), buyer_email.trim(), address.trim(), subtotal, fee, subtotal, 'pending');
    for (const i of items) {
      insertItem.run(o.lastInsertRowid, i.id, i.qty, i.unit);
    }
    return Number(o.lastInsertRowid);
  })();

  // Demo mode (no Stripe key): pretend the charge succeeded, as before.
  if (!payments.isLive()) {
    try {
      await payments.demoCharge({ amountCents: subtotal, orderId, buyerEmail: buyer_email.trim() });
    } catch (err) {
      console.error('demo payment failed:', err.message);
      return res.status(502).render('checkout', { items, subtotal, error: 'Demo payment failed — please try again.' });
    }
    markOrderPaid(orderId);
    req.session.cart = {};
    return res.redirect(`/orders/${orderId}`);
  }

  // Live/test mode: hand off to Stripe's hosted checkout page.
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  let session;
  try {
    session = await payments.createCheckoutSession({
      items,
      orderId,
      buyerEmail: buyer_email.trim(),
      successUrl: `${baseUrl}/checkout/success`,
      cancelUrl: `${baseUrl}/checkout/cancel`,
    });
  } catch (err) {
    console.error('stripe session create failed:', err.message);
    return res.status(502).render('checkout', { items, subtotal, error: 'Payment service unavailable — please try again.' });
  }
  if (!session) {
    return res.status(502).render('checkout', { items, subtotal, error: 'Payment service unavailable — please try again.' });
  }
  db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);
  return res.redirect(303, session.url);
});

// Buyer returns here from Stripe's hosted page. We verify payment_status via
// the API before marking anything paid — never trust the redirect alone.
app.get('/checkout/success', async (req, res) => {
  const { session_id } = req.query;
  let orderId = null;
  if (session_id) {
    try {
      const s = await payments.retrieveSession(session_id);
      if (s && s.payment_status === 'paid' && s.metadata && s.metadata.order_id) {
        orderId = Number(s.metadata.order_id);
        markOrderPaid(orderId);
      }
    } catch (err) {
      console.error('stripe success verify failed:', err.message);
    }
    // Fallback: the webhook may have already marked it paid.
    if (!orderId) {
      const o = db.prepare('SELECT id FROM orders WHERE stripe_session_id = ?').get(session_id);
      if (o) orderId = o.id;
    }
  }
  req.session.cart = {};
  if (orderId) return res.redirect(`/orders/${orderId}`);
  return res.redirect('/cart');
});

// Buyer cancelled on Stripe's page — order stays pending, cart is kept.
app.get('/checkout/cancel', (req, res) => {
  res.redirect('/cart');
});

app.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).render('404');
  const items = db
    .prepare('SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?')
    .all(order.id);
  res.render('order', { order, items });
});

// ---- seller auth ----
app.get('/seller/signup', (req, res) => res.render('seller/signup'));
app.post('/seller/signup', (req, res) => {
  const { business_name, email, password } = req.body;
  const country_code = isValidCountry(req.body.country_code) ? String(req.body.country_code).toUpperCase() : 'CA';
  if (!business_name || !email || !password || password.length < 8) {
    return res.status(400).render('seller/signup', { error: 'All fields required; password must be 8+ characters.' });
  }
  try {
    const r = db
      .prepare('INSERT INTO sellers (business_name, email, password_hash, subscription_status, country_code) VALUES (?, ?, ?, ?, ?)')
      .run(business_name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), 'active', country_code);
    req.session.sellerId = r.lastInsertRowid;
    res.redirect('/seller/dashboard');
  } catch (e) {
    res.status(400).render('seller/signup', { error: 'That email is already registered.' });
  }
});

app.get('/seller/login', (req, res) => res.render('seller/login'));
app.post('/seller/login', loginLimiter, (req, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE email = ?').get((req.body.email || '').trim().toLowerCase());
  if (!seller || !bcrypt.compareSync(req.body.password || '', seller.password_hash)) {
    return res.status(401).render('seller/login', { error: 'Invalid email or password.' });
  }
  req.session.sellerId = seller.id;
  res.redirect('/seller/dashboard');
});

app.post('/seller/logout', (req, res) => {
  req.session.sellerId = null;
  res.redirect('/');
});

// ---- seller dashboard ----
app.get('/seller/dashboard', requireSeller, (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE seller_id = ? ORDER BY id').all(req.session.sellerId);
  const orderItems = db
    .prepare(
      `SELECT oi.order_id, oi.qty, oi.unit_price_cents, p.name, o.created_at
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN orders o ON o.id = oi.order_id
       WHERE p.seller_id = ? ORDER BY o.id DESC`
    )
    .all(req.session.sellerId);
  const revenue = orderItems.reduce((s, i) => s + i.unit_price_cents * i.qty, 0);
  const fees = orderItems.reduce((s, i) => s + Math.round(i.unit_price_cents * i.qty * FEE_RATE), 0);
  const items = orderItems.reduce((s, i) => s + i.qty, 0);

  // Orders containing this seller's items, grouped for fulfillment.
  const sellerOrders = db
    .prepare(
      `SELECT DISTINCT o.id, o.buyer_name, o.created_at, o.status
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.seller_id = ? ORDER BY o.id DESC`
    )
    .all(req.session.sellerId);
  const itemsByOrder = {};
  for (const o of sellerOrders) {
    itemsByOrder[o.id] = db
      .prepare(
        `SELECT oi.qty, oi.unit_price_cents, p.name
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? AND p.seller_id = ?`
      )
      .all(o.id, req.session.sellerId);
  }
  res.render('seller/dashboard', {
    products, orderItems, sellerOrders, itemsByOrder,
    stats: { revenue, fees, items },
  });
});

const ORDER_STATUSES = ['paid', 'pending', 'shipped', 'delivered'];

app.post('/seller/orders/:id/status', requireSeller, (req, res) => {
  const status = req.body.status;
  if (!ORDER_STATUSES.includes(status)) return res.status(400).redirect('/seller/dashboard');
  const belongs = db
    .prepare(
      `SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? AND p.seller_id = ? LIMIT 1`
    )
    .get(req.params.id, req.session.sellerId);
  if (!belongs) return res.status(404).render('404');
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.redirect('/seller/dashboard');
});

app.get('/seller/products/new', requireSeller, (req, res) => {
  res.render('seller/product-form', { product: {} });
});

app.post('/seller/products', requireSeller, (req, res) => {
  const price_cents = Math.round(parseFloat(req.body.price || '0') * 100);
  const shipping_cost_cents = Math.round(parseFloat(req.body.shipping_cost || '0') * 100);
  const stock = Math.max(0, parseInt(req.body.stock, 10) || 0);
  const me = db.prepare('SELECT country_code FROM sellers WHERE id = ?').get(req.session.sellerId);
  const origin_country_code = isValidCountry(req.body.origin_country_code)
    ? String(req.body.origin_country_code).toUpperCase()
    : (me.country_code || 'CA');
  const shipping_carrier = SHIPPING_CARRIERS[req.body.shipping_carrier]
    ? req.body.shipping_carrier
    : 'canada_post';
  if (!req.body.name || price_cents < 0 || shipping_cost_cents < 0) {
    return res.status(400).render('seller/product-form', { product: req.body, error: 'Name, price and shipping cost are required.' });
  }
  db.prepare(
    'INSERT INTO products (seller_id, name, description, category, price_cents, shipping_cost_cents, image_url, stock, origin_country_code, shipping_carrier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.session.sellerId,
    req.body.name.trim(),
    (req.body.description || '').trim(),
    req.body.category || 'other',
    price_cents,
    shipping_cost_cents,
    (req.body.image_url || '').trim(),
    stock,
    origin_country_code,
    shipping_carrier
  );
  res.redirect('/seller/dashboard');
});

app.get('/seller/products/:id/edit', requireSeller, (req, res) => {
  const product = sellerProduct(req, req.params.id);
  if (!product) return res.status(404).render('404');
  res.render('seller/product-form', { product });
});

app.post('/seller/products/:id/edit', requireSeller, (req, res) => {
  const product = sellerProduct(req, req.params.id);
  if (!product) return res.status(404).render('404');
  const price_cents = Math.round(parseFloat(req.body.price || '0') * 100);
  const shipping_cost_cents = Math.round(parseFloat(req.body.shipping_cost || '0') * 100);
  const stock = Math.max(0, parseInt(req.body.stock, 10) || 0);
  const origin_country_code = isValidCountry(req.body.origin_country_code)
    ? String(req.body.origin_country_code).toUpperCase()
    : (product.origin_country_code || 'CA');
  const shipping_carrier = SHIPPING_CARRIERS[req.body.shipping_carrier]
    ? req.body.shipping_carrier
    : (product.shipping_carrier || 'canada_post');
  db.prepare(
    'UPDATE products SET name = ?, description = ?, category = ?, price_cents = ?, shipping_cost_cents = ?, image_url = ?, stock = ?, origin_country_code = ?, shipping_carrier = ? WHERE id = ?'
  ).run(
    req.body.name.trim(),
    (req.body.description || '').trim(),
    req.body.category || 'other',
    price_cents,
    shipping_cost_cents,
    (req.body.image_url || '').trim(),
    stock,
    origin_country_code,
    shipping_carrier,
    product.id
  );
  res.redirect('/seller/dashboard');
});

app.post('/seller/products/:id/delete', requireSeller, (req, res) => {
  const product = sellerProduct(req, req.params.id);
  if (product) db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  res.redirect('/seller/dashboard');
});

// ---- pricing + help centre + support ----
app.get('/pricing', (req, res) => res.render('pricing'));

app.get('/help', (req, res) => res.render('help', {
  description: 'Help centre for Shopping Paradise For Deals — answers about orders, free shipping, returns, selling, fees and payouts.',
}));

const TICKET_CATEGORIES = ['order_issue', 'payment_dispute', 'seller_question', 'product_question', 'account_help', 'other'];
const TICKET_CATEGORY_LABELS = {
  order_issue: 'Order problem',
  payment_dispute: 'Payment dispute',
  seller_question: 'Selling',
  product_question: 'Product question',
  account_help: 'Account help',
  other: 'Other',
};
const TICKET_STATUSES = ['open', 'needs-owner', 'answered', 'closed'];

app.get('/support/new', (req, res) => res.render('support-new'));

app.post('/support', supportLimiter, (req, res) => {
  const name = (req.body.name || '').trim().slice(0, 80);
  const email = (req.body.email || '').trim().slice(0, 120);
  const role = req.body.role === 'seller' ? 'seller' : 'buyer';
  const category = TICKET_CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
  const subject = (req.body.subject || '').trim().slice(0, 120);
  const message = (req.body.message || '').trim().slice(0, 2000);
  const order_ref = (req.body.order_ref || '').trim().slice(0, 20);
  const values = { name: req.body.name, email: req.body.email, role, order_ref, subject, message };
  if (!name || !email || !email.includes('@') || !subject || !message) {
    return res.status(400).render('support-new', { error: 'Please fill in your name, a valid email, a subject and a message.', values });
  }
  // Payment disputes escalate straight to the marketplace owner.
  const status = category === 'payment_dispute' ? 'needs-owner' : 'open';
  const r = db
    .prepare('INSERT INTO tickets (name, email, role, category, subject, message, order_ref, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, email, role, category, subject, message, order_ref, status);
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(r.lastInsertRowid);
  res.render('support-confirm', { ticket });
});

app.get('/support/status', (req, res) => {
  const qid = (req.query.id || '').trim();
  const qemail = (req.query.email || '').trim().toLowerCase();
  if (!qid || !qemail) return res.render('support-status', { qid, qemail });
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND lower(email) = ?').get(parseInt(qid, 10) || -1, qemail);
  if (!ticket) return res.render('support-status', { qid, qemail, error: 'No ticket found with that number and email.' });
  res.render('support-status', { qid, qemail, ticket });
});

// AI support assistant API. Always labelled as automated in the UI.
app.post('/api/assistant', supportLimiter, (req, res) => {
  const message = String((req.body && req.body.message) || '').slice(0, 500);
  if (!message.trim()) return res.status(400).json({ reply: 'Please type a question first.' });
  const result = assistantAnswer(message);
  res.json({ reply: result.reply, followups: result.followups, escalate: result.escalate });
});

// ---- /admin protection (HTTP Basic Auth) ----
// Credentials come from ADMIN_USER / ADMIN_PASS env vars. In production the
// server refuses to start without ADMIN_PASS set, so the demo fallback below
// can never be used on a live deploy.
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || (process.env.NODE_ENV === 'production' ? null : 'paradise-demo-dev');
if (!ADMIN_PASS) {
  console.error('FATAL: ADMIN_PASS environment variable must be set in production.');
  process.exit(1);
}
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const user = idx === -1 ? decoded : decoded.slice(0, idx);
    const pass = idx === -1 ? '' : decoded.slice(idx + 1);
    if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="SPFD Admin"');
  return res.status(401).send('Admin access required.');
}
app.use('/admin', requireAdmin);

app.get('/admin', (req, res) => {
  const stats = {
    sellers: db.prepare('SELECT COUNT(*) AS c FROM sellers').get().c,
    products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
    orders: db.prepare('SELECT COUNT(*) AS c FROM orders').get().c,
    gross: db.prepare("SELECT COALESCE(SUM(total_cents),0) AS s FROM orders WHERE status = 'paid'").get().s,
    fees: db.prepare("SELECT COALESCE(SUM(platform_fee_cents),0) AS s FROM orders WHERE status = 'paid'").get().s,
  };
  const recent = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 10').all();

  // Deals management
  const deals = db.prepare('SELECT * FROM deals ORDER BY id').all();
  const editDealId = req.query.edit ? parseInt(req.query.edit, 10) : null;
  const editDeal = editDealId ? db.prepare('SELECT * FROM deals WHERE id = ?').get(editDealId) : null;
  const amazonTag = getSetting('amazon_tag');

  // Revenue by month
  const revenueByMonth = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS orders,
              COALESCE(SUM(total_cents),0) AS gross, COALESCE(SUM(platform_fee_cents),0) AS fees
       FROM orders WHERE status = 'paid' GROUP BY month ORDER BY month DESC`
    )
    .all();

  // Top sellers by sales volume
  const topSellers = db
    .prepare(
      `SELECT s.business_name, SUM(oi.qty * oi.unit_price_cents) AS sales,
              COUNT(DISTINCT oi.order_id) AS orders
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN sellers s ON s.id = p.seller_id
       GROUP BY s.id ORDER BY sales DESC LIMIT 10`
    )
    .all();

  // Seller directory with home countries
  const sellers = db
    .prepare(
      `SELECT s.id, s.business_name, s.email, s.country_code, s.created_at,
              COUNT(p.id) AS products
       FROM sellers s LEFT JOIN products p ON p.seller_id = s.id
       GROUP BY s.id ORDER BY s.id`
    )
    .all();

  // Support tickets: payment disputes ("needs-owner") first, then newest.
  const tickets = db
    .prepare(
      `SELECT * FROM tickets
       ORDER BY CASE status WHEN 'needs-owner' THEN 0 WHEN 'open' THEN 1 WHEN 'answered' THEN 2 ELSE 3 END,
                id DESC`
    )
    .all();

  res.render('admin', {
    stats, recent, deals, editDeal, amazonTag, revenueByMonth, topSellers, sellers,
    tickets, ticketCategoryLabel: (c) => TICKET_CATEGORY_LABELS[c] || c,
    ticketStatuses: TICKET_STATUSES,
    nextPayout: fmtPayout(nextPayoutDate()),
  });
});

app.post('/admin/deals', (req, res) => {
  const price_cents = Math.round(parseFloat(req.body.price || '0') * 100);
  if (!req.body.title || price_cents < 0) return res.redirect('/admin');
  db.prepare('INSERT INTO deals (title, brand, price_cents, image_url, affiliate_url) VALUES (?, ?, ?, ?, ?)')
    .run(
      req.body.title.trim(),
      (req.body.brand || '').trim(),
      price_cents,
      (req.body.image_url || '').trim(),
      (req.body.affiliate_url || '#').trim() || '#'
    );
  res.redirect('/admin');
});

app.post('/admin/deals/:id', (req, res) => {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!deal) return res.status(404).render('404');
  const price_cents = Math.round(parseFloat(req.body.price || '0') * 100);
  db.prepare('UPDATE deals SET title = ?, brand = ?, price_cents = ?, image_url = ?, affiliate_url = ? WHERE id = ?')
    .run(
      req.body.title.trim(),
      (req.body.brand || '').trim(),
      Math.max(0, price_cents),
      (req.body.image_url || '').trim(),
      (req.body.affiliate_url || '#').trim() || '#',
      deal.id
    );
  res.redirect('/admin');
});

app.post('/admin/deals/:id/delete', (req, res) => {
  db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/settings', (req, res) => {
  const tag = (req.body.amazon_tag || '').trim();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('amazon_tag', tag);
  res.redirect('/admin');
});

app.post('/admin/tickets/:id', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).render('404');
  const status = TICKET_STATUSES.includes(req.body.status) ? req.body.status : ticket.status;
  const admin_note = String(req.body.admin_note || '').slice(0, 500);
  db.prepare('UPDATE tickets SET status = ?, admin_note = ? WHERE id = ?').run(status, admin_note, ticket.id);
  res.redirect('/admin');
});

// ---- SEO: sitemap + robots ----
app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const products = db.prepare('SELECT id, created_at FROM products ORDER BY id').all();
  const deals = db.prepare('SELECT id FROM deals ORDER BY id').all();
  const urls = [
    `  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${base}/products</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `  <url><loc>${base}/deals</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    `  <url><loc>${base}/pricing</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
  ];
  for (const p of products) {
    urls.push(`  <url><loc>${base}/products/${p.id}</loc><lastmod>${String(p.created_at).slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`);
});

// Friendly 403 for CSRF failures (and any other forbidden error).
app.use((err, req, res, next) => {
  if (err && (err.code === 'EBADCSRFTOKEN' || err.statusCode === 403)) {
    return res.status(403).send('Security check failed (invalid form token). Please go back, reload the page, and try again.');
  }
  next(err);
});

app.use((req, res) => res.status(404).render('404'));

app.listen(PORT, () => console.log(`Shopping Paradise For Deals on http://localhost:${PORT}`));
