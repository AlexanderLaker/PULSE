#!/usr/bin/env node
/**
 * Download all 43 innovation images from Unsplash at build time.
 * Runs during Vercel build so images are served as static assets
 * from Vercel's edge CDN — zero external requests at runtime.
 *
 * Usage: node scripts/download-images.mjs
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'images', 'innovations');

/**
 * Primary Unsplash CDN photo paths per innovation.
 * Format: images.unsplash.com/{path}?params
 */
const photos = {
  inn_01: 'photo-1522337360788-8b13dee7a37e',
  inn_02: 'photo-1519699047748-de8e457a634e',
  inn_03: 'photo-1545173168-9f1947eebb7f', // clean folded white towels / laundry
  inn_04: 'photo-1489274495757-95c7c837b101', // clothes on hangers / wardrobe
  inn_05: 'photo-1626806819282-2c1dc01a5e0c',
  inn_06: 'photo-1490481651871-ab68de25d43d',
  inn_07: 'photo-1581182800629-7d90925ad072',
  inn_08: 'photo-1560066984-138dadb4c035',
  inn_09: 'photo-1556909114-f6e7ad7d3136',
  inn_10: 'photo-1532187863486-abf9dbad1b69',
  inn_11: 'photo-1506905925346-21bda4d32df4',
  inn_12: 'photo-1522337094846-8a818192de1f',
  inn_13: 'photo-1555529669-e69e7aa0ba9a',
  inn_14: 'photo-1527799820374-dcf8d9d4a388',
  inn_15: 'photo-1556228578-0d85b1a4d571',
  inn_16: 'photo-1604187351574-c75ca79f5807',
  inn_17: 'photo-1522337360788-8b13dee7a37e',
  inn_18: 'photo-1516975080664-ed2fc6a32937',
  inn_19: 'photo-1509967419530-da38b4704bc6', // woman with natural curly hair
  inn_20: 'photo-1576091160550-2173dba999ef',
  inn_21: 'photo-1579154204601-01588f351e67',
  inn_22: 'photo-1544367567-0f2fcb009e0b', // wellness / yoga / healthy lifestyle
  inn_23: 'photo-1580618672591-eb180b1a973f',
  inn_24: 'photo-1596755389378-c31d21fd1273',
  inn_25: 'photo-1611162617213-7d7a39e9b1d7',
  inn_26: 'photo-1560066984-138dadb4c035', // hair styling / salon (shared with inn_08)
  inn_27: 'photo-1571019613454-1cb2f99b2d8b',
  inn_28: 'photo-1507525428034-b723cf961d3e', // tropical beach / coconut / body care
  inn_29: 'photo-1532996122724-e3c354a0b15b',
  inn_30: 'photo-1556742049-0cfed4f6a45d',
  inn_31: 'photo-1473773508845-188df298d2d1',
  inn_32: 'photo-1558171813-4c088753af8f',
  inn_33: 'photo-1629140727571-9b5c6f6267b4',
  inn_34: 'photo-1620799140408-edc6dcb6d633',
  inn_35: 'photo-1540518614846-7eded433c457',
  inn_36: 'photo-1556910103-1c02745aae4d', // washing dishes / kitchen sink / soap
  inn_37: 'photo-1584568694244-14fbdf83bd30',
  inn_38: 'photo-1416879595882-3373a0480b5b',
  inn_39: 'photo-1556911220-bff31c812dba',
  inn_40: 'photo-1555529669-e69e7aa0ba9a',
  inn_41: 'photo-1611162616475-46b635cb6868',
  inn_42: 'photo-1519699047748-de8e457a634e',
  inn_43: 'photo-1677442136019-21780ecad995',
};

/**
 * Fallback: Unsplash short IDs (from search results) for photos that
 * may not have a standard photo-{timestamp} CDN path.
 * Accessed via source.unsplash.com redirect.
 */
const fallbackShortIds = {
  inn_03: 'ksoXz-C0gJo',   // woman holding stack of folded towels
  inn_04: 'dlxLGIy-2VU',   // assorted clothes in wooden hangers
  inn_19: '5WCPqt0QAK8',   // woman with curly hair on city street
  inn_22: 'D37STEwmyqY',   // person holding supplement bottle
  // inn_26: removed — primary ID now uses known-working photo
  inn_28: 'ys3xn1HwSm8',   // woman at tropical beach
  inn_36: 'hQOHDAibf6A',   // person washing fork in kitchen
};

async function tryFetch(url, timeoutMs = 20000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadImage(id, photoPath) {
  const outPath = join(OUT_DIR, `${id}.jpg`);

  // Skip if already downloaded (cache between builds)
  if (existsSync(outPath)) {
    try {
      const s = await stat(outPath);
      if (s.size > 1000) {
        console.log(`  CACHED  ${id}`);
        return true;
      }
    } catch {}
  }

  // Try 1: Standard Unsplash CDN path
  const primaryUrl = `https://images.unsplash.com/${photoPath}?auto=format&fit=crop&w=800&h=600&q=75`;
  try {
    const buf = await tryFetch(primaryUrl);
    await writeFile(outPath, buf);
    console.log(`  OK      ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    console.warn(`  MISS    ${id}  primary: ${err.message}`);
  }

  // Try 2: Fallback via short ID (uses source.unsplash.com redirect)
  const shortId = fallbackShortIds[id];
  if (shortId) {
    const fallbackUrl = `https://source.unsplash.com/${shortId}/800x600`;
    try {
      const buf = await tryFetch(fallbackUrl, 30000);
      if (buf.length > 1000) {
        await writeFile(outPath, buf);
        console.log(`  OK(fb)  ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
        return true;
      }
    } catch (err2) {
      console.warn(`  MISS    ${id}  fallback: ${err2.message}`);
    }
  }

  // Try 3: Unsplash search-based fallback (random photo for a query)
  const searchQueries = {
    inn_03: 'folded+laundry+towels',
    inn_04: 'clothes+hangers+wardrobe',
    inn_19: 'curly+natural+hair+woman',
    inn_22: 'wellness+supplements+beauty',
    // inn_26: removed — primary ID now uses known-working photo
    inn_28: 'tropical+coconut+skincare',
    inn_36: 'washing+dishes+kitchen',
  };
  const query = searchQueries[id];
  if (query) {
    const searchUrl = `https://source.unsplash.com/800x600/?${query}`;
    try {
      const buf = await tryFetch(searchUrl, 30000);
      if (buf.length > 1000) {
        await writeFile(outPath, buf);
        console.log(`  OK(sq)  ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
        return true;
      }
    } catch (err3) {
      console.warn(`  MISS    ${id}  search: ${err3.message}`);
    }
  }

  console.error(`  FAIL    ${id}  all attempts failed`);
  return false;
}

async function main() {
  console.log('📸 Downloading innovation images...');
  await mkdir(OUT_DIR, { recursive: true });

  // Download in batches of 6 to avoid overwhelming Unsplash
  const entries = Object.entries(photos);
  let ok = 0, fail = 0;

  for (let i = 0; i < entries.length; i += 6) {
    const batch = entries.slice(i, i + 6);
    const results = await Promise.all(
      batch.map(([id, photoPath]) => downloadImage(id, photoPath))
    );
    results.forEach(r => r ? ok++ : fail++);
  }

  console.log(`\n✅ Done: ${ok} downloaded, ${fail} failed`);
  if (fail > 0) {
    console.log('⚠️  Failed images will fall back to gradient backgrounds');
  }
}

main().catch(err => {
  console.error('Image download script failed:', err);
  // Don't fail the build — images fall back to gradients
  process.exit(0);
});
