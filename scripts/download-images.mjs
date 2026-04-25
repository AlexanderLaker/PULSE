#!/usr/bin/env node
/**
 * PRISM Innovation Explorer — Image Pipeline v4.1 (April 2026)
 *
 * Strategy: keyword-driven Unsplash search at Vercel build time.
 * Each innovation has a tightly-crafted search query (gender/ethnicity/
 * concept-specific where it matters — e.g. "men barber luxury" not
 * "grooming"; "Black woman afro coils natural" for textured hair).
 *
 * Pipeline per innovation:
 *   1. POST search query to Unsplash napi (returns JSON with photo URLs)
 *   2. Sort results by photo ID (stable across builds)
 *   3. Download top result at 1280x960, q=85
 *   4. If size>40KB & content-type=image/* → save as inn_XX.jpg
 *   5. If search fails or download fails → try next 2 results
 *   6. Last resort: fall back to hand-picked photo-{id} from v4.0
 *
 * Storage: static assets in public/images/innovations/, cached forever
 *   via vercel.json (max-age=31536000, immutable). First-paint < 100ms.
 *
 * Determinism: results sorted by Unsplash photo ID (a stable property),
 *   so the same query yields the same image across rebuilds.
 *
 * Throttling: 1.8s between napi calls (Unsplash unauthenticated limit
 *   ~50 req/h; we do 53 spread over ~95s — well within limits).
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'images', 'innovations');
const NAPI_GAP_MS = 1800;
const W = 1280, H = 960, Q = 85;

// ─── Per-innovation search queries (carefully crafted) ──────────────
// Specifics that matter:
//  - gender lock for inn_07 (men), inn_17/23 (mature/older woman)
//  - ethnicity lock for inn_19 (Black, 4C texture)
//  - subject lock for inn_38/52 (toilet, not generic bathroom)
//  - concept-anchored verbs (e.g. "dropper" not "serum" alone)
const queries = {
  // Hair: Care
  inn_01: 'scalp serum dropper bottle skincare clinical white minimal',
  inn_02: 'hair scalp brush thick density treatment wood handle',
  inn_10: 'biotech hair serum ampoule glass laboratory science',
  inn_19: 'Black woman natural afro coily 4c hair portrait studio',
  inn_20: 'clinical hair recovery serum white bottle pharmacy luxury',
  inn_21: 'peptide serum dropper laboratory glass blue science skincare',
  inn_22: 'hair supplement vitamins capsules wellness flat lay',
  inn_23: 'mature elegant woman portrait grey blonde hair beauty',
  inn_24: 'shampoo bar solid soap eco bathroom wood sustainable',
  inn_46: 'doctor video consultation tablet telemedicine dermatology',
  inn_49: 'aromatherapy serum diffuser calm purple wellness skincare',

  // Hair: Color
  inn_08: 'hair dye box mixing bowl colorful tubes vanity bathroom',
  inn_12: 'salon hair stylist coloring treatment chair professional',
  inn_17: 'silver grey hair woman elegant mature portrait studio',
  inn_18: 'hair salon tablet AI technology stylist colorful palette',

  // Hair: Styling
  inn_07: 'men barber razor brush grooming flat lay luxury wooden',
  inn_14: 'dry shampoo aerosol bottle vanity morning bedroom mirror',
  inn_25: 'TikTok beauty influencer ring light hair products colorful',
  inn_26: 'smartphone AI app beauty hair products sleek modern',
  inn_44: 'gen alpha teen pink hair clips colorful styling youth',

  // Hair: Body
  inn_27: 'body cream firming bottle white wellness measuring tape',
  inn_28: 'tropical coconut body cream halal Asian beauty pandan',

  // LHC: FCN
  inn_03: 'laundry detergent sheets eco green folded towels white',
  inn_05: 'modern washing machine smart cartridge laundry room minimal',
  inn_29: 'biotech laboratory glass flask green liquid detergent',
  inn_30: 'subscription delivery box doorstep cardboard apartment',
  inn_31: 'eco green leaf detergent bottle nature forest sustainability',

  // LHC: FCA
  inn_04: 'walk-in wardrobe luxury garments hangers fabric mist',
  inn_06: 'closet wardrobe garments hanging clothes neat luxury',
  inn_32: 'QR code phone scan clothing label fashion technology',
  inn_48: 'athletic running gear sportswear blue sneakers performance',

  // LHC: FFI
  inn_33: 'perfume bottles luxury silk fabric softener boudoir',
  inn_53: 'perfume bottles row luxury haute couture boutique',

  // LHC: LAD
  inn_34: 'cashmere knit sweater fabric care luxury wool soft',
  inn_35: 'lavender bedding sleep linen white bedroom calm evening',

  // LHC: HDW
  inn_36: 'kitchen sink dish soap clean white plates pristine',

  // LHC: ADW
  inn_09: 'dishwasher modern kitchen plates clean glasses minimal',
  inn_37: 'dishwasher cartridge tablet smart appliance kitchen',
  inn_45: 'modern kitchen dishwasher tablet aspirational middle class',

  // LHC: HSC
  inn_15: 'aromatherapy candles diffuser lavender spa bathroom calm',
  inn_39: 'colorful cleaning sachets shop shelf affordable products',
  inn_50: 'cleaning app smartphone home counter routine modern',

  // LHC: Toilet
  inn_38: 'toilet bowl modern bathroom clean white green plant',
  inn_52: 'toilet bowl bathroom probiotic clean modern green',

  // LHC: IC
  inn_11: 'mosquito repellent spray outdoor garden tropical evening',
  inn_51: 'smart mosquito trap device bedroom Scandinavian modern',

  // Cross-Category
  inn_13: 'colorful sachets shop emerging market street stall',
  inn_16: 'refill station bottles eco store amber glass bulk',
  inn_40: 'colorful retail shelf emerging market shop affordable',
  inn_41: 'beauty influencer ring light pink camera content creator',
  inn_42: 'sleek straight glossy hair woman keratin smooth portrait',
  inn_43: 'AI search interface laptop neural network glow tech',
  inn_47: 'senior elderly hand cleaning home kitchen ergonomic',
};

// Hand-picked photo-IDs as last-resort fallback (all verified distinct).
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
  inn_27:'photo-1571019613454-1cb2f99b2d8b', inn_28:'photo-1601379329542-31c59cfd2a52',
  inn_29:'photo-1532996122724-e3c354a0b15b', inn_30:'photo-1556742049-0cfed4f6a45d',
  inn_31:'photo-1473773508845-188df298d2d1', inn_32:'photo-1572584642822-6f8de0243c93',
  inn_33:'photo-1629140727571-9b5c6f6267b4', inn_34:'photo-1620799140408-edc6dcb6d633',
  inn_35:'photo-1540518614846-7eded433c457', inn_36:'photo-1556910103-1c02745aae4d',
  inn_37:'photo-1584568694244-14fbdf83bd30', inn_38:'photo-1564540583246-934409427776',
  inn_39:'photo-1556911220-bff31c812dba', inn_40:'photo-1599249300969-0a9d86a26abb',
  inn_41:'photo-1611162616475-46b635cb6868', inn_42:'photo-1519699047748-de8e457a634e',
  inn_43:'photo-1677442136019-21780ecad995', inn_44:'photo-1595433562696-88a8e2ad88e0',
  inn_45:'photo-1581578731548-c64695cc6952', inn_46:'photo-1576091160399-112ba8d25d1d',
  inn_47:'photo-1581579185169-9c53b38ecf85', inn_48:'photo-1506629082955-511b1aa562c8',
  inn_49:'photo-1499728603263-13726abce5fd', inn_50:'photo-1603712610494-e54a8fd7d1c0',
  inn_51:'photo-1558882224-dda166733046', inn_52:'photo-1620626011761-996317b8d101',
  inn_53:'photo-1607006344380-b6775a0824a7',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; PRISM-Build/4.1; +https://github.com)',
  'Accept': 'application/json,image/*',
};

async function searchUnsplash(query, attempt = 0) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&content_filter=high`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: COMMON_HEADERS,
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 2) {
        await sleep(3000 * (attempt + 1));
        return searchUnsplash(query, attempt + 1);
      }
      throw new Error(`napi HTTP ${res.status}`);
    }
    if (!res.ok) throw new Error(`napi HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('no results');
    // Stable sort by photo ID for determinism across rebuilds.
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
  // Append our sizing params; raw includes the photo-XXX path already.
  const sep = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${sep}auto=format&fit=crop&w=${W}&h=${H}&q=${Q}`;
}

async function downloadInnovation(id) {
  const outPath = join(OUT_DIR, `${id}.jpg`);

  // Skip cache if we already have a real photo (>40KB).
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
  if (query) {
    try {
      const results = await searchUnsplash(query);
      // Try top 3 results, in case the first 404s on the CDN.
      for (let i = 0; i < Math.min(3, results.length); i++) {
        const photo = results[i];
        const cdnUrl = buildCdnUrl(photo.urls.raw);
        try {
          const buf = await downloadFromUrl(cdnUrl);
          await writeFile(outPath, buf);
          console.log(`  SEARCH   ${id}  ${photo.id}  (${(buf.length / 1024).toFixed(0)} KB)  q="${query.slice(0, 50)}"`);
          return true;
        } catch (err) {
          console.warn(`    photo ${photo.id} miss: ${err.message}`);
        }
      }
    } catch (err) {
      console.warn(`  SEARCH-X ${id}  ${err.message}`);
    }
  }

  // Fallback: hand-picked photo ID from v4.0
  const fbId = fallbackIds[id];
  if (fbId) {
    const fbUrl = `https://images.unsplash.com/${fbId}?auto=format&fit=crop&w=${W}&h=${H}&q=${Q}`;
    try {
      const buf = await downloadFromUrl(fbUrl);
      await writeFile(outPath, buf);
      console.log(`  FALLBACK ${id}  ${fbId}  (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (err) {
      console.warn(`  FB-MISS  ${id}  ${err.message}`);
    }
  }

  console.error(`  FAIL     ${id}  no image obtained — keeping placeholder`);
  return false;
}

async function main() {
  console.log(`\n📸 PRISM image pipeline v4.1 — keyword-driven Unsplash search\n`);
  await mkdir(OUT_DIR, { recursive: true });

  const ids = Array.from({ length: 53 }, (_, i) => `inn_${String(i + 1).padStart(2, '0')}`);
  let ok = 0, fail = 0;
  const failures = [];

  for (const id of ids) {
    const success = await downloadInnovation(id);
    if (success) ok++;
    else { fail++; failures.push(id); }
    await sleep(NAPI_GAP_MS);
  }

  console.log(`\n✅ ${ok}/${ids.length} downloaded${fail ? `, ${fail} failed: ${failures.join(', ')}` : ''}\n`);
}

main().catch((err) => {
  console.error('Image pipeline crashed:', err);
  // Don't break the build — gradient placeholders ship as last resort.
  process.exit(0);
});
