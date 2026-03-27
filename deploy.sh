#!/bin/bash
# PULSE — One-Command Deploy to Vercel
# Run from project root: ./deploy.sh
#
# Prerequisites:
#   1. Node.js 20+ and npm installed
#   2. Git configured with GitHub access
#   3. Vercel CLI: npm i -g vercel (or use npx)
#   4. Vercel project linked: npx vercel link
#
# What this does:
#   1. Builds the React dashboard → /public/
#   2. Commits changes (if any)
#   3. Pushes to GitHub (triggers Vercel auto-deploy)
#   OR deploys directly via Vercel CLI

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   PULSE — Deploy to Production       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Build Dashboard ──────────────────────────────────
echo "🔧 Step 1/3: Building dashboard..."
cd pulse/dashboard
npm install --silent 2>/dev/null
npx vite build --outDir ../../public 2>&1 | tail -5
cd ../..
echo "   ✓ Dashboard built → /public/"
echo ""

# ── Step 2: Git Commit (if changes) ─────────────────────────
echo "📝 Step 2/3: Checking for changes..."
if [ -n "$(git status --porcelain)" ]; then
    git add -A
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M")
    git commit -m "PULSE deploy — $TIMESTAMP"
    echo "   ✓ Changes committed"
else
    echo "   ✓ No changes to commit"
fi
echo ""

# ── Step 3: Deploy ───────────────────────────────────────────
echo "🚀 Step 3/3: Deploying..."

# Option A: Push to GitHub (if remote is set up → triggers Vercel auto-deploy)
if git remote get-url origin &>/dev/null; then
    echo "   Pushing to GitHub (Vercel auto-deploys from main)..."
    git push --force origin main 2>&1
    echo ""
    echo "   ✓ Pushed to GitHub"
    echo "   ✓ Vercel will auto-deploy in ~60 seconds"
    echo ""
    echo "   🌐 Live at: https://pulse-two-beige.vercel.app"
    echo "   📊 API at:  https://pulse-two-beige.vercel.app/api/v1/health"
else
    # Option B: Direct Vercel deploy (if no git remote)
    echo "   No git remote found — deploying directly via Vercel CLI..."
    npx vercel deploy --prod --yes
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ✅ Deployment complete!             ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Don't forget to set environment variables in Vercel:"
echo "  → Settings → Environment Variables"
echo "  BEAUTYFEEDS_API_KEY=your_key"
echo "  OPENALEX_API_KEY=your_key"
echo "  NEWSAPI_API_KEY=your_key"
echo ""
