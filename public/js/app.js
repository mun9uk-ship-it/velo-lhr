let allHotels = [];

/* ---------- Load Data ---------- */
async function loadHotels() {
  try {
    const res = await fetch('data/hotels.json?v=' + Date.now());
    const data = await res.json();
    allHotels = data.hotels || [];
    console.log(`✅ Loaded ${allHotels.length} hotels`);
  } catch (err) {
    console.error('❌ Failed to load hotels:', err);
  }
}

/* ---------- Render Stars ---------- */
function renderStars(rating) {
  if (!rating || rating === 'N/A') return '⭐ N/A';
  const num = parseInt(rating);
  return '⭐'.repeat(num);
}

/* ---------- Suggestions Dropdown ---------- */
function showSuggestions(query) {
  const box = document.getElementById('suggestions');

  if (!query || query.length < 1) {
    box.innerHTML = '';
    box.classList.remove('active');
    return;
  }

  const q = query.toLowerCase();
  const matches = allHotels
    .filter((h) => (h.name || '').toLowerCase().startsWith(q))
    .slice(0, 8);

  if (matches.length === 0) {
    box.innerHTML = '<div class="no-match">No hotels found</div>';
    box.classList.add('active');
    return;
  }

  box.innerHTML = matches
    .map(
      (h) => `
      <div class="suggestion-item" data-id="${h.id}">
        <span class="suggestion-name">${h.name}</span>
        <span class="suggestion-terminal">${h.terminal}</span>
      </div>
    `
    )
    .join('');

  box.classList.add('active');

  box.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const hotel = allHotels.find((h) => h.id === id);
      if (hotel) {
        document.getElementById('search').value = hotel.name;
        box.innerHTML = '';
        box.classList.remove('active');
        renderHotelDetail(hotel);
      }
    });
  });
}

/* ---------- Hotel Detail Card ---------- */
function renderHotelDetail(hotel) {
  const container = document.getElementById('hotel-detail');

  container.innerHTML = `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <h2>${hotel.name}</h2>
          <p class="detail-stars">${renderStars(hotel.stars)}</p>
        </div>
        <span class="detail-terminal">${hotel.terminal}</span>
      </div>

      <div class="detail-body">
        <div class="detail-row">
          <span class="detail-label">📍 Address</span>
          <span class="detail-value">${hotel.address || 'Not listed'}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">🚌 Transport</span>
          <span class="detail-value">${hotel.transport || 'Walk'}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">⏱️ Travel Time</span>
          <span class="detail-value">${hotel.travelTime || 'N/A'}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">📏 Distance</span>
          <span class="detail-value">${hotel.distance || 'N/A'}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">📞 Phone</span>
          <span class="detail-value">${hotel.phone || 'Not listed'}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">✉️ Email</span>
          <span class="detail-value">${hotel.email || 'Not listed'}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">🌐 Website</span>
          <span class="detail-value">
            <a href="https://${hotel.website}" target="_blank">${hotel.website || 'N/A'}</a>
          </span>
        </div>
      </div>

      <div class="detail-footer">
        <span class="detail-category">${hotel.category || 'General'}</span>
      </div>
    </div>
  `;
}

/* ---------- Event Listeners ---------- */
document.getElementById('search').addEventListener('input', (e) => {
  showSuggestions(e.target.value.trim());
});

document.addEventListener('click', (e) => {
  const box = document.getElementById('suggestions');
  if (!e.target.closest('.search-wrapper')) {
    box.classList.remove('active');
  }
});

/* ---------- Init ---------- */
loadHotels();