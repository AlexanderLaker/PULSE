#!/usr/bin/env node
/**
 * PRISM Innovation Explorer — Image Pipeline v4.3 (April 2026)
 *
 * Strategy: official Unsplash API search with per-innovation queries.
 * Requires env var UNSPLASH_ACCESS_KEY (set in Vercel project settings).
 *
 * Per innovation:
 *   1. GET api.unsplash.com/search/photos?query=<keywords>&...
 *      with Authorization: Client-ID <key>
 *   2. Sort results by photo ID for build determinism
 *   3. Download top result at 1280x960, q=85
 *   4. Validate content-type=image/* and size>30KB → save
 *   5. Try next 2 results on download failure
 *   6. Last resort: hand-picked photo-{id} fallback
 *
 * Rate limit: 50 req/hour for demo apps. We do 53 sequential queries
 * (1.5s gap = 80s total). After first successful build, files are
 * cached on disk (>40KB) so subsequent builds skip the API entirely
 * unless the file is missing or corrupted.
 *
 * If UNSPLASH_ACCESS_KEY is missing, falls back to hand-picked IDs
 * directly — same as v4.0 behavior (no broken builds).
 *
 * Storage: static assets in public/images/innovations/, served with
 * Cache-Control: public, max-age=31536000, immutable (vercel.json).
 * First-paint <100ms once cached.
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'images', 'innovations');
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const API_BASE = 'https://api.unsplash.com';
const API_GAP_MS = 1500;
const W = 1280, H = 960, Q = 85;

// Per-innovation search queries (carefully scoped: gender, ethnicity,
// product category-specific, concept-anchored verbs).
const queries = {
  inn_01: 'scalp serum dropper bottle skincare clinical',
  inn_02: 'hair scalp brush thick density treatment',
  inn_03: 'laundry detergent sheets eco green folded towels',
  inn_04: 'walk-in wardrobe luxury garments hangers fabric',
  inn_05: 'modern washing machine laundry room minimal',
  inn_06: 'closet wardrobe garments hanging clothes neat',
  inn_07: 'mens grooming kit razor brush flat lay',
  inn_08: 'hair dye box mixing bowl vanity bathroom',
  inn_09: 'dishwasher modern kitchen plates clean',
  inn_10: 'biotech hair serum ampoule glass laboratory',
  inn_11: 'mosquito repellent spray outdoor garden tropical',
  inn_12: 'salon hair stylist coloring treatment professional',
  inn_13: 'colorful sachets shop emerging market street',
  inn_14: 'dry shampoo aerosol bottle vanity morning',
  inn_15: 'aromatherapy candles diffuser lavender spa',
  inn_16: 'refill station bottles eco store amber glass',
  inn_17: 'silver grey hair woman elegant mature portrait',
  inn_18: 'hair salon tablet AI technology stylist palette',
  inn_19: 'black woman natural afro coily hair portrait',
  inn_20: 'clinical hair recovery serum bottle pharmacy',
  inn_21: 'peptide serum dropper laboratory glass science',
  inn_22: 'hair supplement vitamins capsules wellness',
  inn_23: 'mature elegant woman portrait blonde hair beauty',
  inn_24: 'shampoo bar solid soap eco bathroom',
  inn_25: 'beauty influencer ring light hair products colorful',
  inn_26: 'smartphone app beauty hair products sleek',
  inn_27: 'body cream firming bottle wellness measuring tape',
  inn_28: 'tropical body lotion coconut spa',
  inn_29: 'biotech laboratory glass flask green liquid',
  inn_30: 'subscription delivery box doorstep cardboard',
  inn_31: 'eco green leaf detergent bottle nature forest',
  inn_32: 'QR code phone scan clothing label fashion',
  inn_33: 'perfume bottles luxury silk fabric softener',
  inn_34: 'cashmere knit sweater fabric care wool soft',
  inn_35: 'lavender bedding sleep linen white bedroom',
  inn_36: 'kitchen sink dish soap clean white plates',
  inn_37: 'dishwasher cartridge tablet smart appliance',
  inn_38: 'toilet bowl modern bathroom clean white',
  inn_39: 'colorful cleaning sachets shop shelf',
  inn_40: 'colorful retail shelf emerging market shop',
  inn_41: 'beauty influencer ring light camera content creator',
  inn_42: 'sleek straight glossy hair woman keratin',
  inn_43: 'AI search interface laptop neural network glow',
  inn_44: 'girl colorful hair pink fun youth',
  inn_45: 'modern kitchen dishwasher tablet middle class',
  inn_46: 'doctor video consultation tablet telemedicine',
  inn_47: 'senior elderly hand cleaning home kitchen',
  inn_48: 'athletic running gear sportswear blue sneakers',
  inn_49: 'aromatherapy serum diffuser calm purple wellness',
  inn_50: 'cleaning app smartphone home counter routine',
  inn_51: 'smart mosquito trap device bedroom modern',
  inn_52: 'toilet bowl bathroom probiotic clean modern',
  inn_53: 'perfume bottles row luxury haute couture boutique',
};

// Hand-picked photo-IDs as last-resort fallback.
const fallbackIds = {
  inn_01:'photo-1556228720-195a672e8a03', inn_02:'photo-1559599101-f09722fb4948',
  inn_03:'photo-1545173168-9f1947eebb7f', inn_04:'photo-1489274495757-95c7c837b101',
  inn_05:'photo-1626806819282-2c1dc01a5e0c', inn_06:'photo-1558769132-cb1aea458c5e',
  inn_07:'photo-1599351431202-1e0f0137899a', inn_08:'photo-1492106087820-71f1a00d2b11',
  inn_09:'photo-1556909114-f6e7ad7d3136', inn_10:'photo-1556228852-80b6e5eeff06',
  inn_11:'photo-1568724100398-478b5c39c47e', inn_12:'photo-1522337360788-8b13dee7a37e',
  inn_13:'photo-1601049541289-9b1b7bbbfe19', inn_14:'photo-1527799820374-dcf8d9d4a388',
  inn_15:'photo-1600428877878-1a0fd85beda8', inn_16:'photo-1604187351574-c75ca79f5807',
  inn_17:'photo-1580489944761-15a19d654956', inn_18:'photo-1633681926022-84c23e8cb5d6',
  inn_19:'photo-1604004555489-723a93d6ce74', inn_20:'photo-1612817288484-6f916006741a',
  inn_21:'photo-1581456495146-65a71b2c8e52', inn_22:'photo-1556228453-c4a4be29c739',
  inn_23:'photo-1580618672591-eb180b1a973f', inn_24:'photo-1599751449128-eb7249c3d6b1',
  inn_25:'photo-1611162617213-7d7a39e9b1d7', inn_26:'photo-1556761175-5973dc0f32e7',
  inn_27:'photo-1571019613454-1cb2f99b2d8b', inn_28:'photo-1570172619644-dfd03ed5d881',
  inn_29:'photo-1532996122724-e3c354a0b15b', inn_30:'photo-1556742049-0cfed4f6a45d',
  inn_31:'photo-1473773508845-188df298d2d1', inn_32:'photo-1572584642822-6f8de0243c93',
  inn_33:'photo-1629140727571-9b5c6f6267b4', inn_34:'photo-1620799140408-edc6dcb6d633',
  inn_35:'photo-1540518614846-7eded433c457', inn_36:'photo-1556910103-1c02745aae4d',
  inn_37:'photo-1584568694244-14fbdf83bd30', inn_38:'photo-1564540583246-934409427776',
  inn_39:'photo-1556911220-bff31c812dba', inn_40:'photo-1599249300969-0a9d86a26abb',
  inn_41:'photo-1611162616475-46b635cb6868', inn_42:'photo-1519699047748-de8e457a634e',
  inn_43:'photo-1677442136019-21780ecad995', inn_44:'photo-1503944168849-8bf86d22ac41',
  inn_45:'photo-1581578731548-c64695cc6952', inn_46:'photo-1576091160399-112ba8d25d1d',
  inn_47:'photo-1581579185169-9c53b38ecf85', inn_48:'photo-1506629082955-511b1aa562c8',
  inn_49:'photo-1499728603263-13726abce5fd', inn_50:'photo-1603712610494-e54a8fd7d1c0',
  inn_51:'photo-1558882224-dda166733046', inn_52:'photo-1620626011761-996317b8d101',
  inn_53:'photo-1607006344380-b6775a0824a7',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COMMON_HEADERS = {
  'User-Agent': 'PRISM-Build/4.2 (+github.com/AlexanderLaker/PULSE)',
  'Accept': 'application/json,image/*',
};

let rateLimitRemaining = 50;

async function searchUnsplashApi(query, attempt = 0) {
  if (!ACCESS_KEY) throw new Error('no access key');
  const url = `${API_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&content_filter=high`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        ...COMMON_HEADERS,
        'Authorization': `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    });
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== null) rateLimitRemaining = parseInt(remaining, 10);
    if (res.status === 429) {
      if (attempt < 2) {
        await sleep(60000);
        return searchUnsplashApi(query, attempt + 1);
      }
      throw new Error('rate limited');
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(3000 * (attempt + 1));
      return searchUnsplashApi(query, attempt + 1);
    }
    if (!res.ok) throw new Error(`api HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('no results');
    data.results.sort((a, b) => a.id.localeCompare(b.id));
    return data.results;
  } catch (err) {
    throw err;
  }
}

async function downloadFromUrl(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(25000),
    redirect: 'follow',
    headers: COMMON_HEADERS,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new Error(`bad content-type: ${ct}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 30000) throw new Error(`size ${buf.length}B too small`);
  return buf;
}

function buildCdnUrl(rawUrl) {
  const sep = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${sep}auto=format&fit=crop&w=${W}&h=${H}&q=${Q}`;
}

async function downloadInnovation(id) {
  const outPath = join(OUT_DIR, `${id}.jpg`);

  if (existsSync(outPath)) {
    try {
      const s = await stat(outPath);
      if (s.size > 40000) {
        console.log(`  CACHED   ${id}  (${(s.size / 1024).toFixed(0)} KB)`);
        return true;
      }
    } catch {}
  }

  const query = queries[id];
  if (query && ACCESS_KEY) {
    try {
      const results = await searchUnsplashApi(query);
      for (let i = 0; i < Math.min(3, results.length); i++) {
        const photo = results[i];
        const cdnUrl = buildCdnUrl(photo.urls.raw);
        try {
          const buf = await downloadFromUrl(cdnUrl);
          await writeFile(outPath, buf);
          console.log(`  API      ${id}  ${photo.id}  (${(buf.length/1024).toFixed(0)} KB)  q="${query.slice(0,45)}"  rl=${rateLimitRemaining}`);
          return true;
        } catch (err) {
          console.warn(`    photo ${photo.id} miss: ${err.message}`);
        }
      }
    } catch (err) {
      console.warn(`  API-X    ${id}  ${err.message}`);
    }
  }

  // Fallback: hand-picked photo ID
  const fbId = fallbackIds[id];
  if (fbId) {
    const fbUrl = `https://images.unsplash.com/${fbId}?auto=format&fit=crop&w=${W}&h=${H}&q=${Q}`;
    try {
      const buf = await downloadFromUrl(fbUrl);
      await writeFile(outPath, buf);
      console.log(`  FALLBACK ${id}  ${fbId}  (${(buf.length/1024).toFixed(0)} KB)`);
      return true;
    } catch (err) {
      console.warn(`  FB-MISS  ${id}  ${err.message}`);
    }
  }

  console.error(`  FAIL     ${id}  no image obtained`);
  return false;
}

const SCRIPT_VERSION = '4.3';

function maybeInvalidateCache() {
  const versionFile = join(OUT_DIR, '.version');
  let current = '';
  try { current = readFileSync(versionFile, 'utf8').trim(); } catch {}
  if (current === SCRIPT_VERSION) return;
  console.log(`  Cache version mismatch (was: '${current}', now: '${SCRIPT_VERSION}') — clearing JPGs`);
  try {
    for (const f of readdirSync(OUT_DIR)) {
      if (f.endsWith('.jpg')) {
        try { unlinkSync(join(OUT_DIR, f)); } catch {}
      }
    }
    writeFileSync(versionFile, SCRIPT_VERSION);
  } catch (err) {
    console.warn(`  cache clear warning: ${err.message}`);
  }
}

async function main() {
  console.log(`\n📸 PRISM image pipeline v4.3 — Unsplash official API`);
  console.log(`   Access key: ${ACCESS_KEY ? `${ACCESS_KEY.slice(0,8)}...${ACCESS_KEY.slice(-4)}` : 'MISSING — using fallback IDs only'}`);
  await mkdir(OUT_DIR, { recursive: true });
  maybeInvalidateCache();

  const ids = Array.from({ length: 53 }, (_, i) => `inn_${String(i + 1).padStart(2, '0')}`);
  let ok = 0, fail = 0;
  const failures = [];

  for (const id of ids) {
    const success = await downloadInnovation(id);
    if (success) ok++; else { fail++; failures.push(id); }
    await sleep(API_GAP_MS);
  }

  console.log(`\n✅ ${ok}/${ids.length} downloaded${fail ? `, ${fail} failed: ${failures.join(', ')}` : ''}`);
  console.log(`   Rate-limit remaining: ${rateLimitRemaining}\n`);
}

main().catch((err) => {
  console.error('Image pipeline crashed:', err);
  process.exit(0);
});
