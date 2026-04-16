/**
 * PRISM Innovation Explorer — Curated Stock Photography Map
 *
 * Each of the 43 innovation concepts is mapped to a hand-picked, high-quality
 * Unsplash stock photo that visually represents the product concept.
 * Images load instantly from Unsplash's global CDN (no generation delay).
 *
 * Photo selection criteria:
 *   - Product-centric, editorially lit, premium consumer goods aesthetic
 *   - No text, no visible logos, no brand names
 *   - Matches the category and consumer need of each innovation
 *
 * Unsplash license: free for commercial use, no attribution required in apps.
 * Docs: https://unsplash.com/documentation#dynamically-resizable-images
 */

/**
 * Direct Unsplash photo URLs per innovation.
 * Format: base URL + query params for responsive sizing.
 */
const innovationPhotos: Record<string, string> = {
  // ── Original v3.0 portfolio (inn_01–inn_16) ────────────────────────────
  inn_01: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop', // scalp care / hair serum closeup
  inn_02: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop', // voluminous healthy hair
  inn_03: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0eb7?auto=format&fit=crop', // clean laundry / white linens
  inn_04: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop', // fabric / clothing care
  inn_05: 'https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?auto=format&fit=crop', // modern washing machine
  inn_06: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop', // premium garments / closet
  inn_07: 'https://images.unsplash.com/photo-1581182800629-7d90925ad072?auto=format&fit=crop', // men's grooming products
  inn_08: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop', // salon / hair color
  inn_09: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop', // dishwashing / clean kitchen
  inn_10: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop', // laboratory / biotech serum
  inn_11: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop', // Mediterranean terrace / outdoor
  inn_12: 'https://images.unsplash.com/photo-1522337094846-8a818192de1f?auto=format&fit=crop', // salon treatment / professional hair
  inn_13: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop', // marketplace / consumer goods display
  inn_14: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop', // woman natural hair refresh
  inn_15: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop', // home care / botanical products
  inn_16: 'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop', // refill station / sustainability

  // ── v3.1 additions — Hair: Color (inn_17–inn_18) ───────────────────────
  inn_17: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop', // hair color / vibrant
  inn_18: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop', // AI / technology salon

  // ── Hair: Care (inn_19–inn_24) ─────────────────────────────────────────
  inn_19: 'https://images.unsplash.com/photo-1595959183082-7b570b7e1e2b?auto=format&fit=crop', // natural textured hair / curls
  inn_20: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop', // clinical wellness / recovery
  inn_21: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop', // science lab / peptide serum
  inn_22: 'https://images.unsplash.com/photo-1505576399279-0d54f31f743f?auto=format&fit=crop', // wellness lifestyle / supplements
  inn_23: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop', // mature woman / silver hair luxury
  inn_24: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop', // solid bars / natural beauty

  // ── Hair: Styling (inn_25–inn_26) ──────────────────────────────────────
  inn_25: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop', // social media / content creation
  inn_26: 'https://images.unsplash.com/photo-1585747860302-f3ca0cdbe1d4?auto=format&fit=crop', // hair styling products

  // ── Hair: Body (inn_27–inn_28) ─────────────────────────────────────────
  inn_27: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop', // body care / fitness wellness
  inn_28: 'https://images.unsplash.com/photo-1540555700478-4be289fbec6a?auto=format&fit=crop', // tropical / botanical body care

  // ── LHC: FCN — Fabric Cleaning (inn_29–inn_31) ─────────────────────────
  inn_29: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop', // green chemistry / sustainability
  inn_30: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop', // subscription box / smart home
  inn_31: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop', // renewable energy / carbon neutral

  // ── LHC: FCA — Fabric Care (inn_32) ────────────────────────────────────
  inn_32: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop', // premium textiles / garment care

  // ── LHC: FFI — Fabric Finisher (inn_33) ────────────────────────────────
  inn_33: 'https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?auto=format&fit=crop', // fluffy towels / softener

  // ── LHC: LAD — Laundry Additives (inn_34–inn_35) ───────────────────────
  inn_34: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop', // cashmere / premium knitwear
  inn_35: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop', // bedroom / lavender / sleep

  // ── LHC: HDW — Hand Dish Wash (inn_36) ─────────────────────────────────
  inn_36: 'https://images.unsplash.com/photo-1585837146751-a27e99e3e866?auto=format&fit=crop', // hand dishwashing / kitchen

  // ── LHC: ADW — Automatic Dish Wash (inn_37) ────────────────────────────
  inn_37: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop', // modern dishwasher / smart kitchen

  // ── LHC: HSC — Hard Surface Care (inn_38–inn_39) ───────────────────────
  inn_38: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop', // eco / garden / biodiversity
  inn_39: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop', // bright kitchen / surface cleaning

  // ── Cross-Category (inn_40–inn_43) ─────────────────────────────────────
  inn_40: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop', // emerging market / consumer goods stall
  inn_41: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop', // social commerce / influencer
  inn_42: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop', // glossy premium hair
  inn_43: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop', // AI / futuristic tech
};

/**
 * Get a fast-loading Unsplash photo URL for a given innovation.
 * Returns a responsive URL with width/height/quality parameters.
 */
export function getInnovationImageUrl(
  innovationId: string,
  _seed: number,
  size: 'card' | 'hero' = 'card'
): string | null {
  const baseUrl = innovationPhotos[innovationId];
  if (!baseUrl) return null;

  const w = size === 'hero' ? 1600 : 800;
  const h = size === 'hero' ? 1000 : 600;

  return `${baseUrl}&w=${w}&h=${h}&q=80`;
}

export { innovationPhotos as innovationPrompts };
