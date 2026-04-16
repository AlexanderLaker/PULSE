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

// Unsplash photo IDs per innovation (w=800, h=600, q=75, webp)
const photos = {
  inn_01: 'photo-1522337360788-8b13dee7a37e',
  inn_02: 'photo-1519699047748-de8e457a634e',
  inn_03: 'photo-1610557892470-55d9e80c0eb7',
  inn_04: 'photo-1558618666-fcd25c85f82e',
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
  inn_19: 'photo-1595959183082-7b570b7e1e2b',
  inn_20: 'photo-1576091160550-2173dba999ef',
  inn_21: 'photo-1579154204601-01588f351e67',
  inn_22: 'photo-1505576399279-0d54f31f743f',
  inn_23: 'photo-1580618672591-eb180b1a973f',
  inn_24: 'photo-1596755389378-c31d21fd1273',
  inn_25: 'photo-1611162617213-7d7a39e9b1d7',
  inn_26: 'photo-1585747860302-f3ca0cdbe1d4',
  inn_27: 'photo-1571019613454-1cb2f99b2d8b',
  inn_28: 'photo-1540555700478-4be289fbec6a',
  inn_29: 'photo-1532996122724-e3c354a0b15b',
  inn_30: 'photo-1556742049-0cfed4f6a45d',
  inn_31: 'photo-1473773508845-188df298d2d1',
  inn_32: 'photo-1558171813-4c088753af8f',
  inn_33: 'photo-1629140727571-9b5c6f6267b4',
  inn_34: 'photo-1620799140408-edc6dcb6d633',
  inn_35: 'photo-1540518614846-7eded433c457',
  inn_36: 'photo-1585837146751-a27e99e3e866',
  inn_37: 'photo-1584568694244-14fbdf83bd30',
  inn_38: 'photo-1416879595882-3373a0480b5b',
  inn_39: 'photo-1556911220-bff31c812dba',
  inn_40: 'photo-1555529669-e69e7aa0ba9a',
  inn_41: 'photo-1611162616475-46b635cb6868',
  inn_42: 'photo-1519699047748-de8e457a634e',
  inn_43: 'photo-1677442136019-21780ecad995',
};

async function downloadImage(id, photoId) {
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

  const url = `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&h=600&q=75`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(outPath, buf);
    console.log(`  OK      ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (err) {
    console.error(`  FAIL    ${id}  ${err.message}`);
    return false;
  }
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
      batch.map(([id, photoId]) => downloadImage(id, photoId))
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
