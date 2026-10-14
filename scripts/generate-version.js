/**
 * Velo.LHR - Build Script
 *
 * Generates version.json with a unique version based on build time.
 * Validates hotels.json and search_index.json exist and contain data.
 * Produces a combined checksum so the version bumps when either file changes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const HOTELS_FILE = path.join(DATA_DIR, 'hotels.json');
const SEARCH_INDEX_FILE = path.join(DATA_DIR, 'search_index.json');
const VERSION_FILE = path.join(DATA_DIR, 'version.json');

/**
 * Read and parse a JSON file with friendly error handling.
 */
function readJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`[Velo.LHR Build] ERROR: ${label} not found at ${filePath}`);
    process.exit(1);
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Velo.LHR Build] ERROR: Failed to parse ${label}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Count entries per category in the search index.
 * Returns e.g. { hotel: 25, airline: 76, bus: 12, terminal: 4, total: 117 }
 */
function countCategories(entries) {
  const counts = { hotel: 0, airline: 0, bus: 0, terminal: 0, other: 0, total: entries.length };
  for (const entry of entries) {
    const t = entry && entry.type;
    if (t && counts[t] !== undefined) counts[t]++;
    else counts.other++;
  }
  return counts;
}

function generateVersion() {
  console.log('[Velo.LHR Build] Starting version generation...');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // -------- Load hotels.json --------
  const hotelsData = readJSON(HOTELS_FILE, 'hotels.json');
  const hotels = hotelsData.hotels || hotelsData;
  const hotelCount = Array.isArray(hotels) ? hotels.length : 0;

  if (hotelCount === 0) {
    console.error('[Velo.LHR Build] ERROR: hotels.json contains no hotels');
    process.exit(1);
  }
  console.log(`[Velo.LHR Build] Found ${hotelCount} hotels in hotels.json`);

  // -------- Load search_index.json --------
  const searchIndexData = readJSON(SEARCH_INDEX_FILE, 'search_index.json');
  const entries = searchIndexData.entries || [];

  if (entries.length === 0) {
    console.error('[Velo.LHR Build] ERROR: search_index.json contains no entries');
    process.exit(1);
  }

  const counts = countCategories(entries);
  console.log(
    `[Velo.LHR Build] Found ${counts.total} search entries ` +
    `(hotels: ${counts.hotel}, airlines: ${counts.airline}, ` +
    `buses: ${counts.bus}, terminals: ${counts.terminal})`
  );

  // -------- Generate version --------
  const now = new Date();
  const buildTimestamp = now.toISOString();
  const datePart = buildTimestamp.slice(0, 10).replace(/-/g, '');
  const timePart = now.getTime().toString(36).slice(-4);

  // Version format: MAJOR.MINOR.<entries>-<date>-<time>
  // Any change to entries count or content produces a new version.
  const version = `2.0.${counts.total}-${datePart}-${timePart}`;

  // -------- Combined checksum --------
  // Concatenate both datasets; changes to either produce a new hash.
  const checksumInput = JSON.stringify({ hotels, entries });
  const checksum = crypto
    .createHash('md5')
    .update(checksumInput)
    .digest('hex')
    .slice(0, 12);

  // -------- Write version.json --------
  const versionData = {
    version,
    buildDate: buildTimestamp,
    totalHotels: hotelCount,
    totalEntries: counts.total,
    breakdown: {
      hotels: counts.hotel,
      airlines: counts.airline,
      buses: counts.bus,
      terminals: counts.terminal,
      other: counts.other
    },
    checksum
  };

  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8');

  console.log('[Velo.LHR Build] version.json written:', version);
  console.log('[Velo.LHR Build] Checksum:', checksum);
  console.log('[Velo.LHR Build] Done.');
}

generateVersion();