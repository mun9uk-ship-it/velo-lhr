/**
 * Velo.LHR - Build Script
 * Generates version.json with a unique version based on build time
 * and validates hotels.json exists and contains data.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const HOTELS_FILE = path.join(DATA_DIR, 'hotels.json');
const VERSION_FILE = path.join(DATA_DIR, 'version.json');

function generateVersion() {
  console.log('[Velo.LHR Build] Starting version generation...');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Validate hotels.json exists
  if (!fs.existsSync(HOTELS_FILE)) {
    console.error('[Velo.LHR Build] ERROR: hotels.json not found at', HOTELS_FILE);
    process.exit(1);
  }

  // Read and parse hotels.json
  let hotelsData;
  try {
    const raw = fs.readFileSync(HOTELS_FILE, 'utf8');
    hotelsData = JSON.parse(raw);
  } catch (err) {
    console.error('[Velo.LHR Build] ERROR: Failed to parse hotels.json:', err.message);
    process.exit(1);
  }

  const hotels = hotelsData.hotels || hotelsData;
  const hotelCount = Array.isArray(hotels) ? hotels.length : 0;

  if (hotelCount === 0) {
    console.error('[Velo.LHR Build] ERROR: hotels.json contains no hotels');
    process.exit(1);
  }

  console.log(`[Velo.LHR Build] Found ${hotelCount} hotels in hotels.json`);

  // Generate version based on build timestamp + hotel count
  const now = new Date();
  const buildTimestamp = now.toISOString();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.getTime().toString(36).slice(-4);
  const version = `1.0.${hotelCount}-${datePart}-${timePart}`;

  // Create checksum from hotels data
  const checksum = crypto
    .createHash('md5')
    .update(JSON.stringify(hotels))
    .digest('hex')
    .slice(0, 12);

  const versionData = {
    version: version,
    buildDate: buildTimestamp,
    totalHotels: hotelCount,
    checksum: checksum
  };

  // Write version.json
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8');
  console.log('[Velo.LHR Build] version.json written:', version);
  console.log('[Velo.LHR Build] Checksum:', checksum);
  console.log('[Velo.LHR Build] Done.');
}

generateVersion();