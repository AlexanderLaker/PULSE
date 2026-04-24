#!/usr/bin/env node
/**
 * PRISM Innovation Explorer — Image Download Script (v3.6, April 2026)
 *
 * Primary source:   Pollinations.ai (Flux)  — bespoke, prompt-matched imagery
 *                   per innovation. Deterministic via fixed seeds. Guarantees:
 *                   • zero duplicates (each prompt is unique)
 *                   • category-accurate framing (insect / toilet / textured hair)
 *                   • correct representation (inn_19 explicitly Black woman)
 *
 * Fallback source:  Unsplash direct CDN. Used only if Pollinations is
 *                   unreachable during the Vercel build. IDs are hand-picked,
 *                   de-duplicated, and distinct from v3.5.
 *
 * All 53 innovations covered (previously only 43).
 *
 * Usage: node scripts/download-images.mjs
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'public', 'images', 'innovations');

/**
 * Bespoke Pollinations prompts per innovation.
 * Deliberately detailed to eliminate randomness & ensure on-brand imagery.
 * Keep prompts ~250 chars max — Pollinations URL-encodes and Vercel edge
 * has URL length limits on rare CDN routes.
 */
const prompts = {
  inn_01: 'cinematic editorial flat-lay of a premium clinical scalp-care serum bottle with glass dropper on a minimal white marble slab, soft teal gradient backlight, dermatology laboratory aesthetic, micro-droplets of serum, luxury FMCG product photography',
  inn_02: 'premium hair density serum and scalp activation dropper set on polished violet stone, clinical science aesthetic, soft studio lighting, gender-neutral luxury packaging, strands of glossy hair softly in background, commercial advertising style',
  inn_03: 'translucent plant-based laundry detergent sheets dissolving in crystal-clear water, eco-luxury minimal composition, folded white cotton towels, green botanical accents, soft daylight, premium sustainable packaging in background',
  inn_04: 'luxurious amber fabric refresh spray bottle on folded cashmere garments in walk-in wardrobe, mist particles suspended mid-air, warm golden hour lighting, premium fragrance advertising aesthetic, fine fragrance editorial',
  inn_05: 'sleek stainless steel smart auto-dosing laundry cartridge attached to modern European washing machine, minimalist laundry room, cool daylight, premium appliance product photography, subtle digital display',
  inn_06: 'pristine premium garments hanging in designer wardrobe with professional fabric-care protector bottle on wooden shelf, natural sidelight, slow fashion aesthetic, luxury editorial',
  inn_07: 'overhead flat-lay of a complete premium men grooming kit on dark slate, featuring matte black pomade jar, amber beard oil, safety razor, boar-bristle brush, leather pouch, moody directional lighting, Esquire magazine aesthetic',
  inn_08: 'smartphone displaying AI hair color app with spectrum of color swatches, next to boxes of premium at-home hair dye and a mixing bowl, clean pink vanity, soft daylight, tech-beauty editorial',
  inn_09: 'eco-luxury PFAS-free dish soap bottle on pristine marble sink with gleaming white plates, soft morning window light, crystalline water droplets, premium kitchen advertising photography',
  inn_10: 'cinematic macro of biotech hair repair serum ampoules in a medical-grade rack, subtle laboratory glassware in soft-focus background, cool white clinical lighting, scientific luxury hair care advertising',
  inn_11: 'premium insect repellent spray bottle on wooden outdoor dining table at dusk, mosquito silhouettes subtly in soft-focus background, tropical garden, warm lantern light, protective halo, household bug-control advertising',
  inn_12: 'professional salon-grade hair bond repair treatment bottle with pipette being applied to glossy healthy hair strands, salon sink in soft-focus background, professional stylist aesthetic, editorial beauty',
  inn_13: 'colorful small sachets of affordable shampoo and detergent on a vibrant sunlit emerging-market street stall, warm golden light, authentic documentary photography, South Asian / Sub-Saharan market aesthetic',
  inn_14: 'day-2 hair revival dry shampoo aerosol can and refreshing mist on minimal pastel vanity with hairbrush, morning sunlight streaming through sheer curtains, modern millennial beauty aesthetic',
  inn_15: 'premium aromatherapy home-care collection featuring candle, reed diffuser and room mist with fresh lavender sprigs on stone bathroom ledge, spa-like calm mood, soft warm light',
  inn_16: 'modern circular refill station with reusable amber glass bottles in bright eco-concept retail space, wooden dispensers, plants, shoppers filling containers, sustainability aesthetic, Brooklyn/Berlin concept store',
  inn_17: 'elegant mature woman 55+ with radiant silver-to-brunette gradient hair, luxury editorial beauty portrait, soft studio lighting, warm neutral backdrop, longevity-hair advertising',
  inn_18: 'AI color studio — large tablet displaying personalized hair color simulation next to an array of premium color tubes in a chic salon chair reflection, futuristic beauty tech editorial',
  inn_19: 'confident young Black woman with voluminous natural 4C afro-textured coils, beautifully defined curls, glowing brown skin, editorial studio portrait, warm backdrop, luxury textured-hair advertising, African American beauty, high-end haircare',
  inn_20: 'GLP-1 post-weight-loss hair recovery serum bottle on clean medical-aesthetic flat-lay, subtle clinical instruments, calm sage-green backdrop, pharmacy-luxury crossover photography',
  inn_21: 'peptide hair serum dropper vial on laboratory glass slide with molecular visualization projection, moody blue-violet scientific lighting, premium bioactive skincare crossover aesthetic',
  inn_22: 'inside-out hair wellness — a person holding a bottle of hair supplement capsules in one hand and a hair serum in the other, bright minimal wellness editorial, soft daylight, beige tones',
  inn_23: 'elegant 45+ woman with radiant healthy shoulder-length hair, luxury prestige beauty portrait, soft Vogue-style lighting, warm ivory backdrop, longevity advertising',
  inn_24: 'waterless solid shampoo bars stacked on bamboo tray with green botanical leaves and a linen towel, diffused natural light, sustainable premium beauty editorial',
  inn_25: 'vibrant social-commerce styling products on neon-lit pink backdrop with ring-light reflection, TikTok-ready flat-lay, Gen Z beauty aesthetic, colorful dynamic composition',
  inn_26: 'futuristic smartphone showing AI styling assistant chat recommending hair products, sleek styling serum and brush on marble, agent-AI beauty tech editorial',
  inn_27: 'post-GLP-1 body recomposition firming cream with soft measuring tape on clean white vanity, wellness editorial, neutral tones, medically-aesthetic beauty photography',
  inn_28: 'halal-certified tropical body care cream bottle with fresh coconut halves, pandan leaves and frangipani blossoms on woven rattan tray, warm Southeast Asian sunlight, luxurious',
  inn_29: 'premium bio-fermentation palm-free laundry detergent bottle next to a glass fermentation flask with bubbling liquid, biotech-green lab aesthetic, sustainable FMCG editorial',
  inn_30: 'subscription laundry detergent cardboard box with kraft paper doorstep delivery scene, modern apartment entryway, soft morning light, DTC ecommerce advertising',
  inn_31: 'carbon-neutral certified detergent bottle with green leaf motif and CO2 neutrality badge on moss-covered surface, forest ambient lighting, eco-premium sustainability',
  inn_32: 'hand holding smartphone scanning QR code on clothing label in a wardrobe, digital textile passport interface, minimal futuristic retail tech editorial',
  inn_33: 'premium bio-fragrance fabric softener bottle with elegant floral perfume bottles and silk fabric draped, warm boudoir lighting, haute-couture FMCG editorial',
  inn_34: 'fiber recovery booster sachet packet next to restored plush knitwear and a macro of healthy clean cotton fibers, textile-care editorial, soft warm light',
  inn_35: 'sleep+ wellness scent booster laundry additive with moonlight mood, folded linen bedding, lavender sprigs, evening tones, premium bedtime-laundry advertising',
  inn_36: 'premium dermatologically-graded hand dish soap bottle on gleaming white porcelain sink with soft water droplets and a single wineglass, luxury kitchen advertising, cool clinical-lux aesthetic',
  inn_37: 'smart dishwasher auto-dosing cartridge installed in modern integrated dishwasher, minimalist gray kitchen, premium appliance photography, subtle cyan glow of smart indicator',
  inn_38: 'premium biodiversity-positive toilet bowl cleaner bottle next to a gleaming white toilet in a bright modern bathroom, green botanical leaves, clean eco-luxury bathroom advertising, clearly a toilet-care product',
  inn_39: 'row of colorful multi-purpose cleaner sachets on emerging-market retail shelf, vibrant packaging, warm fluorescent store light, South Asian / African grocery aesthetic',
  inn_40: 'diverse assortment of affordable FMCG hair and home-care products on colorful Indian and African kiraba/kiosk shelf, warm sunset light, emerging-markets platform advertising',
  inn_41: 'female beauty influencer holding glowing skincare and haircare product while filming with ring light and phone tripod, digital-first commerce studio, pink-violet ambient',
  inn_42: 'premium keratin smoothing treatment bottle with sleek shiny straight hair portrait, salon-luxury editorial, gold-ivory tones, frizz-free aspirational aesthetic',
  inn_43: 'futuristic AI generative search interface on large display showing brand product recommendations, abstract neural-network glow, GEO marketing tech editorial',
  inn_44: 'Gen Alpha teenager with colorful pastel hair clips and styling mousse, playful TikTok-ready flat lay with glittery backdrop, vibrant gen-alpha beauty aesthetic',
  inn_45: 'first-time dishwasher in a modern emerging-market kitchen with compact ADW tablet pack on counter, warm natural light, aspirational middle-class home aesthetic, India or Brazil setting',
  inn_46: 'tele-dermatology video call on tablet showing a doctor discussing scalp health, next to a clinical scalp serum, DTC telehealth beauty editorial',
  inn_47: 'senior-friendly ergonomic cleaning spray bottle with large grip handle on bright home kitchen counter, warm supportive atmosphere, silver-economy hygiene product advertising',
  inn_48: 'high-performance athletic wear folded next to specialist technical fabric detergent bottle, sport-lab aesthetic, cool blue tones, premium performance laundry advertising',
  inn_49: 'neurocosmetic hair and scalp sensory serum bottle with calming aromatherapy diffuser, soft violet brain-calming palette, wellness-luxury editorial',
  inn_50: 'smartphone displaying coached cleaning routine app with step-by-step visuals, surface cleaner and microfibre cloth on counter, foolproof home-hygiene editorial',
  inn_51: 'premium connected smart indoor mosquito trap device on bedside table with soft UV glow attracting a mosquito, minimalist Scandinavian bedroom, app on phone showing catch count, tech-home editorial, pest-defense advertising',
  inn_52: 'premium probiotic toilet bowl cleaner bottle with microbial life illustrated subtly, bright modern bathroom with toilet clearly visible, green plants, biotech clean bathroom-care advertising, clearly a toilet product',
  inn_53: 'elegant modular fabric softener bottle with fine-fragrance accord booster shots in a row on marble, silk garments draped, matching wardrobe diffuser, luxury perfumery meets laundry advertising, haute-couture FFI editorial',
};

/**
 * Hand-picked Unsplash fallback IDs — used only if Pollinations fails.
 * Each ID is distinct from every other entry (no duplicates).
 * Photo IDs reference the `photo-{slug}` segment of images.unsplash.com.
 */
const unsplashFallback = {
  inn_01: 'photo-1556228453-efd6c1ff04f6', // scalp serum dropper
  inn_02: 'photo-1522337094846-8a818192de1f', // hair density care
  inn_03: 'photo-1545173168-9f1947eebb7f', // folded laundry towels
  inn_04: 'photo-1489274495757-95c7c837b101', // wardrobe / fabric refresh
  inn_05: 'photo-1626806819282-2c1dc01a5e0c', // washing machine close-up
  inn_06: 'photo-1558769132-cb1aea458c5e', // garment care wardrobe
  inn_07: 'photo-1581182800629-7d90925ad072', // men grooming flat lay
  inn_08: 'photo-1559599101-f09722fb4948', // at-home hair color
  inn_09: 'photo-1556909114-f6e7ad7d3136', // dish soap sink
  inn_10: 'photo-1532187863486-abf9dbad1b69', // hair serum bottle
  inn_11: 'photo-1568724100398-478b5c39c47e', // insect repellent / mosquito
  inn_12: 'photo-1522337360788-8b13dee7a37e', // salon hair treatment
  inn_13: 'photo-1601049541289-9b1b7bbbfe19', // emerging market sachets
  inn_14: 'photo-1527799820374-dcf8d9d4a388', // dry shampoo vanity
  inn_15: 'photo-1600428877878-1a0fd85beda8', // aromatherapy home
  inn_16: 'photo-1604187351574-c75ca79f5807', // refill station
  inn_17: 'photo-1580489944761-15a19d654956', // mature woman radiant hair
  inn_18: 'photo-1516975080664-ed2fc6a32937', // salon AI color
  inn_19: 'photo-1531123897727-8f129e1688ce', // Black woman afro-textured hair
  inn_20: 'photo-1576091160550-2173dba999ef', // clinical hair serum
  inn_21: 'photo-1579154204601-01588f351e67', // peptide lab
  inn_22: 'photo-1556228453-c4a4be29c739', // supplements + serum wellness
  inn_23: 'photo-1580618672591-eb180b1a973f', // prestige hair 45+
  inn_24: 'photo-1596755389378-c31d21fd1273', // shampoo bars
  inn_25: 'photo-1611162617213-7d7a39e9b1d7', // styling TikTok
  inn_26: 'photo-1556761175-5973dc0f32e7', // AI styling agent
  inn_27: 'photo-1571019613454-1cb2f99b2d8b', // body recomp wellness
  inn_28: 'photo-1507525428034-b723cf961d3e', // tropical body care
  inn_29: 'photo-1532996122724-e3c354a0b15b', // bio-ferment detergent
  inn_30: 'photo-1556742049-0cfed4f6a45d', // subscription delivery box
  inn_31: 'photo-1473773508845-188df298d2d1', // carbon-neutral nature
  inn_32: 'photo-1558171813-4c088753af8f', // QR scan wardrobe
  inn_33: 'photo-1629140727571-9b5c6f6267b4', // fabric softener premium
  inn_34: 'photo-1620799140408-edc6dcb6d633', // knit / fiber recovery
  inn_35: 'photo-1540518614846-7eded433c457', // bedtime laundry
  inn_36: 'photo-1556910103-1c02745aae4d', // hand dish wash sink
  inn_37: 'photo-1584568694244-14fbdf83bd30', // smart dishwasher
  inn_38: 'photo-1584622650111-993a426fbf0a', // modern bathroom toilet
  inn_39: 'photo-1556911220-bff31c812dba', // multi-purpose cleaner sachets
  inn_40: 'photo-1599249300969-0a9d86a26abb', // emerging markets shelf
  inn_41: 'photo-1611162616475-46b635cb6868', // influencer beauty commerce
  inn_42: 'photo-1519699047748-de8e457a634e', // keratin smoothing hair
  inn_43: 'photo-1677442136019-21780ecad995', // AI generative search
  inn_44: 'photo-1595433562696-88a8e2ad88e0', // Gen Alpha styling
  inn_45: 'photo-1581578731548-c64695cc6952', // modern dishwasher kitchen
  inn_46: 'photo-1576091160399-112ba8d25d1d', // telehealth consult
  inn_47: 'photo-1581579185169-9c53b38ecf85', // senior home hygiene
  inn_48: 'photo-1506629082955-511b1aa562c8', // athletic performance wear  (distinct)
  inn_49: 'photo-1512290746430-f2c1af47c8f2', // neurocosmetic wellness
  inn_50: 'photo-1603712610494-e54a8fd7d1c0', // home cleaning app
  inn_51: 'photo-1558882224-dda166733046', // smart indoor pest / bedroom device
  inn_52: 'photo-1564540583246-934409427776', // modern bathroom toilet (biome)
  inn_53: 'photo-1607006344380-b6775a0824a7', // perfume / fragrance bottles row
};

async function tryFetch(url, timeoutMs = 25000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadImage(id, prompt, fallbackPath) {
  const outPath = join(OUT_DIR, `${id}.jpg`);

  // Cache between builds
  if (existsSync(outPath)) {
    try {
      const s = await stat(outPath);
      if (s.size > 25000) {
        console.log(`  CACHED  ${id}`);
        return true;
      }
    } catch {}
  }

  // Deterministic seed from innovation number, so the same prompt always
  // yields the same image across builds.
  const seed = 1000 + parseInt(id.replace(/\D/g, ''), 10);
  const encodedPrompt = encodeURIComponent(prompt);
  const pollinationsUrl =
    `https://image.pollinations.ai/prompt/${encodedPrompt}` +
    `?width=800&height=600&seed=${seed}&model=flux&nologo=true&enhance=true`;

  // Try 1: Pollinations (Flux) with bespoke prompt
  try {
    const buf = await tryFetch(pollinationsUrl, 45000);
    if (buf.length > 5000) {
      await writeFile(outPath, buf);
      console.log(`  FLUX    ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    }
  } catch (err) {
    console.warn(`  MISS    ${id}  flux: ${err.message}`);
  }

  // Try 2: Hand-picked Unsplash fallback
  if (fallbackPath) {
    const url = `https://images.unsplash.com/${fallbackPath}?auto=format&fit=crop&w=800&h=600&q=75`;
    try {
      const buf = await tryFetch(url);
      await writeFile(outPath, buf);
      console.log(`  OK(fb)  ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (err) {
      console.warn(`  MISS    ${id}  unsplash: ${err.message}`);
    }
  }

  console.error(`  FAIL    ${id}  all attempts failed`);
  return false;
}

async function main() {
  console.log('📸 Downloading innovation images (Flux primary → Unsplash fallback)...');
  await mkdir(OUT_DIR, { recursive: true });

  const ids = Object.keys(prompts);
  let ok = 0, fail = 0;

  // Batches of 4 — Pollinations is slower than Unsplash CDN, and we don't want
  // to hammer their free endpoint.
  for (let i = 0; i < ids.length; i += 4) {
    const batch = ids.slice(i, i + 4);
    const results = await Promise.all(
      batch.map((id) => downloadImage(id, prompts[id], unsplashFallback[id]))
    );
    results.forEach((r) => (r ? ok++ : fail++));
  }

  console.log(`\n✅ Done: ${ok} downloaded, ${fail} failed`);
  if (fail > 0) {
    console.log('⚠️  Failed images will fall back to branded gradients at runtime.');
  }
}

main().catch((err) => {
  console.error('Image download script failed:', err);
  // Don't fail the build — the component falls back to gradients.
  process.exit(0);
});
