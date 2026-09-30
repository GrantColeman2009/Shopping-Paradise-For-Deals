const bcrypt = require('bcryptjs');
const db = require('./db');

const img = (seed) => `https://picsum.photos/seed/${seed}/600/400`;

const sellers = [
  { business_name: 'NorthStar Electronics', email: 'hello@northstarelec.ca', password: 'password123' },
  { business_name: 'Maple Home Goods', email: 'shop@maplehomegoods.ca', password: 'password123' },
  { business_name: 'Pacific Activewear', email: 'team@pacificactive.ca', password: 'password123' },
];

// origin: ISO country code where the product was MADE (independent of the
// seller's home country). A Canadian seller can sell a product made in China.
// carrier: which of Canada Post / UPS / Purolator the seller ships with.
const products = [
  // NorthStar Electronics (seller 1) — electronics
  { s: 0, name: 'VoltCore Wireless Headphones', description: 'Over-ear Bluetooth headphones with 40-hour battery life, active noise cancellation and plush memory-foam earcups.', category: 'electronics', price: 8999, ship: 899, stock: 25, img: img('spfd-headphones'), origin: 'CN', carrier: 'canada_post' },
  { s: 0, name: 'Lumen 4K Action Camera', description: 'Waterproof 4K action camera with image stabilization, 2-inch touchscreen and a full mounting kit in the box.', category: 'electronics', price: 14999, ship: 1099, stock: 18, img: img('spfd-actioncam'), origin: 'CN', carrier: 'ups' },
  { s: 0, name: 'ChargeHub 65W GaN Charger', description: 'Compact 65W gallium-nitride USB-C charger with three ports. Fast-charges laptops, tablets and phones at once.', category: 'electronics', price: 3499, ship: 499, stock: 60, img: img('spfd-charger'), origin: 'CN', carrier: 'purolator' },
  // Maple Home Goods (seller 2) — home
  { s: 1, name: 'Cedar & Stone Soy Candle Set', description: 'Set of three hand-poured soy candles: cedarwood, sea salt and vanilla bourbon. 45-hour burn time each.', category: 'home', price: 3299, ship: 599, stock: 40, img: img('spfd-candles'), origin: 'CA', carrier: 'canada_post' },
  { s: 1, name: 'Harvest Linen Duvet Cover', description: 'Stonewashed 100% European flax linen duvet cover. Breathable, soft, and better with every wash. Queen size.', category: 'home', price: 11999, ship: 999, stock: 15, img: img('spfd-duvet'), origin: 'PT', carrier: 'ups' },
  { s: 1, name: 'Ember Pour-Over Coffee Set', description: 'Borosilicate glass carafe, walnut collar and precision dripper. Brews up to 6 cups of clean, rich coffee.', category: 'home', price: 5499, ship: 799, stock: 30, img: img('spfd-coffee'), origin: 'CA', carrier: 'purolator' },
  // Pacific Activewear (seller 3) — fashion + sports
  { s: 2, name: 'Trailblazer Running Shoes', description: 'Lightweight trail runners with grippy lugs, responsive foam and a breathable engineered-mesh upper.', category: 'sports', price: 12999, ship: 999, stock: 22, img: img('spfd-shoes'), origin: 'VN', carrier: 'canada_post' },
  { s: 2, name: 'Summit Insulated Water Bottle', description: '1L vacuum-insulated stainless bottle. Keeps drinks cold 24 hours or hot 12. Fits standard cup holders.', category: 'sports', price: 2999, ship: 499, stock: 50, img: img('spfd-bottle'), origin: 'CA', carrier: 'ups' },
  { s: 2, name: 'Drift Organic Cotton Hoodie', description: 'Heavyweight 400gsm organic cotton hoodie with a brushed fleece interior. Unisex relaxed fit.', category: 'fashion', price: 7499, ship: 799, stock: 35, img: img('spfd-hoodie'), origin: 'BD', carrier: 'purolator' },
  { s: 2, name: 'Harbour Canvas Tote', description: 'Waxed canvas everyday tote with leather handles and an interior zip pocket. Ages beautifully.', category: 'fashion', price: 6499, ship: 699, stock: 28, img: img('spfd-tote'), origin: 'CA', carrier: 'canada_post' },
  { s: 1, name: 'Alpine Wool Throw Blanket', description: 'Chunky-knit throw in undyed lambswool. Generously sized at 50 x 60 inches for couch or cottage.', category: 'home', price: 8999, ship: 1099, stock: 20, img: img('spfd-throw'), origin: 'CA', carrier: 'ups' },
  { s: 0, name: 'Orbit Mechanical Keyboard', description: 'Hot-swappable mechanical keyboard with tactile switches, PBT keycaps and south-facing RGB.', category: 'electronics', price: 10999, ship: 899, stock: 16, img: img('spfd-keyboard'), origin: 'CN', carrier: 'purolator' },
];

function main() {
  const nProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (nProducts > 0) {
    console.log('Products already seeded — skipping product seed.');
  } else {
    seedProducts();
  }

  seedDeals();
  backfillCountries();
  backfillCarriers();
}

function seedProducts() {
  const insertSeller = db.prepare(
    'INSERT INTO sellers (business_name, email, password_hash, subscription_status, country_code) VALUES (?, ?, ?, ?, ?)'
  );
  const sellerIds = sellers.map((s) =>
    Number(insertSeller.run(s.business_name, s.email, bcrypt.hashSync(s.password, 10), 'active', 'CA').lastInsertRowid)
  );

  const insertProduct = db.prepare(
    'INSERT INTO products (seller_id, name, description, category, price_cents, shipping_cost_cents, image_url, stock, origin_country_code, shipping_carrier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const tx = db.transaction(() => {
    for (const p of products) {
      insertProduct.run(sellerIds[p.s], p.name, p.description, p.category, p.price, p.ship, p.img, p.stock, p.origin || 'CA', p.carrier || 'canada_post');
    }
  });
  tx();

  console.log(`Seeded ${sellerIds.length} sellers and ${products.length} products.`);
  console.log('Demo seller logins (password for all): password123');
  sellers.forEach((s) => console.log(`  - ${s.business_name} <${s.email}>`));
}

// affiliate_url is a '#' placeholder until a real Amazon Associates
// account is connected. All prices in CAD.
const deals = [
  { title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones', brand: 'Sony', price: 39999, img: img('spfd-deal-sony') },
  { title: 'Apple AirPods Pro (2nd Generation)', brand: 'Apple', price: 24999, img: img('spfd-deal-airpods') },
  { title: 'Samsung 55" QLED 4K Smart TV', brand: 'Samsung', price: 79999, img: img('spfd-deal-tv') },
  { title: 'Dyson V15 Detect Cordless Vacuum', brand: 'Dyson', price: 74999, img: img('spfd-deal-dyson') },
  { title: 'KitchenAid Artisan Series 5 Stand Mixer', brand: 'KitchenAid', price: 49999, img: img('spfd-deal-mixer') },
  { title: 'Instant Pot Duo 7-in-1 Pressure Cooker, 6 Quart', brand: 'Instant Pot', price: 9999, img: img('spfd-deal-instantpot') },
  { title: 'Nike Air Zoom Pegasus Running Shoes', brand: 'Nike', price: 14999, img: img('spfd-deal-nike') },
  { title: 'LEGO Star Wars Millennium Falcon Building Set', brand: 'LEGO', price: 19999, img: img('spfd-deal-lego') },
];

function seedDeals() {
  const nDeals = db.prepare('SELECT COUNT(*) AS c FROM deals').get().c;
  if (nDeals > 0) {
    console.log('Deals already seeded — skipping.');
    return;
  }
  const insertDeal = db.prepare(
    'INSERT INTO deals (title, brand, price_cents, image_url, affiliate_url) VALUES (?, ?, ?, ?, ?)'
  );
  const tx = db.transaction(() => {
    for (const d of deals) insertDeal.run(d.title, d.brand, d.price, d.img, '#');
  });
  tx();
  console.log(`Seeded ${deals.length} brand-name deals (affiliate URLs are placeholders).`);
}

// One-time backfill for databases created before the country columns
// existed: give the demo catalogue realistic origins so the origin badges
// show on an existing database too.
function backfillCountries() {
  const done = db.prepare("SELECT value FROM settings WHERE key = 'country_backfill_v1'").get();
  if (done) return;
  const demoOrigins = {
    'VoltCore Wireless Headphones': 'CN',
    'Lumen 4K Action Camera': 'CN',
    'ChargeHub 65W GaN Charger': 'CN',
    'Orbit Mechanical Keyboard': 'CN',
    'Harvest Linen Duvet Cover': 'PT',
    'Trailblazer Running Shoes': 'VN',
    'Drift Organic Cotton Hoodie': 'BD',
  };
  const upd = db.prepare('UPDATE products SET origin_country_code = ? WHERE name = ?');
  for (const [name, code] of Object.entries(demoOrigins)) upd.run(code, name);
  db.prepare("INSERT INTO settings (key, value) VALUES ('country_backfill_v1', '1')").run();
  console.log('Backfilled product origin countries.');
}

// One-time backfill for databases created before the shipping_carrier
// column existed: spread the demo catalogue across the three carriers.
function backfillCarriers() {
  const done = db.prepare("SELECT value FROM settings WHERE key = 'carrier_backfill_v1'").get();
  if (done) return;
  const demoCarriers = {
    'Lumen 4K Action Camera': 'ups',
    'ChargeHub 65W GaN Charger': 'purolator',
    'Harvest Linen Duvet Cover': 'ups',
    'Ember Pour-Over Coffee Set': 'purolator',
    'Summit Insulated Water Bottle': 'ups',
    'Drift Organic Cotton Hoodie': 'purolator',
    'Alpine Wool Throw Blanket': 'ups',
    'Orbit Mechanical Keyboard': 'purolator',
  };
  const upd = db.prepare('UPDATE products SET shipping_carrier = ? WHERE name = ?');
  for (const [name, code] of Object.entries(demoCarriers)) upd.run(code, name);
  db.prepare("INSERT INTO settings (key, value) VALUES ('carrier_backfill_v1', '1')").run();
  console.log('Backfilled product shipping carriers.');
}

main();
