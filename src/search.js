// ============================================================
// search.js — Fuzzy search for countries and cities
// ============================================================

export function searchCountries(query, countries) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  return countries.features
    .filter(f => {
      const name = (f.properties.name || f.properties.NAME || '').toLowerCase();
      return name.includes(q);
    })
    .sort((a, b) => {
      const aName = (a.properties.name || a.properties.NAME || '').toLowerCase();
      const bName = (b.properties.name || b.properties.NAME || '').toLowerCase();
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      return aStarts - bStarts || aName.localeCompare(bName);
    })
    .slice(0, 9);
}

export function searchCities(query, cities) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  return cities.features
    .filter(f => {
      const name = (f.properties.name || f.properties.NAME || '').toLowerCase();
      return name.includes(q);
    })
    .sort((a, b) => {
      const aName = (a.properties.name || '').toLowerCase();
      const bName = (b.properties.name || '').toLowerCase();
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      const aPop = a.properties.pop_max || a.properties.POP_MAX || 0;
      const bPop = b.properties.pop_max || b.properties.POP_MAX || 0;
      return aStarts - bStarts || bPop - aPop;
    })
    .slice(0, 9);
}
