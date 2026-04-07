// ============================================================
// mapRenderer.js — D3 map rendering
// ============================================================

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const PAD = 50;

function makeProjection() {
  return d3.geoMercator();
}

export const MAP_STYLES = {
  minimalistGray:    { id: 'minimalistGray',    fill: '#242424', borderStroke: '#e0e0e0', stateStroke: '#888888', riverStroke: 'none',    ctxFill: '#1a1a1a', ctxStroke: '#444444' },
  outlineOnly:       { id: 'outlineOnly',       fill: 'none',    borderStroke: '#ffffff', stateStroke: '#ffffff', riverStroke: 'none',    ctxFill: 'none',    ctxStroke: '#666666' },
  filledBorders:     { id: 'filledBorders',     fill: '#333333', borderStroke: '#ffffff', stateStroke: '#a0a0a0', riverStroke: 'none',    ctxFill: '#222222', ctxStroke: '#555555' },
  solidFilled:       { id: 'solidFilled',       fill: '#ffffff', borderStroke: 'none',    stateStroke: '#000000', riverStroke: '#000000', ctxFill: 'none',    ctxStroke: 'none' },
  darkMode:          { id: 'darkMode',          fill: '#1e293b', borderStroke: '#ffffff', stateStroke: '#64748b', riverStroke: '#3b82f6', ctxFill: '#0f172a', ctxStroke: '#334155' },
  vibrant:           { id: 'vibrant',           fill: '#ec4899', borderStroke: '#831843', stateStroke: '#fbcfe8', riverStroke: '#bfdbfe', ctxFill: '#fdf2f8', ctxStroke: '#f9a8d4' },
  earthTones:        { id: 'earthTones',        fill: '#fef3c7', borderStroke: '#78350f', stateStroke: '#d97706', riverStroke: '#60a5fa', ctxFill: '#fffbeb', ctxStroke: '#fcd34d' },
  midnightBlue:      { id: 'midnightBlue',      fill: '#1e3a8a', borderStroke: '#bfdbfe', stateStroke: '#60a5fa', riverStroke: '#93c5fd', ctxFill: '#172554', ctxStroke: '#1e40af' },
  posterGray:        { id: 'posterGray',        fill: '#475569', borderStroke: '#1e293b', stateStroke: '#94a3b8', riverStroke: '#cbd5e1', ctxFill: '#f8fafc', ctxStroke: '#e2e8f0' },
  combo3:            { id: 'combo3',            fill: '#e2e8f0', borderStroke: '#1e293b', stateStroke: '#334155', riverStroke: '#0ea5e9', ctxFill: '#f4f4f5', ctxStroke: '#d4d4d8', useCategoricalStates: true }
};

/** Render Country Map — Returns an Array of SVGs based on styleMode */
export function renderCountryMap(container, feature, allCountries, statesData, riversData, showNeighbors = false, styleMode = 'combo3') {
  const w = 800;
  const h = 800;
  container.innerHTML = '';

  const proj = makeProjection()
    .fitExtent([[PAD, PAD], [w - PAD, h - PAD]], feature);
  const path = d3.geoPath().projection(proj);

  const svgs = [];

  const createMap = (opts) => {
    const svg = d3.create('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g');

    // Neighbors
    if (showNeighbors) {
      g.selectAll('.ctx')
        .data(allCountries.features.filter(f => f.id !== feature.id && path(f)))
        .join('path')
        .attr('class', 'ctx')
        .attr('d', path)
        .attr('fill', opts.ctxFill || '#f0f0f0')
        .attr('stroke', opts.ctxStroke || '#ccc')
        .attr('stroke-width', 0.5);
    }

    // Base fill
    g.append('path')
      .datum(feature)
      .attr('fill', opts.fill)
      .attr('d', path);

    // Clip for internal detail
    const clipId = 'clip-' + Math.random().toString(36).substr(2, 9);
    g.append('clipPath')
      .attr('id', clipId)
      .append('path')
      .datum(feature)
      .attr('d', path);

    const clipped = g.append('g').attr('clip-path', `url(#${clipId})`);

    // Land Divisions (States/Provinces)
    let countryStates = statesData ? statesData.features.filter(s => {
      const targetISO = feature.properties.iso_a2 || feature.properties.ISO_A2;
      const targetA3 = feature.properties.adm0_a3 || feature.properties.ADM0_A3;
      
      const sISO = s.properties.iso_a2 || s.properties.ISO_A2;
      const sA3 = s.properties.adm0_a3 || s.properties.ADM0_A3;
      
      return (targetISO && sISO === targetISO) || (targetA3 && sA3 === targetA3) || d3.geoContains(feature, d3.geoCentroid(s));
    }) : [];

    if (countryStates.length > 0 && opts.stateStroke !== 'none') {
      const colors = ["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"];
      const colorScale = d3.scaleOrdinal(colors);

      clipped.selectAll('.state')
        .data(countryStates)
        .join('path')
        .attr('d', path)
        .attr('fill', opts.useCategoricalStates ? (d, i) => colorScale(i) : 'none')
        .attr('stroke', opts.stateStroke)
        .attr('stroke-width', 1.0)
        .attr('vector-effect', 'non-scaling-stroke');

      // Draw map text labels for details over colored boundaries
      if (opts.useCategoricalStates) {
        clipped.selectAll('.state-label')
          .data(countryStates.filter(d => {
            const centroid = path.centroid(d);
            return !isNaN(centroid[0]) && !isNaN(centroid[1]);
          }))
          .join('text')
          .attr('class', 'state-label')
          .attr('transform', d => `translate(${path.centroid(d)[0]},${path.centroid(d)[1]})`)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .text(d => {
            const p = d.properties;
            const rawName = p.ADM2_EN || p.NAME_2 || p.name || p.NAME || p.ADM1_EN || p.Dist_Name || p.DISTRICT || '';
            if (!rawName) return '';
            // Capitalize for map display
            return rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
          })
          .style('font-size', '6.5px')
          .style('font-family', 'Inter, sans-serif')
          .style('font-weight', '700')
          .style('fill', '#111827')
          .style('pointer-events', 'none')
          .style('paint-order', 'stroke')
          .style('stroke', '#ffffff')
          .style('stroke-width', '1.5px');
      }
    }

    // Rivers
    if (riversData && opts.riverStroke !== 'none') {
      const countryRivers = riversData.features.filter(r => {
        if (!path(r)) return false;
        return d3.geoContains(feature, r.geometry.type === 'LineString' ? r.geometry.coordinates[0] : r.geometry.coordinates[0][0]);
      });
      clipped.selectAll('.river')
        .data(countryRivers)
        .join('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', opts.riverStroke)
        .attr('stroke-width', 1.5)
        .attr('vector-effect', 'non-scaling-stroke');
    }

    // Outer border
    if (opts.borderStroke && opts.borderStroke !== 'none') {
      g.append('path')
        .datum(feature)
        .attr('fill', 'none')
        .attr('stroke', opts.borderStroke)
        .attr('stroke-width', 1.5)
        .attr('d', path);
    }

    return svg.node();
  };

  if (styleMode === 'combo3') {
    svgs.push(createMap(MAP_STYLES.outlineOnly));
    svgs.push(createMap(MAP_STYLES.solidFilled));
    svgs.push(createMap(MAP_STYLES.combo3));
  } else {
    svgs.push(createMap(MAP_STYLES[styleMode] || MAP_STYLES.minimalistGray));
  }

  svgs.forEach(node => container.appendChild(node));
  return svgs;
}

export function renderWorldMap(container, allCountries, styleMode = 'combo3') {
  const w = 1000;
  const h = 600;
  container.innerHTML = '';
  const proj = d3.geoMercator().fitSize([w, h], allCountries);
  const path = d3.geoPath().projection(proj);
  const opts = MAP_STYLES[styleMode] || MAP_STYLES.minimalistGray;

  const svg = d3.create('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('width', '100%').attr('height', '100%');

  svg.append('g').selectAll('path')
    .data(allCountries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', opts.fill === 'none' ? '#fff' : opts.fill)
    .attr('stroke', opts.borderStroke || '#000')
    .attr('stroke-width', 0.2);

  container.appendChild(svg.node());
}

export function renderCityMap(container, cityFeature, allCountries, statesData, riversData, showNeighbors, styleMode = 'combo3') {
  const w = 800, h = 800;
  container.innerHTML = '';
  const [lng, lat] = cityFeature.geometry.coordinates;
  
  // Try to find by code first
  const a3 = cityFeature.properties.adm0_a3 || cityFeature.properties.ADM0_A3 || cityFeature.properties.adm0_a3_us;
  let homeCountry;
  if (a3) {
      homeCountry = allCountries.features.find(f => (f.properties.adm0_a3 || f.properties.ISO_A3) === a3);
  }
  if (!homeCountry) {
      homeCountry = allCountries.features.find(f => d3.geoContains(f, [lng, lat]));
  }
  homeCountry = homeCountry || allCountries.features[0];

  // Guarantee a precise zoom by explicitly setting the scale and center rather than relying on D3 bounding math
  const proj = d3.geoMercator()
    .center([lng, lat])
    .scale(15000)
    .translate([w / 2, h / 2])
    .clipExtent([[0, 0], [w, h]]);
  const path = d3.geoPath().projection(proj);
  const svgs = [];

  const createMap = (opts) => {
    const svg = d3.create('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('width', '100%').attr('height', '100%')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g');

    // Neighbors
    if (showNeighbors) {
      g.selectAll('.ctx')
        .data(allCountries.features.filter(f => f.id !== homeCountry.id && path(f)))
        .join('path')
        .attr('class', 'ctx')
        .attr('d', path)
        .attr('fill', opts.ctxFill || '#f0f0f0')
        .attr('stroke', opts.ctxStroke || '#ccc')
        .attr('stroke-width', 0.5);
    }

    g.append('path')
      .datum(homeCountry)
      .attr('fill', opts.fill)
      .attr('stroke', (opts.borderStroke && opts.borderStroke !== 'none') ? opts.borderStroke : '#000')
      .attr('stroke-width', 1.5)
      .attr('d', path);

    const clipId = 'clip-city-' + Math.random().toString(36).substr(2, 9);
    g.append('clipPath')
      .attr('id', clipId)
      .append('path')
      .datum(homeCountry)
      .attr('d', path);

    const clipped = g.append('g').attr('clip-path', `url(#${clipId})`);

    let countryStates = statesData ? statesData.features.filter(s => {
      const targetISO = homeCountry.properties.iso_a2 || homeCountry.properties.ISO_A2;
      const targetA3 = homeCountry.properties.adm0_a3 || homeCountry.properties.ADM0_A3;
      
      const sISO = s.properties.iso_a2 || s.properties.ISO_A2;
      const sA3 = s.properties.adm0_a3 || s.properties.ADM0_A3;
      
      return (targetISO && sISO === targetISO) || (targetA3 && sA3 === targetA3) || d3.geoContains(homeCountry, d3.geoCentroid(s));
    }) : [];

    if (countryStates.length > 0 && opts.stateStroke !== 'none') {
      const colors = ["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"];
      const colorScale = d3.scaleOrdinal(colors);

      clipped.selectAll('.state')
        .data(countryStates)
        .join('path')
        .attr('d', path)
        .attr('fill', opts.useCategoricalStates ? (d, i) => colorScale(i) : 'none')
        .attr('stroke', opts.stateStroke)
        .attr('stroke-width', 2.0)
        .attr('vector-effect', 'non-scaling-stroke');
    }

    if (riversData && opts.riverStroke !== 'none') {
      const countryRivers = riversData.features.filter(r => {
        if (!path(r)) return false;
        return d3.geoContains(homeCountry, r.geometry.type === 'LineString' ? r.geometry.coordinates[0] : r.geometry.coordinates[0][0]);
      });
      clipped.selectAll('.river')
        .data(countryRivers)
        .join('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', opts.riverStroke)
        .attr('stroke-width', 2.5)
        .attr('vector-effect', 'non-scaling-stroke');
    }

    const [cx, cy] = proj([lng, lat]);
    g.append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', 8)
      .attr('fill', '#ef4444')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    return svg.node();
  };

  if (styleMode === 'combo3') {
    svgs.push(createMap(MAP_STYLES.outlineOnly));
    svgs.push(createMap(MAP_STYLES.solidFilled));
    svgs.push(createMap(MAP_STYLES.combo3));
  } else {
    svgs.push(createMap(MAP_STYLES[styleMode] || MAP_STYLES.minimalistGray));
  }

  svgs.forEach(node => container.appendChild(node));
}

export function renderRegionMap(container, feature, allCountries, statesData, districtsData, riversData, styleMode = 'combo3') {
  return renderCountryMap(container, feature, allCountries, districtsData || statesData, riversData, false, styleMode);
}
