#!/bin/bash
# PULSE Profit Pool Shift Model — Deploy to Vercel
#
# Prerequisites:
#   1. npm i -g vercel
#   2. vercel login
#   3. (Optional) Set up Vercel Postgres: vercel storage add postgres
#
# Usage:
#   chmod +x deploy.sh && ./deploy.sh

set -e

echo "PULSE Profit Pool Shift Model — Vercel Deployment"
echo "────────────────────────────────────────"

# Step 1: Build latest frontend
echo "Building frontend..."
cd pulse/dashboard
npm install --silent
npm run build
cd ../..

# Step 2: Copy build output to public/
echo "Copying build to public/..."
rm -rf public/*
cp -r pulse/dashboard/dist/* public/

# Step 3: Deploy
echo "Deploying to Vercel..."
vercel --prod

echo ""
echo "Done! Deployment complete."
