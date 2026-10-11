# ✈️ Velo.LHR

> Airport Area Hotel & Transport Guide (Heathrow Region)

A Progressive Web App (PWA) that helps travellers find hotels near Heathrow Airport, compare amenities, check bus routes, and estimate travel time to each terminal.

---

## ⚠️ Disclaimer

**Velo.LHR is not affiliated with Heathrow Airport Limited.**

"Heathrow" is used strictly as a geographic reference. All trademarks belong to their respective owners.

---

## 🎯 Purpose

Heathrow has **5 terminals** and **dozens of hotels** scattered around the airport area. Finding the right hotel with the right transport option is confusing.

**Velo.LHR** solves this by offering:

- A searchable hotel directory
- Terminal-based filtering (T2, T3, T4, T5)
- Bus routes & Hotel Hoppa information
- Walking distance indicators
- Star ratings, phone, email, website
- Offline access (PWA)

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Storage | IndexedDB |
| Offline | Service Worker |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## 📂 Project Structure

velo.lhr/
├── .github/workflows/deploy.yml
├── public/
│ ├── data/hotels.json
│ ├── data/version.json
│ ├── icons/
│ ├── css/styles.css
│ ├── js/app.js
│ ├── js/db.js
│ ├── index.html
│ ├── manifest.json
│ └── sw.js
├── scripts/generate-version.js
├── package.json
└── README.md


---

## 🚀 Local Development

```bash
npm install
npm start

🌐 Deployment

Automatically deployed to GitHub Pages via GitHub Actions on every push to main.
📜 License

MIT © Muneer Ahmed