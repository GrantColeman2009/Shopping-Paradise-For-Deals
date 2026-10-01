// Shared country list (ISO 3166-1 alpha-2 codes) plus helpers.
// Used for seller home countries and product "made in" origins.
// All free: flag emojis are Unicode regional-indicator symbols, no assets.

const COUNTRIES = [
  ['CA', 'Canada'],
  ['US', 'United States'],
  ['MX', 'Mexico'],
  ['GB', 'United Kingdom'],
  ['IE', 'Ireland'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['ES', 'Spain'],
  ['PT', 'Portugal'],
  ['IT', 'Italy'],
  ['NL', 'Netherlands'],
  ['BE', 'Belgium'],
  ['CH', 'Switzerland'],
  ['AT', 'Austria'],
  ['SE', 'Sweden'],
  ['NO', 'Norway'],
  ['DK', 'Denmark'],
  ['FI', 'Finland'],
  ['PL', 'Poland'],
  ['CZ', 'Czechia'],
  ['HU', 'Hungary'],
  ['RO', 'Romania'],
  ['GR', 'Greece'],
  ['UA', 'Ukraine'],
  ['TR', 'Turkey'],
  ['IL', 'Israel'],
  ['AE', 'United Arab Emirates'],
  ['SA', 'Saudi Arabia'],
  ['EG', 'Egypt'],
  ['MA', 'Morocco'],
  ['NG', 'Nigeria'],
  ['KE', 'Kenya'],
  ['ZA', 'South Africa'],
  ['IN', 'India'],
  ['PK', 'Pakistan'],
  ['BD', 'Bangladesh'],
  ['LK', 'Sri Lanka'],
  ['CN', 'China'],
  ['HK', 'Hong Kong'],
  ['TW', 'Taiwan'],
  ['JP', 'Japan'],
  ['KR', 'South Korea'],
  ['SG', 'Singapore'],
  ['MY', 'Malaysia'],
  ['TH', 'Thailand'],
  ['VN', 'Vietnam'],
  ['PH', 'Philippines'],
  ['ID', 'Indonesia'],
  ['AU', 'Australia'],
  ['NZ', 'New Zealand'],
  ['BR', 'Brazil'],
  ['AR', 'Argentina'],
  ['CL', 'Chile'],
  ['CO', 'Colombia'],
  ['PE', 'Peru'],
];

const CODE_TO_NAME = Object.fromEntries(COUNTRIES);

// ---- National postal services ----
// Every seller ships through the national postal service of their home
// country (their "Country of Business"). Only countries with a supported
// national postal service can be shipping destinations — a country with no
// supported postal service is not served.
//
// maxInsuredCad: conservative configured cap (CAD) for the insured value of
// a single shipment via this carrier. The insured value of an order can never
// exceed the carrier's published maximum coverage; these defaults are the
// platform's conservative enforcement of that rule and can be tuned per
// carrier. All values in Canadian dollars.
const NATIONAL_POSTAL_SERVICES = {
  CA: { key: 'canada_post',  name: 'Canada Post',              maxInsuredCad: 5000 },
  US: { key: 'usps',         name: 'USPS',                     maxInsuredCad: 6800 },
  MX: { key: 'correos_mx',   name: 'Correos de México',        maxInsuredCad: 3500 },
  GB: { key: 'royal_mail',   name: 'Royal Mail',               maxInsuredCad: 4300 },
  IE: { key: 'an_post',      name: 'An Post',                  maxInsuredCad: 3500 },
  FR: { key: 'la_poste',     name: 'La Poste',                 maxInsuredCad: 4000 },
  DE: { key: 'deutsche_post',name: 'Deutsche Post',            maxInsuredCad: 4000 },
  ES: { key: 'correos_es',   name: 'Correos',                  maxInsuredCad: 3500 },
  PT: { key: 'ctt',          name: 'CTT Correios de Portugal', maxInsuredCad: 3500 },
  IT: { key: 'poste_italiane', name: 'Poste Italiane',         maxInsuredCad: 3500 },
  NL: { key: 'postnl',       name: 'PostNL',                   maxInsuredCad: 3500 },
  BE: { key: 'bpost',        name: 'bpost',                    maxInsuredCad: 3500 },
  CH: { key: 'swiss_post',   name: 'Swiss Post',               maxInsuredCad: 4000 },
  AT: { key: 'austrian_post',name: 'Austrian Post',            maxInsuredCad: 3500 },
  SE: { key: 'postnord_se',  name: 'PostNord Sverige',         maxInsuredCad: 3500 },
  NO: { key: 'posten_norge', name: 'Posten Norge',             maxInsuredCad: 3500 },
  DK: { key: 'postnord_dk',  name: 'PostNord Danmark',         maxInsuredCad: 3500 },
  FI: { key: 'posti',        name: 'Posti',                    maxInsuredCad: 3500 },
  PL: { key: 'poczta_polska',name: 'Poczta Polska',            maxInsuredCad: 3500 },
  CZ: { key: 'ceska_posta',  name: 'Česká pošta',              maxInsuredCad: 3500 },
  HU: { key: 'magyar_posta', name: 'Magyar Posta',             maxInsuredCad: 3500 },
  RO: { key: 'posta_romana', name: 'Poșta Română',            maxInsuredCad: 3500 },
  GR: { key: 'elta',         name: 'Hellenic Post (ELTA)',     maxInsuredCad: 3500 },
  UA: { key: 'ukrposhta',    name: 'Ukrposhta',                maxInsuredCad: 3500 },
  TR: { key: 'ptt',          name: 'PTT Turkish Post',         maxInsuredCad: 3500 },
  IL: { key: 'israel_post',  name: 'Israel Post',              maxInsuredCad: 3500 },
  AE: { key: 'emirates_post',name: 'Emirates Post',            maxInsuredCad: 3500 },
  SA: { key: 'saudi_post',   name: 'Saudi Post (SPL)',         maxInsuredCad: 3500 },
  EG: { key: 'egypt_post',   name: 'Egypt Post',               maxInsuredCad: 3500 },
  MA: { key: 'barid_almaghrib', name: 'Barid Al-Maghrib',      maxInsuredCad: 3500 },
  NG: { key: 'nipost',       name: 'NIPOST',                   maxInsuredCad: 3500 },
  KE: { key: 'posta_kenya',  name: 'Posta Kenya',              maxInsuredCad: 3500 },
  ZA: { key: 'sapo',         name: 'South African Post Office',maxInsuredCad: 3500 },
  IN: { key: 'india_post',   name: 'India Post',               maxInsuredCad: 3500 },
  PK: { key: 'pakistan_post',name: 'Pakistan Post',            maxInsuredCad: 3500 },
  BD: { key: 'bangladesh_post', name: 'Bangladesh Post',       maxInsuredCad: 3500 },
  LK: { key: 'sri_lanka_post', name: 'Sri Lanka Post',        maxInsuredCad: 3500 },
  CN: { key: 'china_post',   name: 'China Post',               maxInsuredCad: 3500 },
  HK: { key: 'hongkong_post',name: 'Hongkong Post',            maxInsuredCad: 3500 },
  TW: { key: 'chunghwa_post',name: 'Chunghwa Post',            maxInsuredCad: 3500 },
  JP: { key: 'japan_post',   name: 'Japan Post',               maxInsuredCad: 4000 },
  KR: { key: 'korea_post',   name: 'Korea Post',               maxInsuredCad: 3500 },
  SG: { key: 'singpost',     name: 'SingPost',                 maxInsuredCad: 3500 },
  MY: { key: 'pos_malaysia', name: 'Pos Malaysia',             maxInsuredCad: 3500 },
  TH: { key: 'thailand_post',name: 'Thailand Post',            maxInsuredCad: 3500 },
  VN: { key: 'vnpost',       name: 'Vietnam Post',             maxInsuredCad: 3500 },
  PH: { key: 'phlpost',      name: 'PHLPost',                  maxInsuredCad: 3500 },
  ID: { key: 'pos_indonesia',name: 'Pos Indonesia',            maxInsuredCad: 3500 },
  AU: { key: 'australia_post', name: 'Australia Post',        maxInsuredCad: 4500 },
  NZ: { key: 'nz_post',      name: 'NZ Post',                  maxInsuredCad: 3500 },
  BR: { key: 'correios_br',  name: 'Correios',                 maxInsuredCad: 3500 },
  AR: { key: 'correo_argentino', name: 'Correo Argentino',     maxInsuredCad: 3500 },
  CL: { key: 'correos_chile',name: 'Correos de Chile',         maxInsuredCad: 3500 },
  CO: { key: 'cuatro_72',    name: '4-72',                     maxInsuredCad: 3500 },
  PE: { key: 'serpost',      name: 'Serpost',                  maxInsuredCad: 3500 },
};

// Express international shipping costs this multiple of the standard rate.
const EXPRESS_MULTIPLIER = 1.8;
// Fallback cap when a carrier key is unknown.
const DEFAULT_MAX_INSURED_CAD = 3500;

function postalServiceFor(countryCode) {
  return NATIONAL_POSTAL_SERVICES[String(countryCode || '').toUpperCase()] || null;
}

function carrierKeyForCountry(countryCode) {
  const svc = postalServiceFor(countryCode);
  return svc ? svc.key : 'canada_post';
}

function carrierByKey(key) {
  for (const svc of Object.values(NATIONAL_POSTAL_SERVICES)) {
    if (svc.key === key) return svc;
  }
  return null;
}

function isServiceableCountry(code) {
  return Boolean(postalServiceFor(code));
}

// [code, name] pairs for the checkout destination dropdown.
function serviceableCountries() {
  return Object.keys(NATIONAL_POSTAL_SERVICES).map((code) => [code, CODE_TO_NAME[code] || code]);
}

function countryName(code) {
  return CODE_TO_NAME[String(code || '').toUpperCase()] || String(code || '').toUpperCase();
}

function isValidCountry(code) {
  return Boolean(CODE_TO_NAME[String(code || '').toUpperCase()]);
}

// Regional-indicator flag emoji, e.g. flagOf('CA') => 🇨🇦
function flagOf(code) {
  const c = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

module.exports = { COUNTRIES, countryName, flagOf, isValidCountry,
  NATIONAL_POSTAL_SERVICES, postalServiceFor, carrierByKey, carrierKeyForCountry,
  isServiceableCountry, serviceableCountries, EXPRESS_MULTIPLIER, DEFAULT_MAX_INSURED_CAD };
