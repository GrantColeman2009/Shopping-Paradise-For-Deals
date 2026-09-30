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

module.exports = { COUNTRIES, countryName, flagOf, isValidCountry };
