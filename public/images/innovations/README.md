# Innovation Explorer Images

This folder holds the 43 cinematic product photos rendered on the
Innovation Explorer cards (`inn_01.jpg` … `inn_43.jpg`).

## Where they come from

Images are sourced from Unsplash (free commercial licence) via
`scripts/download-images.mjs`, which is invoked as part of the Vercel
build command:

```json
"buildCommand": "node scripts/download-images.mjs && next build"
```

The script is **cache-aware** — it skips any `inn_XX.jpg` already present
on disk. Which brings us to the point of this README.

## Why these files should be committed to git

Committing the downloaded JPGs to the repo (≈150 KB each × 43 = ~6 MB
total) gives us three wins:

1. **Instant page loads.** Images ship with the deployment, hit Vercel's
   edge CDN immediately, and are cached by the browser for a year
   (`Cache-Control: public, max-age=31536000, immutable`, set in
   `vercel.json`).
2. **Deterministic, offline-safe builds.** Neither Vercel nor local
   `npm run dev` has to reach out to `images.unsplash.com` — builds
   succeed even when Unsplash is down or the network is firewalled.
3. **Fast local dev.** `node scripts/download-images.mjs` becomes a pure
   no-op once images are committed, so new clones render the real
   photography without any extra step.

## One-time bootstrap

From a machine with internet access:

```bash
cd PROFIT_POOL_ENGINE
node scripts/download-images.mjs           # populates this folder
git add public/images/innovations/*.jpg
git commit -m "Commit innovation photography (one-time bootstrap)"
```

After that, the only time you'd re-run the script is to refresh a
specific image (delete the file, run the script, commit the new one).

## Runtime behaviour when an image is missing

`components/dashboard/InnovationProductImage.tsx` falls back to the
branded `imageGradient` + `imageAccent` glow defined per innovation in
`data/innovations.ts`, so the card is never visually empty — but it
won't look as nice as the real photo.
