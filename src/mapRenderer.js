// ============================================================
// mapRenderer.js — D3 map rendering
// ============================================================

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const PAD = 48;

function makeProjection(name) {
  // Using Mercator as default for individual country outlines as it's common for clean designs
  return d3.geoMercator();
}

export const MAP_STYLES = {
  minimalistGray:    { fill: '#e2e8f0', borderStroke: '#1e293b', stateStroke: '#ffffff', riverStroke: '#94a3b8', ctxFill: '#f8fafc', ctxStroke: '#cbd5e1', pin: '#ef4444', pinBorder: '#fff' },
  // Styled identically to tutorial image 1 (pure outline border and state divisions, no rivers)
  outlineOnly:       { fill: 'none',    borderStroke: '#000000', stateStroke: '#000000', riverStroke: 'none',    ctxFill: '#f8f8f8', ctxStroke: '#dddddd', pin: '#4f9ef4', pinBorder: '#fff' },
  filledWithBorders: { fill: '#4b5563', borderStroke: '#111827', stateStroke: '#9ca3af', riverStroke: '#d1d5db', ctxFill: '#f3f4f6', ctxStroke: '#e5e7eb', pin: '#facc15', pinBorder: '#fff' },
  // Styled identically to tutorial image 2 (solid black, white state divisions, white rivers)
  solidFilled:       { fill: '#000000', borderStroke: 'none',    stateStroke: '#ffffff', riverStroke: '#ffffff', ctxFill: '#f0f0f0', ctxStroke: '#cccccc', pin: '#4f9ef4', pinBorder: '#fff' },
  // Styled identically to tutorial image 3 (solid black silhouette, white rivers)
  silhouetteBlack:   { fill: '#000000', borderStroke: 'none',    stateStroke: 'none',    riverStroke: '#ffffff', ctxFill: '#f0f0f0', ctxStroke: '#cccccc', pin: '#4f9ef4', pinBorder: '#fff' },
  darkMode:          { fill: '#1f2937', borderStroke: '#ffffff', stateStroke: '#4b5563', riverStroke: '#3b82f6', ctxFill: '#111827', ctxStroke: '#374151', pin: '#ef4444', pinBorder: '#fff' },
  vibrant:           { fill: '#ec4899', borderStroke: '#831843', stateStroke: '#fbcfe8', riverStroke: '#bfdbfe', ctxFill: '#fdf2f8', ctxStroke: '#f9a8d4', pin: '#10b981', pinBorder: '#fff' },
  earthTones:        { fill: '#d97706', borderStroke: '#78350f', stateStroke: '#fef3c7', riverStroke: '#93c5fd', ctxFill: '#fffbeb', ctxStroke: '#fcd34d', pin: '#059669', pinBorder: '#fff' },
  midnightBlue:      { fill: '#1e3a8a', borderStroke: '#bfdbfe', stateStroke: '#60a5fa', riverStroke: '#93c5fd', ctxFill: '#172554', ctxStroke: '#1d4ed8', pin: '#fbbf24', pinBorder: '#fff' },
  posterGray:        { fill: '#6b7280', borderStroke: '#111827', stateStroke: '#e5e7eb', riverStroke: '#f3f4f6', ctxFill: '#f9fafb', ctxStroke: '#d1d5db', pin: '#f97316', pinBorder: '#fff' }
};

/** Render Country Map — Returns an Array of SVGs based on styleMode */
export function renderCountryMap(container, feature, allCountries, statesData, riversData, showNeighbors = false, styleMode = 'dual') {
  const w = 800;
  const h = 800;
  container.innerHTML = '';

  const proj = makeProjection('mercator')
    .fitExtent([[PAD, PAD], [w - PAD, h - PAD]], feature)
    .clipExtent([[0, 0], [w, h]]);
  const path = d3.geoPath().projection(proj);

  const svgs = [];

  // Style helper: Creates an SVG node with a specific aesthetic
  const createMap = (opts) => {
    const svg = d3.create('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%');

    const g = svg.append('g');

    // Context (Neighboring countries)
    if (showNeighbors) {
      g.selectAll('.ctx')
        .data(allCountries.features.filter(f => f.id !== feature.id && path(f)))
        .join('path')
        .attr('class', 'ctx')
        .attr('d', path)
        .attr('fill', opts.ctxFill)
        .attr('stroke', opts.ctxStroke)
        .attr('stroke-width', 0.5);
    }

    // Selected country base fill
    g.append('path')
      .datum(feature)
      .attr('fill', opts.fill)
      .attr('d', path);

    // Clip path for internal states/rivers
    const clipId = 'clip-' + Math.random().toString(36).substr(2, 9) + '-' + feature.id;
    g.append('clipPath')
      .attr('id', clipId)
      .append('path')
      .datum(feature)
      .attr('d', path);

    const clipped = g.append('g').attr('clip-path', `url(#${clipId})`);

    // Filter geometries rigorously to the selected country bounds to prevent huge vector files and bleed
    let countryStates = statesData ? statesData.features.filter(s => {
      const targetA3 = feature.properties.adm0_a3;
      const targetISO = feature.properties.iso_a2;
      
      const match = (targetA3 && (s.properties.adm0_a3 === targetA3 || s.properties.sov_a3 === targetA3)) ||
                    (targetISO && s.properties.iso_a2 === targetISO);
                    
      return match || (path(s) && d3.geoContains(feature, d3.geoCentroid(s)));
    }) : [];
    
    // Bangladesh fallback for 50m data: usually missing states, so we treat it explicitly if passed as statesData
    if (countryStates.length === 0 && (feature.properties.numericId == 50 || feature.properties.adm0_a3 === 'BGD')) {
       // If the statesData happens to contain BD districts, we'll try to map them anyway via geometry intersect
       countryStates = statesData ? statesData.features.filter(s => path(s) && d3.geoContains(feature, d3.geoCentroid(s))) : [];
    }

    const countryRivers = riversData ? riversData.features.filter(r => {
      const targetA3 = feature.properties.adm0_a3;
      // Rivers often have 'adm0_a3' or 'country_code'
      const match = targetA3 && (r.properties.adm0_a3 === targetA3 || r.properties.country_code === targetA3);

      if (match) return true;
      
      if (!path(r)) return false;
      const coords = r.geometry.type === 'LineString' ? r.geometry.coordinates : (r.geometry.coordinates[0] || []);
      const samplePts = [coords[0], coords[Math.floor(coords.length / 2)], coords[coords.length - 1]];
      return samplePts.some(pt => pt && d3.geoContains(feature, pt));
    }) : [];

    // States inside country
    if (countryStates.length > 0) {
      clipped.selectAll('.state')
        .data(countryStates)
        .join('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', opts.stateStroke)
        .attr('stroke-width', 1.2)
        .attr('vector-effect', 'non-scaling-stroke');
    }

    // Rivers inside country
    if (countryRivers.length > 0) {
      clipped.selectAll('.river')
        .data(countryRivers)
        .join('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', opts.riverStroke || '#ffffff')
        .attr('stroke-width', 2.0)
        .attr('opacity', 1.0)
        .attr('vector-effect', 'non-scaling-stroke');
    }

    // Outer border stroke
    if (opts.borderStroke && opts.borderStroke !== 'none') {
      g.append('path')
        .datum(feature)
        .attr('fill', 'none')
        .attr('stroke', opts.borderStroke)
        .attr('stroke-width', 2.0)
        .attr('stroke-linejoin', 'round')
        .attr('d', path);
    }

    return svg.node();
  };

  if (styleMode === 'dual') {
    // Specifically push the 3 outputs mirroring the YouTube tutorial row!
    svgs.push(createMap(MAP_STYLES.outlineOnly));
    svgs.push(createMap(MAP_STYLES.solidFilled));
    svgs.push(createMap(MAP_STYLES.silhouetteBlack));
  } else {
    const selectedOpts = MAP_STYLES[styleMode] || MAP_STYLES.minimalistGray;
    svgs.push(createMap(selectedOpts));
  }

  svgs.forEach(node => container.appendChild(node));
  return svgs;
}

/** Render World Map — Returns an Array of SVGs for global view */
export function renderWorldMap(container, allCountries, styleMode = 'dual') {
  const w = 1000;
  const h = 600;
  container.innerHTML = '';

  const proj = d3.geoMercator()
    .fitExtent([[PAD, PAD], [w - PAD, h - PAD]], allCountries)
    .clipExtent([[0, 0], [w, h]]);
  const path = d3.geoPath().projection(proj);

  const svgs = [];

  const createMap = (opts) => {
    const svg = d3.create('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%');

    const g = svg.append('g');

    g.selectAll('.country')
      .data(allCountries.features)
      .join('path')
      .attr('class', 'country')
      .attr('d', path)
      .attr('fill', opts.fill === 'none' ? '#ffffff' : opts.fill)
      .attr('stroke', opts.borderStroke === 'none' ? '#000000' : opts.borderStroke)
      .attr('stroke-width', 0.1); // thinner for world view

    return svg.node();
  };

  if (styleMode === 'dual') {
    svgs.push(createMap(MAP_STYLES.outlineOnly));
    svgs.push(createMap(MAP_STYLES.solidFilled));
    svgs.push(createMap(MAP_STYLES.silhouetteBlack));
  } else {
    const selectedOpts = MAP_STYLES[styleMode] || MAP_STYLES.minimalistGray;
    svgs.push(createMap(selectedOpts));
  }

  svgs.forEach(node => container.appendChild(node));
  return svgs;
}

/** Render a city: country context + city pin */
export function renderCityMap(container, cityFeature, allCountries, showNeighbors, styleMode = 'dual') {
  const w = 800;
  const h = 800;
  container.innerHTML = '';

  const [lng, lat] = cityFeature.geometry.coordinates;
  const cityName   = cityFeature.properties.name || cityFeature.properties.NAME || '';

  // Find home country bounds
  const homeCountry = allCountries.features.find(f => d3.geoContains(f, [lng, lat])) || 
     { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-180,-90],[180,-90],[180,90],[-180,90],[-180,-90]]] } };

  const proj = d3.geoMercator()
    .fitExtent([[PAD, PAD], [w - PAD, h - PAD]], homeCountry)
    .clipExtent([[0, 0], [w, h]]);
  const path = d3.geoPath().projection(proj);

  const svgs = [];

  const createMap = (opts) => {
    const svg = d3.create('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%');

    const g = svg.append('g');

    if (showNeighbors) {
      g.selectAll('.ctx')
        .data(allCountries.features.filter(f => f.id !== homeCountry.id && path(f)))
        .join('path')
        .attr('class', 'ctx')
        .attr('d', path)
        .attr('fill', opts.ctxFill)
        .attr('stroke', opts.ctxStroke)
        .attr('stroke-width', 0.5);
    }

    g.append('path')
      .datum(homeCountry)
      .attr('fill', opts.fill)
      .attr('stroke', opts.borderStroke)
      .attr('stroke-width', 2.0)
      .attr('stroke-linejoin', 'round')
      .attr('d', path);

    const [cx, cy] = proj([lng, lat]);

    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 12)
      .attr('fill', 'none').attr('stroke', opts.pin).attr('stroke-width', 2).attr('opacity', 0.5);

    g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 6)
      .attr('fill', opts.pin).attr('stroke', opts.pinBorder).attr('stroke-width', 2);

    return svg.node();
  };

  if (styleMode === 'dual') {
    svgs.push(createMap(MAP_STYLES.outlineOnly));
    svgs.push(createMap(MAP_STYLES.solidFilled));
    svgs.push(createMap(MAP_STYLES.silhouetteBlack));
  } else {
    const selectedOpts = MAP_STYLES[styleMode] || MAP_STYLES.minimalistGray;
    svgs.push(createMap(selectedOpts));
  }

  svgs.forEach(node => container.appendChild(node));
  return svgs;
}

/** Render Region Map (Subdivisions/Districts) */
export function renderRegionMap(container, countryFeature, allCountries, statesData, districtsData, riversData, styleMode = 'dual') {
  const w = 800;
  const h = 800;
  container.innerHTML = '';

  const proj = d3.geoMercator()
    .fitExtent([[PAD, PAD], [w - PAD, h - PAD]], countryFeature)
    .clipExtent([[0, 0], [w, h]]);
  const path = d3.geoPath().projection(proj);

  // Filter divisions of this country
  const countryDivisions = statesData ? statesData.features.filter(f => {
    const targetA3 = countryFeature.properties.adm0_a3;
    const targetISO = countryFeature.properties.iso_a2;
    
    // Primary match: ISO_A3 or ADM0_A3
    const match = (targetA3 && (f.properties.adm0_a3 === targetA3 || f.properties.sov_a3 === targetA3)) ||
                  (targetISO && f.properties.iso_a2 === targetISO);
                  
    // Fallback: Geometric containment (useful if codes are missing)
    return match || d3.geoContains(countryFeature, d3.geoCentroid(f));
  }) : [];

  if (countryDivisions.length === 0) {
    console.warn(`No divisions found for ${countryFeature.properties.name}. Check ISO codes or geometry.`);
  }

  const countryRivers = riversData ? riversData.features.filter(r => {
    if (!path(r)) return false;
    const coords = r.geometry.type === 'LineString' ? r.geometry.coordinates : (r.geometry.coordinates[0] || []);
    const samplePts = [coords[0], coords[Math.floor(coords.length / 2)], coords[coords.length - 1]];
    return samplePts.some(pt => pt && d3.geoContains(countryFeature, pt));
  }) : [];

  // Curated premium color palette for divisions (Soft Teals, Slates, Muted Greens)
  const premiumPalette = [
    '#0f766e', '#115e59', '#134e4a', // Darker Teals
    '#334155', '#475569', '#64748b', // Slates
    '#166534', '#15803d', '#14532d'  // Darker Greens
  ];
  const colorScale = d3.scaleOrdinal(premiumPalette);

  const svgs = [];

  const createMap = (opts) => {
    const svg = d3.create('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%');

    const g = svg.append('g');

    // 0. Clip Path for internal elements (so they don't bleed out of country boundaries)
    const clipId = 'clip-' + Math.random().toString(36).substr(2, 9);
    g.append('clipPath')
      .attr('id', clipId)
      .append('path')
      .datum(countryFeature)
      .attr('d', path);

    const clipped = g.append('g').attr('clip-path', `url(#${clipId})`);

    // 1. Fill divisions with colors
    clipped.selectAll('.division-fill')
      .data(countryDivisions)
      .join('path')
      .attr('class', 'division-fill')
      .attr('d', path)
      .attr('fill', (d, i) => opts.isRegion ? colorScale(i) : opts.fill)
      .attr('stroke', 'none');

    // 2. Draw Districts (inner thin lines)
    if (districtsData) {
      clipped.selectAll('.district-line')
        .data(districtsData.features)
        .join('path')
        .attr('class', 'district-line')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', opts.districtStroke || '#ffffff')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.6);
    }

    // 2.1 Draw Rivers (Land-divided rivers)
    if (countryRivers.length > 0) {
      clipped.selectAll('.river')
        .data(countryRivers)
        .join('path')
        .attr('class', 'river')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', opts.riverStroke || '#88ccff')
        .attr('stroke-width', 2.0)
        .attr('opacity', 1.0)
        .attr('vector-effect', 'non-scaling-stroke');
    }

    // 3. Draw Division Borders (thicker)
    g.selectAll('.division-border')
      .data(countryDivisions)
      .join('path')
      .attr('class', 'division-border')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', opts.borderStroke || '#000000')
      .attr('stroke-width', 1.0);

    // 4. Labels for Divisions
    g.selectAll('.division-label')
      .data(countryDivisions)
      .join('text')
      .attr('class', 'division-label')
      .attr('transform', d => {
        const centroid = d3.geoCentroid(d);
        const [x, y] = proj(centroid);
        return `translate(${x},${y})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', opts.labelColor || '#000000')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('font-family', 'Inter')
      .attr('style', 'pointer-events:none; text-shadow: 0 0 2px #fff;')
      .text(d => (d.properties.name || d.properties.NAME || '').toUpperCase());

    return svg.node();
  };

  const styleRegion = {
    isRegion: true,
    fill: 'none',
    borderStroke: '#111',
    districtStroke: '#fff',
    riverStroke: '#ffffff',
    labelColor: '#000'
  };

  const styleSolid = {
    isRegion: true,
    fill: '#000',
    borderStroke: '#fff',
    districtStroke: '#444',
    riverStroke: '#ffffff',
    labelColor: '#fff'
  };

  const styleSilhouette = {
    isRegion: true,
    fill: '#000',
    borderStroke: 'none',
    districtStroke: 'none',
    riverStroke: 'none',
    labelColor: 'none'
  };

  if (styleMode === 'dual') {
    svgs.push(createMap(styleRegion));
    svgs.push(createMap(styleSolid));
    svgs.push(createMap(styleSilhouette));
  } else {
    const selectedOpts = MAP_STYLES[styleMode] || styleRegion;
    const mergedOpts = { ...selectedOpts, isRegion: true };
    svgs.push(createMap(mergedOpts));
  }

  svgs.forEach(node => container.appendChild(node));
  return svgs;
}

export function buildExportSVG(feature, allCountries, statesData, riversData, mode, styleMode = 'dual') {
  // Export logic will need to handle multiple svgs or single depending on requirements later.
  // We'll return the first generated SVG string to keep it simple for now or loop for multiple.
}
