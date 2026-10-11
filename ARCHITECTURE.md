
---

## 📁 `velo.lhr/ARCHITECTURE.md`

**المسار:** `velo.lhr/ARCHITECTURE.md`

```markdown
# 🏛️ velo.lhr — Architecture

## Overview

velo.lhr is a **client-side Progressive Web App** with no backend. All hotel data is served as a static JSON file and cached in the browser.

---

## 🧩 Components

| Component | Role |
|---|---|
| `index.html` | Main UI shell |
| `styles.css` | Styling |
| `app.js` | UI logic, filtering, rendering |
| `db.js` | IndexedDB wrapper for offline storage |
| `sw.js` | Service Worker for caching |
| `manifest.json` | PWA metadata |
| `hotels.json` | Hotel dataset |
| `version.json` | Auto-generated version + build time |

---

## 🔄 Data Flow

hotels.json → fetch → app.js → render → DOM
↓
db.js → IndexedDB (offline)


---

## 📴 Offline Strategy

- **Service Worker** caches:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `db.js`
  - `hotels.json`
  - Icons
- On offline:
  - App reads from IndexedDB
  - Shows a "offline" banner

---

## 🚀 Deployment Pipeline

git push → GitHub Actions → npm run build → deploy to gh-pages


---

## 🔐 Security

- No user data leaves the browser
- No backend, no database, no API keys
- Read-only static content

---

## 📈 Future Enhancements

- Live hotel pricing (via API)
- Map view integration
- Multi-language support
- User reviews

