/**
 * PRISM Innovation Explorer — Local Static Product Photography
 *
 * Each of the 43 innovation concepts is mapped to a curated stock photo
 * downloaded at build time (scripts/download-images.mjs) and served as a
 * static asset from Vercel's edge CDN. Zero external requests at runtime.
 *
 * Photos sourced from Unsplash (free commercial license).
 */

/** Local static image paths per innovation. */
const localPaths: Record<string, string> = {
  inn_01: '/images/innovations/inn_01.jpg',
  inn_02: '/images/innovations/inn_02.jpg',
  inn_03: '/images/innovations/inn_03.jpg',
  inn_04: '/images/innovations/inn_04.jpg',
  inn_05: '/images/innovations/inn_05.jpg',
  inn_06: '/images/innovations/inn_06.jpg',
  inn_07: '/images/innovations/inn_07.jpg',
  inn_08: '/images/innovations/inn_08.jpg',
  inn_09: '/images/innovations/inn_09.jpg',
  inn_10: '/images/innovations/inn_10.jpg',
  inn_11: '/images/innovations/inn_11.jpg',
  inn_12: '/images/innovations/inn_12.jpg',
  inn_13: '/images/innovations/inn_13.jpg',
  inn_14: '/images/innovations/inn_14.jpg',
  inn_15: '/images/innovations/inn_15.jpg',
  inn_16: '/images/innovations/inn_16.jpg',
  inn_17: '/images/innovations/inn_17.jpg',
  inn_18: '/images/innovations/inn_18.jpg',
  inn_19: '/images/innovations/inn_19.jpg',
  inn_20: '/images/innovations/inn_20.jpg',
  inn_21: '/images/innovations/inn_21.jpg',
  inn_22: '/images/innovations/inn_22.jpg',
  inn_23: '/images/innovations/inn_23.jpg',
  inn_24: '/images/innovations/inn_24.jpg',
  inn_25: '/images/innovations/inn_25.jpg',
  inn_26: '/images/innovations/inn_26.jpg',
  inn_27: '/images/innovations/inn_27.jpg',
  inn_28: '/images/innovations/inn_28.jpg',
  inn_29: '/images/innovations/inn_29.jpg',
  inn_30: '/images/innovations/inn_30.jpg',
  inn_31: '/images/innovations/inn_31.jpg',
  inn_32: '/images/innovations/inn_32.jpg',
  inn_33: '/images/innovations/inn_33.jpg',
  inn_34: '/images/innovations/inn_34.jpg',
  inn_35: '/images/innovations/inn_35.jpg',
  inn_36: '/images/innovations/inn_36.jpg',
  inn_37: '/images/innovations/inn_37.jpg',
  inn_38: '/images/innovations/inn_38.jpg',
  inn_39: '/images/innovations/inn_39.jpg',
  inn_40: '/images/innovations/inn_40.jpg',
  inn_41: '/images/innovations/inn_41.jpg',
  inn_42: '/images/innovations/inn_42.jpg',
  inn_43: '/images/innovations/inn_43.jpg',
};

/**
 * Get the image URL for a given innovation.
 * Returns a local static path (served from Vercel edge CDN).
 */
export function getInnovationImageUrl(
  innovationId: string,
  _seed: number,
  _size: 'card' | 'hero' = 'card'
): string | null {
  return localPaths[innovationId] ?? null;
}

export { localPaths as innovationPrompts };
