// ============================================================
// main.js — App orchestrator (MapNest Redesign)
// ============================================================

import { loadCountries, loadCities, loadStates, loadRivers, loadDistricts } from './dataLoader.js';
import { searchCountries, searchCities }                from './search.js';
import { renderCountryMap, renderCityMap, renderRegionMap, renderWorldMap } from './mapRenderer.js';
import { exportSVG }                                    from './exporter.js';

// ── State ────────────────────────────────────────────────────
const state = {
  mode:            'country',
  countries:       null,
  cities:          null,
  selectedFeature: null,
  searchTimer:     null,
  activeIndex:     -1,
};

// ── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const searchInput        = $('search-input');
const searchInputWrapper = $('search-input-wrapper');
const selectionChip      = $('selection-chip');
const chipValue          = $('chip-value');
const chipRemove         = $('chip-remove');
const searchDropdown     = $('search-dropdown');
const searchClear        = $('search-clear');

const mapViewport      = $('map-viewport');
const emptyState       = $('empty-state');
const loadingState     = $('loading-state');
const mapOutput        = $('map-output');
const svgContainer     = $('svg-container');
const mapLabel         = $('map-label');

const btnGenerate      = $('btn-generate');
const btnExport        = $('btn-export');
const styleSelect      = $('style-select');
const neighborToggle   = $('neighbor-toggle');

const mapTypeRadios    = document.querySelectorAll('.map-type-radio');

// ── Boot ─────────────────────────────────────────────────────
async function init() {
  bindEvents();
  try { state.countries = await loadCountries(); } catch { }
}

// ── Events ───────────────────────────────────────────────────
function bindEvents() {
  mapTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) switchMode(e.target.value);
    });
  });

  searchInput.addEventListener('input',   onSearchInput);
  searchInput.addEventListener('focus',   onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeydown);

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    closeDropdown();
  });

  chipRemove.addEventListener('click', clearSearch);

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container')) closeDropdown();
  });

  btnGenerate.addEventListener('click', handleGenerate);
  btnExport.addEventListener('click', handleExport);

  // Keyboard nav inside dropdown
  searchDropdown.addEventListener('keydown', onDropdownKeydown);
  
  styleSelect.addEventListener('change', () => {
    if (mapOutput.classList.contains('active')) handleGenerate();
  });
  
  neighborToggle.addEventListener('change', () => {
    if (mapOutput.classList.contains('active')) handleGenerate();
  });
}

// ── Mode switch ──────────────────────────────────────────────
function switchMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  
  // Update visually
  document.querySelectorAll('.map-type-label').forEach(label => {
    label.classList.toggle('active', label.querySelector('.map-type-radio').checked);
  });
  
  clearSearch();
  clearMap();
}

// ── Search ───────────────────────────────────────────────────
function onSearchInput() {
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'flex' : 'none';
  
  if (!q) { closeDropdown(); return; }

  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => runSearch(q), 160);
}

async function runSearch(q) {
  if (state.mode === 'country' || state.mode === 'region') {
    if (!state.countries) {
      showDropdownMsg('loading');
      try { state.countries = await loadCountries(); }
      catch { showDropdownMsg('error', 'Could not load country data.'); return; }
    }
    const results = searchCountries(q, state.countries);
    renderDropdown(results, state.mode);
  } else if (state.mode === 'city') {
    if (!state.cities) {
      showDropdownMsg('loading');
      try { state.cities = await loadCities(); }
      catch { showDropdownMsg('error', 'Could not load city data.'); return; }
    }
    const results = searchCities(q, state.cities);
    renderDropdown(results, 'city');
  }
}

function renderDropdown(results, type) {
  state.activeIndex = -1;
  if (!results.length) {
    showDropdownMsg('empty', `No ${type} found.`);
    return;
  }

  searchDropdown.innerHTML = results.map((f, i) => {
    const name     = f.properties.name || f.properties.NAME || '—';
    const sublabel = type === 'city' ? (f.properties.adm0name || f.properties.sov0name || '') : '';
    return `
      <div class="dropdown-item" role="option" tabindex="0" data-index="${i}">
        <span style="font-weight:600">${name}</span>
        ${sublabel ? `<span style="color:#aaa; font-size:0.75rem; margin-left:6px">${sublabel}</span>` : ''}
      </div>`;
  }).join('');

  openDropdown();

  searchDropdown.querySelectorAll('.dropdown-item').forEach((el, i) => {
    el.addEventListener('click',   () => selectFeature(results[i]));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') selectFeature(results[i]); });
  });
}

function showDropdownMsg(type, text = '') {
  searchDropdown.innerHTML = `<div class="dropdown-item" style="color:#888">${text || 'Loading...'}</div>`;
  openDropdown();
}

function openDropdown()  { searchDropdown.classList.add('open'); }
function closeDropdown() { searchDropdown.classList.remove('open'); state.activeIndex = -1; }

// Arrow-key navigation inside dropdown
function onSearchKeydown(e) {
  const items = [...searchDropdown.querySelectorAll('.dropdown-item')];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.activeIndex = Math.min(state.activeIndex + 1, items.length - 1);
    items[state.activeIndex]?.focus();
  } else if (e.key === 'Escape') {
    closeDropdown();
    searchInput.blur();
  }
}

function onDropdownKeydown(e) {
  const items = [...searchDropdown.querySelectorAll('.dropdown-item')];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.activeIndex = Math.min(state.activeIndex + 1, items.length - 1);
    items[state.activeIndex]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.activeIndex = Math.max(state.activeIndex - 1, 0);
    if (state.activeIndex === 0) searchInput.focus();
    else items[state.activeIndex]?.focus();
  }
}

// ── Feature selection ────────────────────────────────────────
function selectFeature(feature) {
  state.selectedFeature = feature;
  const name = feature.properties.name || feature.properties.NAME || 'Unknown';
  
  // Show Chip, Hide Input
  chipValue.textContent = name;
  selectionChip.classList.add('active');
  searchInputWrapper.style.display = 'none';
  
  closeDropdown();
}

// ── Rendering ────────────────────────────────────────────────
async function handleGenerate() {
  if (state.mode !== 'world' && !state.selectedFeature) {
    alert("Please search and select a location first.");
    return;
  }
  
  showLoading();
  const feature = state.selectedFeature;
  const name = state.mode === 'world' ? 'World' : (feature.properties.name || feature.properties.NAME || '');
  
  // Make container active early so dimensions are available
  mapOutput.classList.add('active');
  
  try {
    if (!state.countries) state.countries = await loadCountries();
    const selectedStyle = styleSelect.value;

    if (state.mode === 'world') {
      renderWorldMap(svgContainer, state.countries, selectedStyle);
    } else if (state.mode === 'country') {
      const [statesData, riversData] = await Promise.all([loadStates(), loadRivers()]);
      renderCountryMap(
        svgContainer, 
        feature, 
        state.countries, 
        statesData, 
        riversData, 
        neighborToggle.checked, 
        selectedStyle
      );
    } else if (state.mode === 'region') {
      const [statesData, districtsData, riversData] = await Promise.all([
        loadStates(), 
        loadDistricts(feature.properties.numericId),
        loadRivers()
      ]);
      renderRegionMap(
        svgContainer, 
        feature, 
        state.countries, 
        statesData, 
        districtsData, 
        riversData,
        selectedStyle
      );
    } else if (state.mode === 'city') {
      const [statesData, riversData] = await Promise.all([loadStates(), loadRivers()]);
      renderCityMap(svgContainer, feature, state.countries, statesData, riversData, neighborToggle.checked, selectedStyle);
    }
    
    mapLabel.textContent = `${name} MAP`.toUpperCase();
    hideLoading();
    
  } catch (err) {
    console.error('Render error:', err);
    hideLoading();
    mapOutput.classList.remove('active');
    emptyState.style.display = 'block';
  }
}

// ── UI States ────────────────────────────────────────────────
function showLoading() {
  emptyState.style.display   = 'none';
  mapOutput.classList.remove('active');
  loadingState.style.display = 'flex';
  svgContainer.innerHTML     = '';
}
function hideLoading() {
  loadingState.style.display = 'none';
}

function clearSearch() {
  searchInput.value = '';
  selectionChip.classList.remove('active');
  searchInputWrapper.style.display = 'flex';
  searchClear.style.display = 'none';
  state.selectedFeature = null;
  closeDropdown();
  clearMap();
}

function clearMap() {
  mapOutput.classList.remove('active');
  svgContainer.innerHTML = '';
  emptyState.style.display = 'block';
}

// ── Export ───────────────────────────────────────────────────
async function handleExport() {
  if ((state.mode !== 'world' && !state.selectedFeature) || !mapOutput.classList.contains('active')) {
    alert("Generate a map first.");
    return;
  }

  btnExport.textContent = 'Generating…';
  const svgs = svgContainer.querySelectorAll('svg');
  if (svgs.length === 0) return;
  
  svgs.forEach((svg, i) => {
    const rawName = state.mode === 'world' ? 'world-map' : (state.selectedFeature.properties.name || 'map');
    const suffix = svgs.length > 1 ? `-style-${i+1}` : '';
    exportSVG(svg, rawName + suffix);
  });
  
  btnExport.textContent = 'Export SVG';
}

// ── Start ───────────────────────────────────────────────────
init();
