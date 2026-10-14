/**
 * Velo.LHR — Unified Search Application
 * Hotels · Airlines · Buses · Terminals
 */

const APP_VERSION = '2.0.0';
const SEARCH_INDEX_URL = '/data/search_index.json';
const HOTELS_URL = '/data/hotels.json';

/* ---------- STATE ---------- */

let searchIndex = [];
let hotels = [];
let hotelsById = {};
let searchQuery = '';

/* ---------- CONSTANTS ---------- */

const CATEGORY_META = {
  hotel:    { icon: '🏨', label: 'Hotel' },
  airline:  { icon: '✈️', label: 'Air Lines' },
  bus:      { icon: '🚌', label: 'Buses' },
  terminal: { icon: '🛫', label: 'Terminal' }
};

const CATEGORY_ORDER = ['hotel', 'airline', 'bus', 'terminal'];

/* ---------- UTILITIES ---------- */

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

function isValidValue(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v !== '' && v !== 'not listed' && v !== '#error!' && v !== 'n/a' && v !== 'none';
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function showStatus(message, type = 'info', duration = 0) {
  const bar = document.getElementById('status-bar');
  const text = document.getElementById('status-text');
  text.textContent = message;
  bar.className = 'status-bar ' + type;
  bar.classList.remove('hidden');
  if (duration > 0) {
    clearTimeout(bar._timer);
    bar._timer = setTimeout(() => bar.classList.add('hidden'), duration);
  }
}

/* ---------- DATA LOADING ---------- */

async function fetchJSON(url) {
  const res = await fetch(url + '?t=' + Date.now());
  if (!res.ok) throw new Error('Fetch failed: ' + url);
  return res.json();
}

async function loadData() {
  try {
    const [indexData, hotelsData] = await Promise.all([
      fetchJSON(SEARCH_INDEX_URL),
      fetchJSON(HOTELS_URL)
    ]);

    searchIndex = indexData.entries || [];
    hotels = hotelsData.hotels || hotelsData;

    try {
      await window.HotelDB.saveHotels(hotels, indexData.version || '2.0.0');
      const db = await window.HotelDB.openDB();
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key: 'searchIndex', value: searchIndex });
    } catch (e) {
      console.warn('[Velo.LHR] Cache write failed:', e);
    }

    console.log('[Velo.LHR] Loaded:', searchIndex.length, 'entries,', hotels.length, 'hotels');
  } catch (err) {
    console.warn('[Velo.LHR] Network failed, trying cache:', err);
    try {
      const cachedIndex = await window.HotelDB.getMeta('searchIndex');
      const cachedHotels = await window.HotelDB.getAllHotels();
      if (cachedIndex) searchIndex = cachedIndex;
      if (cachedHotels) hotels = cachedHotels;
      if (searchIndex.length || hotels.length) {
        showStatus('Offline mode — showing cached data', 'offline');
      }
    } catch (e) {
      console.warn('[Velo.LHR] Cache read failed:', e);
    }
  }

  hotelsById = {};
  hotels.forEach((h, i) => {
    if (h.id) hotelsById[h.id] = h;
    hotelsById['hotel-' + (i + 1)] = h;
  });
}

/* ---------- SEARCH ---------- */

function scoreEntry(entry, query) {
  if (!query) return 0;
  const q = normalize(query);
  const name = normalize(entry.name);
  const aliases = (entry.aliases || []).map(normalize);
  const group = normalize(entry.group);

  let score = 0;

  if (name === q) score += 100;
  else if (name.startsWith(q)) score += 60;
  else if (name.includes(q)) score += 30;

  for (const a of aliases) {
    if (!a) continue;
    if (a === q) score += 80;
    else if (a.startsWith(q)) score += 40;
    else if (a.includes(q)) score += 15;
  }

  if (group && group.includes(q)) score += 20;

  if (score > 0) {
    const p = entry.priority || 3;
    score += (4 - p) * 5;
  }

  return score;
}

function searchGrouped(query) {
  const results = { hotel: [], airline: [], bus: [], terminal: [] };
  if (!query || query.trim().length < 2) return results;

  const scored = [];
  for (const entry of searchIndex) {
    const s = scoreEntry(entry, query);
    if (s > 0) scored.push({ entry, score: s });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.entry.priority || 3) - (b.entry.priority || 3);
  });

  for (const { entry } of scored) {
    if (results[entry.type]) results[entry.type].push(entry);
  }

  return results;
}

/* ---------- DROPDOWN ---------- */

function renderDropdown(groups, query) {
  const dd = document.getElementById('search-dropdown');
  const input = document.getElementById('search-input');

  const total = CATEGORY_ORDER.reduce((s, k) => s + (groups[k]?.length || 0), 0);

  if (total === 0) {
    dd.innerHTML = `
      <div class="dd-empty">
        No results for "<strong>${escapeHtml(query)}</strong>"
      </div>`;
    dd.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    return;
  }

  let html = '';

  for (const cat of CATEGORY_ORDER) {
    const items = groups[cat] || [];
    if (items.length === 0) continue;
    const meta = CATEGORY_META[cat];

    const chips = items.slice(0, 3).map((item) => {
      const terminals = (item.terminals || []).join('/');
      return `
        <button class="dd-chip" data-id="${escapeHtml(item.id)}">
          ${escapeHtml(item.name)}
          ${terminals ? `<span class="dd-chip-t">${escapeHtml(terminals)}</span>` : ''}
        </button>`;
    }).join('');

    const more = items.length > 3
      ? `<button class="dd-more" data-cat="${cat}">+${items.length - 3} more</button>`
      : '';

    html += `
      <div class="dd-line">
        <span class="dd-icon">${meta.icon}</span>
        <span class="dd-label">${meta.label}:</span>
        <div class="dd-chips">${chips}${more}</div>
      </div>`;
  }

  dd.innerHTML = html;
  dd.classList.remove('hidden');
  input.setAttribute('aria-expanded', 'true');

  dd.querySelectorAll('.dd-chip').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDropdown();
      handleSelect(el.dataset.id);
    });
  });

  dd.querySelectorAll('.dd-more').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDropdown();
      openCategoryList(el.dataset.cat, query);
    });
  });
}

function hideDropdown() {
  const dd = document.getElementById('search-dropdown');
  const input = document.getElementById('search-input');
  if (dd) dd.classList.add('hidden');
  if (input) input.setAttribute('aria-expanded', 'false');
}

/* ---------- DETAIL CARD ---------- */

function showDetailCard(html) {
  const card = document.getElementById('detail-card');
  card.innerHTML = html;
  card.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeDetailCard() {
  const card = document.getElementById('detail-card');
  card.classList.add('hidden');
  card.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.__closeDetail = closeDetailCard;

/* ---------- SELECTION ---------- */

function handleSelect(id) {
  const entry = searchIndex.find((e) => e.id === id);
  if (!entry) return;

  if (entry.type === 'hotel') {
    const hotel = hotelsById[id];
    if (hotel) openHotelDetail(hotel);
    else openGenericDetail(entry);
  } else {
    openGenericDetail(entry);
  }
}

function openCategoryList(cat, query) {
  const groups = searchGrouped(query);
  const items = groups[cat] || [];
  const meta = CATEGORY_META[cat];

  const rowsHtml = items.map((item) => {
    const t = (item.terminals || []).map((x) =>
      `<span class="tag terminal">${escapeHtml(x)}</span>`).join('');
    const aliases = (item.aliases || []).slice(0, 3).join(' · ');
    return `
      <div class="detail-row detail-clickable" data-id="${escapeHtml(item.id)}"
           style="cursor:pointer;padding:0.75rem 1rem;border-radius:8px;">
        <span class="detail-label" style="min-width:auto;font-size:1.1rem;">${meta.icon}</span>
        <span class="detail-value" style="text-align:left;">
          <strong>${escapeHtml(item.name)}</strong>
          ${aliases ? `<div style="font-size:0.75rem;color:var(--text-muted);font-weight:400;margin-top:2px;">${escapeHtml(aliases)}</div>` : ''}
        </span>
        <span style="display:flex;gap:4px;">${t}</span>
      </div>`;
  }).join('');

  showDetailCard(`
    <div class="detail-header">
      <div class="detail-title-wrap">
        <div class="detail-name">${meta.icon} ${meta.label} · "${escapeHtml(query)}"</div>
        <div class="detail-stars">${items.length} result${items.length !== 1 ? 's' : ''}</div>
      </div>
      <button class="detail-close" onclick="window.__closeDetail()">✕</button>
    </div>
    <div class="detail-body">${rowsHtml}</div>
  `);

  document.querySelectorAll('#detail-card .detail-clickable').forEach((el) => {
    el.addEventListener('click', () => {
      closeDetailCard();
      setTimeout(() => handleSelect(el.dataset.id), 200);
    });
  });
}

/* ---------- HOTEL DETAIL ---------- */

function openHotelDetail(hotel) {
  const terminals = (hotel.terminals || []).map((t) =>
    `<span class="tag terminal">${escapeHtml(t)}</span>`).join('');

  const stars = isValidValue(hotel.starRating) ? hotel.starRating : '';
  const address = isValidValue(hotel.address) ? hotel.address : '';
  const phone = isValidValue(hotel.phone) ? hotel.phone : '';
  const email = isValidValue(hotel.email) ? hotel.email : '';
  const website = isValidValue(hotel.website) ? hotel.website : '';

  const routeBlocks = (hotel.terminals || [])
    .map((t) => buildRouteBlock(hotel, t))
    .join('');

  const contactRows = [
    phone ? `<div class="detail-row">
      <span class="detail-label">📞 Phone</span>
      <span class="detail-value"><a href="tel:${escapeHtml(phone.replace(/\s/g, ''))}">${escapeHtml(phone)}</a></span>
    </div>` : '',
    email ? `<div class="detail-row">
      <span class="detail-label">✉️ Email</span>
      <span class="detail-value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></span>
    </div>` : '',
    website ? `<div class="detail-row">
      <span class="detail-label">🌐 Website</span>
      <span class="detail-value"><a href="https://${escapeHtml(website)}" target="_blank" rel="noopener">${escapeHtml(website)}</a></span>
    </div>` : ''
  ].filter(Boolean).join('');

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name + ' Heathrow Airport')}`;

  showDetailCard(`
    <div class="detail-header">
      <div class="detail-title-wrap">
        <div class="detail-name">🏨 ${escapeHtml(hotel.name)}</div>
        ${stars ? `<div class="detail-stars">${escapeHtml(stars)}</div>` : ''}
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div class="detail-terminals">${terminals}</div>
        <button class="detail-close" onclick="window.__closeDetail()">✕</button>
      </div>
    </div>

    <div class="detail-body">
      ${address ? `<div class="detail-row">
        <span class="detail-label">📍 Address</span>
        <span class="detail-value">${escapeHtml(address)}</span>
      </div>` : ''}
      ${isValidValue(hotel.travelMethod) ? `<div class="detail-row">
        <span class="detail-label">🚏 Transport</span>
        <span class="detail-value">${escapeHtml(hotel.travelMethod)}</span>
      </div>` : ''}
      ${isValidValue(hotel.travelTime) ? `<div class="detail-row">
        <span class="detail-label">⏱️ Travel Time</span>
        <span class="detail-value">${escapeHtml(hotel.travelTime)}</span>
      </div>` : ''}
    </div>

    <div style="margin-top:1.75rem;">
      <div class="route-section-title">How to get there</div>
      ${routeBlocks || '<div class="detail-row"><span class="detail-value">Route info not available.</span></div>'}
    </div>

    ${contactRows ? `
    <div style="margin-top:1.75rem;padding-top:1.5rem;border-top:1px solid var(--border);">
      <div class="route-section-title">Contact</div>
      <div class="detail-body">${contactRows}</div>
    </div>` : ''}

    <div class="inline-warning">
      ⚠️ Data may not be up to date. Please verify details with the hotel before booking.
    </div>

    <div class="detail-footer">
      <a class="action-btn primary" href="${mapsUrl}" target="_blank" rel="noopener">
        🗺️ Open in Google Maps
      </a>
      ${website ? `<a class="action-btn secondary" href="https://${escapeHtml(website)}" target="_blank" rel="noopener">
        🌐 Website
      </a>` : ''}
    </div>
  `);
}

function buildRouteBlock(hotel, terminal) {
  const t = String(terminal).toUpperCase();
  let distance = '';
  if (t === 'T2' || t === 'T3') distance = hotel.distanceT2T3;
  if (t === 'T4') distance = hotel.distanceT4;
  if (t === 'T5') distance = hotel.distanceT5;

  const method = isValidValue(hotel.travelMethod) ? hotel.travelMethod : 'Check with hotel';
  const time = isValidValue(hotel.travelTime) ? hotel.travelTime : '';

  const busMatch = method.match(/(?:Bus|Hoppa|Shuttle)\s*([A-Z]?\d+[A-Z]?)/i);
  const standMatch = method.match(/Stand\s*(\d+)/i);

  const steps = [];

  steps.push(`
    <div class="route-step">
      <div class="step-num">1</div>
      <div class="step-text">
        <strong>Start at ${escapeHtml(t)}</strong>
        <span> Follow signs to transport connections.</span>
      </div>
    </div>
  `);

  if (busMatch || standMatch) {
    const stand = standMatch ? standMatch[1] : '—';
    steps.push(`
      <div class="route-step">
        <div class="step-num">2</div>
        <div class="step-text">
          <strong>Take ${escapeHtml(method)}</strong>
          <span> Board at <strong>Stand ${escapeHtml(stand)}</strong> at ${escapeHtml(t)}.</span>
        </div>
      </div>
    `);
  } else {
    steps.push(`
      <div class="route-step">
        <div class="step-num">2</div>
        <div class="step-text">
          <strong>${escapeHtml(method)}</strong>
          <span>${time ? ' Approx. ' + escapeHtml(time) + '.' : ''}</span>
        </div>
      </div>
    `);
  }

  steps.push(`
    <div class="route-step">
      <div class="step-num">3</div>
      <div class="step-text">
        <strong>Arrive at ${escapeHtml(hotel.name)}</strong>
        ${distance ? `<span> Distance: ${escapeHtml(distance)}.</span>` : ''}
      </div>
    </div>
  `);

  return `
    <div>
      <div class="route-terminal-title">From ${escapeHtml(t)}</div>
      <div class="route-block">${steps.join('')}</div>
    </div>
  `;
}

/* ---------- GENERIC DETAIL (with terminal switching) ---------- */

function openGenericDetail(entry) {
  const terminals = entry.terminals || [];
  const defaultTerminal = terminals[0] || 'T2';
  renderGenericDetail(entry, defaultTerminal);
}

function renderGenericDetail(entry, activeTerminal) {
  const meta = CATEGORY_META[entry.type] || { icon: '•', label: 'Item' };
  const terminals = entry.terminals || [];
  const aliases = entry.aliases || [];

  const terminalChips = terminals.map((t) => {
    const isActive = t === activeTerminal;
    return `<span class="tag terminal ${isActive ? 'active' : ''}"
                  data-terminal="${escapeHtml(t)}"
                  role="button"
                  tabindex="0">${escapeHtml(t)}</span>`;
  }).join('');

  const groupRow = entry.group ? `
    <div class="detail-row">
      <span class="detail-label">🏷️ Alliance</span>
      <span class="detail-value">${escapeHtml(entry.group)}</span>
    </div>` : '';

  const aliasesRow = aliases.length ? `
    <div class="detail-row">
      <span class="detail-label">🔖 Also</span>
      <span class="detail-value">${escapeHtml(aliases.join(', '))}</span>
    </div>` : '';

  const checkRow = entry.confidence === 'check' ? `
    <div class="detail-row">
      <span class="detail-label">⚠️ Note</span>
      <span class="detail-value" style="color:var(--warning);">Verify with official sources.</span>
    </div>` : '';

  let relatedHotelsHtml = '';
  if (entry.type === 'bus') {
    const busName = entry.name.replace(/^Bus\s+/i, '').trim().toLowerCase();
    const related = hotels.filter((h) => {
      const m = (h.travelMethod || '').toLowerCase();
      return busName && m.includes(busName);
    }).slice(0, 6);

    if (related.length > 0) {
      relatedHotelsHtml = `
        <div style="margin-top:1.75rem;padding-top:1.5rem;border-top:1px solid var(--border);">
          <div class="route-section-title">Hotels using this service</div>
          <div class="detail-body">
            ${related.map((h) => `
              <div class="detail-row detail-clickable" data-hotel-id="${escapeHtml(h.id)}"
                   style="cursor:pointer;border-radius:8px;padding:0.5rem 0.75rem;margin:0 -0.75rem;">
                <span class="detail-label">🏨</span>
                <span class="detail-value" style="text-align:left;">${escapeHtml(h.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
  }

  const howToBlock = buildHowToBlock(entry, activeTerminal);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.name + ' Heathrow Airport ' + activeTerminal)}`;

  showDetailCard(`
    <div class="detail-header">
      <div class="detail-title-wrap">
        <div class="detail-name">${meta.icon} ${escapeHtml(entry.name)}</div>
        <div class="detail-stars">${escapeHtml(meta.label)}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div class="detail-terminals">${terminalChips}</div>
        <button class="detail-close" onclick="window.__closeDetail()">✕</button>
      </div>
    </div>

    <div class="detail-body">
      ${groupRow}
      ${aliasesRow}
      ${checkRow}
    </div>

    <div style="margin-top:1.75rem;">
      <div class="route-section-title">How to get there · ${escapeHtml(activeTerminal)}</div>
      ${howToBlock}
    </div>

    ${relatedHotelsHtml}

    <div class="inline-warning">
      ⚠️ Data may not be up to date. Please verify details with the service provider before travel.
    </div>

    <div class="detail-footer">
      <a class="action-btn primary" href="${mapsUrl}" target="_blank" rel="noopener">
        🗺️ Find on Google Maps
      </a>
    </div>
  `);

  // Bind terminal chip clicks → re-render with new terminal
  document.querySelectorAll('#detail-card .detail-terminals .tag.terminal').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = chip.dataset.terminal;
      if (t && t !== activeTerminal) {
        renderGenericDetail(entry, t);
      }
    });
  });

  // Bind related hotel clicks
  document.querySelectorAll('#detail-card [data-hotel-id]').forEach((el) => {
    el.addEventListener('click', () => {
      closeDetailCard();
      setTimeout(() => {
        const h = hotelsById[el.dataset.hotelId];
        if (h) openHotelDetail(h);
      }, 200);
    });
  });
}

function buildHowToBlock(entry, terminal) {
  const t = terminal;
  const type = entry.type;

  if (type === 'airline') {
    const allTerminals = (entry.terminals || []).join(', ');
    return `
      <div class="route-block">
        <div class="route-step">
          <div class="step-num">1</div>
          <div class="step-text">
            <strong>Go to ${escapeHtml(t)}</strong>
            <span> This airline operates from ${escapeHtml(allTerminals)}.</span>
          </div>
        </div>
        <div class="route-step">
          <div class="step-num">2</div>
          <div class="step-text">
            <strong>Check-in area</strong>
            <span> Follow signs for ${escapeHtml(entry.name)} check-in desks.</span>
          </div>
        </div>
        <div class="route-step">
          <div class="step-num">3</div>
          <div class="step-text">
            <strong>After check-in</strong>
            <span> Proceed to security and departures.</span>
          </div>
        </div>
      </div>`;
  }

  if (type === 'bus') {
    return `
      <div class="route-block">
        <div class="route-step">
          <div class="step-num">1</div>
          <div class="step-text">
            <strong>Go to ${escapeHtml(t)}</strong>
            <span> Bus serves terminal${(entry.terminals || []).length > 1 ? 's' : ''} ${escapeHtml((entry.terminals || []).join(', '))}.</span>
          </div>
        </div>
        <div class="route-step">
          <div class="step-num">2</div>
          <div class="step-text">
            <strong>Find the bus stop</strong>
            <span> Look for the ${escapeHtml(entry.name)} stop.</span>
          </div>
        </div>
        <div class="route-step">
          <div class="step-num">3</div>
          <div class="step-text">
            <strong>Board ${escapeHtml(entry.name)}</strong>
            <span>${entry.group ? ' Operator: ' + escapeHtml(entry.group) + '.' : ''}</span>
          </div>
        </div>
      </div>`;
  }

  if (type === 'terminal') {
    return `
      <div class="route-block">
        <div class="route-step">
          <div class="step-num">1</div>
          <div class="step-text">
            <strong>${escapeHtml(entry.name)}</strong>
            <span> One of Heathrow's main passenger terminals.</span>
          </div>
        </div>
        <div class="route-step">
          <div class="step-num">2</div>
          <div class="step-text">
            <strong>Connections</strong>
            <span> Free trains between terminals · Buses · Taxis.</span>
          </div>
        </div>
      </div>`;
  }

  return '<div class="detail-row"><span class="detail-value">Route info not available.</span></div>';
}

/* ---------- EVENT HANDLERS ---------- */

function setupSearchHandlers() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');
  let timer = null;

  input.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearBtn.classList.toggle('hidden', !searchQuery);

    clearTimeout(timer);
    timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        const groups = searchGrouped(searchQuery);
        renderDropdown(groups, searchQuery);
      } else {
        hideDropdown();
      }
    }, 100);
  });

  input.addEventListener('focus', () => {
    if (searchQuery.trim().length >= 2) {
      const groups = searchGrouped(searchQuery);
      renderDropdown(groups, searchQuery);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDropdown();
      input.blur();
    }
  });

  clearBtn.addEventListener('click', () => {
    searchQuery = '';
    input.value = '';
    clearBtn.classList.add('hidden');
    hideDropdown();
    input.focus();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) hideDropdown();
  });
}

function setupThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  const icon = toggle.querySelector('.theme-icon');

  const saved = localStorage.getItem('velo-lhr-theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    icon.textContent = '☀️';
  }

  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      icon.textContent = '🌙';
      localStorage.setItem('velo-lhr-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      icon.textContent = '☀️';
      localStorage.setItem('velo-lhr-theme', 'light');
    }
  });
}

function setupInstallPrompt() {
  const fab = document.getElementById('install-fab');
  if (!fab) return;

  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    fab.classList.remove('hidden');
  });

  fab.addEventListener('click', async () => {
    if (!deferred) {
      showToast('Use your browser menu → "Install app"');
      return;
    }
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      showToast('Velo.LHR installed!');
    }
    deferred = null;
    fab.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    fab.classList.add('hidden');
    showToast('App installed');
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
    console.log('[Velo.LHR] SW registered');
  } catch (e) {
    console.warn('[Velo.LHR] SW registration failed:', e);
  }
}

/* ---------- INIT ---------- */

async function init() {
  setupThemeToggle();
  setupSearchHandlers();
  setupInstallPrompt();
  registerServiceWorker();

  await loadData();
  document.getElementById('version-display').textContent = 'v' + APP_VERSION;
  console.log('[Velo.LHR] Ready —', searchIndex.length, 'entries,', hotels.length, 'hotels');
}

document.addEventListener('DOMContentLoaded', init);