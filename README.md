<<<<<<< HEAD
# Ai-Based-Pothole-Detection-System
LIVE DEMO: https://ai-based-pothole-detection-system-lpbf.onrender.com
=======
# RoadGuard AI — Pothole & Road Damage Detection

Edge AI-Powered Road Damage Detection System using Edge Impulse, React, Node.js, and MongoDB.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 18 + CRA  •  Port 3000                               │
│  AuthContext (JWT) → LoginPage / SignupPage / Dashboard      │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / JWT Bearer Token
┌────────────────────▼────────────────────────────────────────┐
│                        BACKEND                              │
│  Express  •  Port 5000                                      │
│                                                             │
│  /api/signup     POST  — create account (bcrypt + JWT)      │
│  /api/login      POST  — authenticate   (bcrypt + JWT)      │
│  /api/logout     POST  — stateless (client drops token)     │
│  /api/me         GET   — current user info                  │
│  /api/history    GET   — paginated detection history        │
│  /api/history/:id DELETE — delete a record                  │
│  /predict        POST  — upload image → AI classification   │
│  /health         GET   — server + DB status                 │
│  /model-info     GET   — model metadata                     │
└────────────────────┬────────────────────────────────────────┘
                     │ mongoose ODM
┌────────────────────▼────────────────────────────────────────┐
│                       DATABASE                              │
│  MongoDB (local or Atlas)                                   │
│  Collections: users  •  detections                          │
└─────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    EDGE IMPULSE API                         │
│  /v1/api/{project_id}/classify/image                        │
│  (Falls back to intelligent demo mode if not configured)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1 — Backend

```bash
cd backend
npm install
# Edit .env with your credentials (see .env for details)
npm run dev        # development (nodemon)
# npm start        # production
```

### 2 — Frontend

```bash
cd frontend
npm install
# Edit .env: REACT_APP_API_URL=http://localhost:5000
npm start
```

Open **http://localhost:3000** in your browser.

---

## Environment Variables

### backend/.env

| Variable | Description |
|---|---|
| `EDGE_IMPULSE_API_KEY` | From Edge Impulse Dashboard → Keys |
| `EDGE_IMPULSE_PROJECT_ID` | From Edge Impulse Dashboard |
| `PORT` | Backend port (default `5000`) |
| `FRONTEND_URL` | Frontend origin for CORS (default `http://localhost:3000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs — change in production! |

### frontend/.env

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Backend base URL (default `http://localhost:5000`) |

---

## Damage Classes

| Code | Name |
|---|---|
| D00 | Longitudinal Crack |
| D10 | Transverse Crack |
| D20 | Alligator Crack |
| D40 | Pothole |

---

## Features

- **JWT Authentication** — secure signup/login, token stored in localStorage
- **Real AI Detection** — Edge Impulse API integration with demo fallback
- **Detection History** — all results saved to MongoDB per user
- **Severity & Cost** — AI-computed repair cost (INR) and urgency rating
- **Uncertainty Analysis** — entropy-based confidence calibration
- **Damage Heatmap** — canvas-based visual overlay
- **Batch Processing** — analyse multiple images in one session
- **Live Camera** — capture directly from device camera
- **Export** — download session report as JSON

---

## MongoDB Collections

**users**
```json
{ "_id": ObjectId, "name": "...", "email": "...", "password": "<bcrypt>", "createdAt": Date }
```

**detections**
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "damageClass": "D40-pothole",
  "confidence": 0.87,
  "allScores": { "D40-pothole": 0.87, "D20-alligator-crack": 0.08, ... },
  "inferenceTime": 72,
  "usingRealModel": false,
  "timestamp": Date
}
```
>>>>>>> 2416c5b3 (My final Project)
