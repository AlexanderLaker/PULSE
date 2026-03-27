#!/bin/bash
# PULSE — Deploy to Vercel (full-stack: React + FastAPI)
# Run from project root: ./deploy.sh

set -e

echo "🔧 Building dashboard..."
cd pulse/dashboard
npm install --silent
npx vite build --outDir ../../public
cd ../..

echo "📦 Deploying to Vercel..."
npx vercel deploy --prod --yes

echo "✅ Deployment complete!"
