# PULSE — Deployment Guide

## One-Command Deploy

From the project root (`PROFIT_POOL_ENGINE/`):

```bash
./deploy.sh
```

This builds the React dashboard, commits any changes, and pushes to GitHub — which triggers Vercel auto-deploy.

**Live URL:** https://pulse-two-beige.vercel.app

---

## First-Time Setup (5 minutes)

### 1. Install dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd pulse/dashboard && npm install && cd ../..
```

### 2. Connect to Vercel

The project is already connected to Vercel via GitHub (`AlexanderLaker/PULSE`).
If you need to re-link:

```bash
npx vercel link
# Select: AlexanderLaker → PULSE
```

### 3. Set Environment Variables

Go to: https://vercel.com/alexanderlaker/pulsefmcg/settings/environment-variables

Add these three keys:

| Variable | Value |
|----------|-------|
| `BEAUTYFEEDS_API_KEY` | `b12e9b806f59e7e1ad9fc7141cfc5aed17152e85` |
| `OPENALEX_API_KEY` | `luVTfvpMt612GkRGb4vUSI` |
| `NEWSAPI_API_KEY` | `1a268a2d2d694fc495f267f93867e973` |

### 4. Push to GitHub

```bash
git push --force origin main
```

> **Important:** This will replace the existing Next.js app on GitHub with the PULSE engine. The `--force` is needed because the codebases are different.

---

## Architecture on Vercel

```
Vercel Project
├── /public/          ← Pre-built React dashboard (static files)
│   ├── index.html
│   └── assets/       ← JS, CSS bundles
├── /api/index.py     ← FastAPI serverless function (Python)
└── vercel.json       ← Routing: /api/* → Python, /* → static
```

- **Frontend**: Served as static files from `/public/`
- **Backend**: Single Python serverless function at `/api/index.py`
- **Data**: Standalone — no Excel needed, uses seed_data.py

---

## Local Development

```bash
# Start backend
cd PROFIT_POOL_ENGINE
python -m uvicorn pulse.api.app:app --reload --port 8000

# Start frontend (separate terminal)
cd pulse/dashboard
npm run dev
```

Dashboard: http://localhost:5173
API: http://localhost:8000/api/v1/health
