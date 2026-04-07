// ============================================================
// dataLoader.js — Fetch Natural Earth data
// ============================================================

const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const CITIES_URL    = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_populated_places_simple.geojson';
const CITIES_BACKUP = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places.geojson';
const STATES_URL    = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lakes.geojson';
const RIVERS_URL    = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_rivers_lake_centerlines.geojson';
const BD_DISTRICTS_URL = 'https://raw.githubusercontent.com/yasserius/bangladesh_geojson_shapefile/master/bangladesh_geojson_adm2_64_districts_zillas.json';

// ISO 3166-1 Numeric → Country Name
export const COUNTRY_NAMES = {
  4:'Afghanistan',8:'Albania',12:'Algeria',20:'Andorra',24:'Angola',
  28:'Antigua and Barbuda',32:'Argentina',36:'Australia',40:'Austria',
  44:'Bahamas',48:'Bahrain',50:'Bangladesh',52:'Barbados',56:'Belgium',
  64:'Bhutan',68:'Bolivia',70:'Bosnia and Herzegovina',72:'Botswana',
  76:'Brazil',84:'Belize',96:'Brunei',100:'Bulgaria',104:'Myanmar',
  108:'Burundi',116:'Cambodia',120:'Cameroon',124:'Canada',
  132:'Cape Verde',140:'Central African Republic',144:'Sri Lanka',
  148:'Chad',152:'Chile',156:'China',170:'Colombia',174:'Comoros',
  178:'Republic of Congo',180:'DR Congo',188:'Costa Rica',
  191:'Croatia',192:'Cuba',196:'Cyprus',203:'Czech Republic',
  204:'Benin',208:'Denmark',212:'Dominica',214:'Dominican Republic',
  218:'Ecuador',818:'Egypt',222:'El Salvador',226:'Equatorial Guinea',
  232:'Eritrea',233:'Estonia',231:'Ethiopia',238:'Falkland Islands',
  242:'Fiji',246:'Finland',250:'France',266:'Gabon',270:'Gambia',
  268:'Georgia',276:'Germany',288:'Ghana',300:'Greece',308:'Grenada',
  320:'Guatemala',324:'Guinea',624:'Guinea-Bissau',328:'Guyana',
  332:'Haiti',340:'Honduras',348:'Hungary',352:'Iceland',356:'India',
  360:'Indonesia',364:'Iran',368:'Iraq',372:'Ireland',376:'Israel',
  380:'Italy',388:'Jamaica',392:'Japan',400:'Jordan',398:'Kazakhstan',
  404:'Kenya',296:'Kiribati',410:'South Korea',408:'North Korea',
  414:'Kuwait',417:'Kyrgyzstan',418:'Laos',422:'Lebanon',
  426:'Lesotho',430:'Liberia',434:'Libya',438:'Liechtenstein',
  440:'Lithuania',442:'Luxembourg',450:'Madagascar',454:'Malawi',
  458:'Malaysia',462:'Maldives',466:'Mali',470:'Malta',
  584:'Marshall Islands',484:'Mexico',583:'Micronesia',498:'Moldova',
  492:'Monaco',496:'Mongolia',499:'Montenegro',504:'Morocco',
  508:'Mozambique',516:'Namibia',520:'Nauru',524:'Nepal',
  528:'Netherlands',554:'New Zealand',558:'Nicaragua',562:'Niger',
  566:'Nigeria',578:'Norway',512:'Oman',586:'Pakistan',585:'Palau',
  591:'Panama',598:'Papua New Guinea',600:'Paraguay',604:'Peru',
  608:'Philippines',616:'Poland',620:'Portugal',634:'Qatar',
  642:'Romania',643:'Russia',646:'Rwanda',659:'Saint Kitts and Nevis',
  662:'Saint Lucia',670:'Saint Vincent and the Grenadines',882:'Samoa',
  674:'San Marino',678:'Sao Tome and Principe',682:'Saudi Arabia',
  686:'Senegal',688:'Serbia',694:'Sierra Leone',703:'Slovakia',
  705:'Slovenia',706:'Somalia',710:'South Africa',724:'Spain',
  729:'Sudan',728:'South Sudan',740:'Suriname',752:'Sweden',
  756:'Switzerland',760:'Syria',158:'Taiwan',762:'Tajikistan',
  764:'Thailand',768:'Togo',776:'Tonga',780:'Trinidad and Tobago',
  788:'Tunisia',792:'Turkey',795:'Turkmenistan',800:'Uganda',
  804:'Ukraine',784:'United Arab Emirates',826:'United Kingdom',
  834:'Tanzania',840:'United States of America',858:'Uruguay',
  860:'Uzbekistan',548:'Vanuatu',862:'Venezuela',704:'Vietnam',
  887:'Yemen',894:'Zambia',716:'Zimbabwe'
};

export const COUNTRY_ISO_MAP = {
  50: 'BGD', 356: 'IND', 586: 'PAK', 840: 'USA', 124: 'CAN', 392: 'JPN', 156: 'CHN',
  250: 'FRA', 276: 'DEU', 826: 'GBR', 380: 'ITA', 724: 'ESP', 76: 'BRA', 643: 'RUS',
};

let _countries = null;
let _cities    = null;
let _states    = null;
let _rivers    = null;
let _topojson  = null;
let _bd_districts = null;

async function getTopojson() {
  if (!_topojson) {
    _topojson = await import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm');
  }
  return _topojson;
}

export async function loadCountries() {
  if (_countries) return _countries;
  const [res, topojson] = await Promise.all([fetch(COUNTRIES_URL), getTopojson()]);
  if (!res.ok) throw new Error('Failed to fetch countries');
  const topo = await res.json();
  const countriesObj = topo.objects.countries || topo.objects.land;
  if (!countriesObj) throw new Error('TopoJSON objects not found');
  
  const geojson = topojson.feature(topo, countriesObj);
  geojson.features = geojson.features.map(f => {
    const numericId = parseInt(f.id);
    const mappedName = COUNTRY_NAMES[numericId];
    // Fallback names from the source data if the ID lookup fails
    const sourceName = f.properties.name || f.properties.NAME || f.properties.NAME_EN || '';
    
    return {
      ...f,
      properties: {
        ...f.properties,
        name: mappedName || sourceName || `Territory (${f.id})`,
        numericId: numericId,
        adm0_a3: COUNTRY_ISO_MAP[numericId] || f.properties.adm0_a3 || f.properties.ISO_A3 || ''
      }
    };
  });
  
  console.log("Indexed countries:", geojson.features.length);
  _countries = geojson;
  return _countries;
}

export async function loadCities() {
  if (_cities) return _cities;
  try {
    const res = await fetch(CITIES_URL);
    if (!res.ok) throw new Error('primary failed');
    _cities = await res.json();
  } catch {
    const res = await fetch(CITIES_BACKUP);
    if (!res.ok) throw new Error('Failed to fetch cities');
    _cities = await res.json();
  }
  return _cities;
}

export async function loadStates() {
  if (_states) return _states;
  const res = await fetch(STATES_URL);
  if (!res.ok) throw new Error('Failed to fetch states');
  _states = await res.json();
  
  // Inject highly detailed Bangladesh divisions/districts so they appear natively
  try {
    const bd_districts = await loadDistricts(50);
    if (bd_districts && bd_districts.features) {
      _states.features = _states.features.filter(f => f.properties.adm0_a3 !== 'BGD' && f.properties.iso_a2 !== 'BD');
      _states.features = [..._states.features, ...bd_districts.features];
    }
  } catch (e) {
    console.warn('Could not inject BD districts:', e);
  }
  
  return _states;
}

export async function loadRivers() {
  if (_rivers) return _rivers;
  const res = await fetch(RIVERS_URL);
  if (!res.ok) throw new Error('Failed to fetch rivers');
  _rivers = await res.json();
  return _rivers;
}

export async function loadDistricts(countryCode) {
  // Currently we only support detailed districts for Bangladesh (ID 50)
  if (countryCode !== 50 && countryCode !== '50') return null;
  
  if (_bd_districts) return _bd_districts;
  
  try {
    const res = await fetch(BD_DISTRICTS_URL);
    if (!res.ok) throw new Error('Failed to fetch BD districts');
    _bd_districts = await res.json();
    return _bd_districts;
  } catch (e) {
    console.warn("Could not fetch detailed districts data:", e);
    return null;
  }
}

