/**
 * PRISM Innovation Explorer — Cinematic Photography Map
 *
 * Each of the 43 innovation concepts gets a description-specific, cinematic
 * editorial photograph. We use Pollinations.ai's free image generation
 * endpoint with the Flux model — every URL is deterministic (stable seed)
 * so repeated loads return the same image.
 *
 * The prompts are engineered per innovation to capture:
 *   • The actual product subject (not the header word)
 *   • The category visual signature (hair, laundry, dish, surface, etc.)
 *   • The consumer moment described in `consumerNeed`
 *   • A consistent cinematic style anchor for portfolio coherence
 *
 * Style anchor (shared across all 43):
 *   "cinematic editorial photography, realistic high-end commercial stock
 *    photo, soft natural lighting, shallow depth of field, Henkel premium
 *    brand aesthetic, photorealistic, no text, no watermark"
 */

const STYLE_ANCHOR =
  'cinematic editorial photography, realistic high-end commercial stock photo, soft natural lighting, shallow depth of field, photorealistic, no text, no watermark, premium brand aesthetic';

/**
 * Per-innovation subject prompts. Each one describes the specific product
 * concept, not just the category. Rewrite carefully if the innovation's
 * `consumerNeed` changes.
 */
const innovationPrompts: Record<string, string> = {
  // ── Original v3.0 portfolio (inn_01–inn_16) ────────────────────────────
  inn_01:
    'macro close-up of a luxury scalp serum dropper releasing a single droplet onto a healthy parting of glossy dark hair, minimalist marble bathroom surface, spa lighting',
  inn_02:
    'cinematic beauty shot of a woman with dense thick shiny hair flowing, a glass vial of anti-thinning peptide serum in the foreground, clinical luxury editorial',
  inn_03:
    'concentrated laundry detergent sheets fanned out on fresh green leaves beside folded white linen, biodegradable kraft paper box, morning kitchen light',
  inn_04:
    'amber glass luxury fabric refresher mist bottle beside a neatly folded cashmere sweater and white shirt, soft natural window light, hotel-suite bedroom',
  inn_05:
    'smart IoT dishwasher cartridge docked into a sleek modern built-in dishwasher, LED indicator glow, companion smartphone app on marble counter',
  inn_06:
    'premium wool overcoat hanging in a luxury walk-in wardrobe with a garment-care mist bottle on a walnut shelf, warm gallery lighting',
  inn_07:
    "masculine grooming lineup on dark veined marble: beard oil, matte face cream, solid cologne and razor, dark moody editorial top-down shot",
  inn_08:
    'a colorist holding a professional hair-color swatch ring next to a tablet showing AI hair analysis, modern luxury salon interior, soft window light',
  inn_09:
    'premium dishwashing gel pump bottle beside crystal wine glasses and clean white plates, fresh herbs, bright Scandinavian kitchen',
  inn_10:
    'biotech recombinant keratin ampoule in a gloved hand in front of a gleaming stainless-steel fermentation tank, cool blue laboratory atmosphere',
  inn_11:
    'modern plug-in insect repellent device on a Mediterranean terrace at dusk, olive leaves and citronella, warm summer evening glow',
  inn_12:
    'professional colorist applying a bond-repair treatment on wet hair in a high-end salon chair, amber bottle of bond builder on the trolley',
  inn_13:
    'neatly arranged single-use sachets of laundry detergent and shampoo on a wooden marketplace stall in a vibrant Mumbai street, warm golden-hour light',
  inn_14:
    'woman running her fingers through tousled second-day hair in natural morning bedroom light, refresh mist bottle on the nightstand, editorial beauty',
  inn_15:
    'aromatherapy home-care trio: amber glass spray bottles with eucalyptus sprigs and lavender bundles on a sunlit spa-like bathroom vanity',
  inn_16:
    'in-store refill station in a modern premium drugstore: reusable aluminium bottles being filled from sleek dispensers, bright retail editorial',

  // ── v3.1 additions — Hair: Color (inn_17–inn_18) ───────────────────────
  inn_17:
    'portrait of a confident stylish woman in her fifties with vibrant rich-colored hair, Schwarzkopf-style professional color tube in the foreground, luxury salon editorial',
  inn_18:
    'salon colorist with a tablet running AI hair diagnostics next to a client in the chair, blond highlights in progress, clean minimal premium salon',

  // ── Hair: Care (inn_19–inn_24) ─────────────────────────────────────────
  inn_19:
    'close-up portrait of a Black woman with beautifully defined natural 4C coily hair, a rich curl-defining cream jar in the foreground, editorial beauty shot',
  inn_20:
    "a slim woman post-weight-loss holding a premium hair recovery shampoo bottle in a bright modern bathroom, wellness editorial atmosphere",
  inn_21:
    'single amber glass peptide ampoule with dropper on a laboratory stainless surface, vial label blank, professional bioactive serum editorial',
  inn_22:
    'a woman in yoga wear in a minimalist wellness studio holding a botanical shampoo bottle, live plants, soft daylight, wellness-beauty editorial',
  inn_23:
    'elegant silver-haired woman in her late forties with glossy healthy hair, applying a luxury longevity hair treatment in a serene bathroom',
  inn_24:
    'solid shampoo bars arranged on a concrete slab with tropical monstera leaves and a splash of water, waterless beauty editorial still-life',

  // ── Hair: Styling (inn_25–inn_26) ──────────────────────────────────────
  inn_25:
    'gen-z teenager with bold styled hair filming a TikTok tutorial with ring light in a colorful bedroom, styling can in hand, vibrant youth culture editorial',
  inn_26:
    'cinematic pack shot of a premium hair-styling can on a minimalist modern bathroom shelf beside a subscription cardboard box, sharp product photography',

  // ── Hair: Body (inn_27–inn_28) ─────────────────────────────────────────
  inn_27:
    'woman applying firming body lotion to her arms in front of a mirror after a workout, athleisure aesthetic, post-GLP-1 wellness editorial',
  inn_28:
    'a young hijabi Southeast Asian woman applying a halal-certified body lotion in a sunlit tropical Jakarta bathroom, plants and teak accents',

  // ── LHC: FCN — Fabric Cleaning (inn_29–inn_31) ─────────────────────────
  inn_29:
    'white laundry detergent bottle in the foreground with stainless bio-fermentation tanks and lush rainforest canopy behind, palm-free sustainability editorial',
  inn_30:
    'a premium laundry subscription box delivered on the doorstep of a minimalist modern home, warm morning light, lifestyle editorial',
  inn_31:
    'laundry detergent bottle on a laundry-room shelf with wind turbines visible through a large window, clean carbon-neutral editorial',

  // ── LHC: FCA — Fabric Care (inn_32) ────────────────────────────────────
  inn_32:
    'a luxury silk blouse hanging on a designer clothing rail with a digital textile-passport QR tag, circular fashion editorial, soft natural light',

  // ── LHC: FFI — Fabric Finisher (inn_33) ────────────────────────────────
  inn_33:
    'ultra-fluffy folded white towels stacked in a sunlit linen room with a lavender sprig and an elegant fabric softener bottle, premium home editorial',

  // ── LHC: LAD — Laundry Additives (inn_34–inn_35) ───────────────────────
  inn_34:
    'close-up of cashmere fibers being gently repaired, a sleek jar of fiber-repair laundry booster beside a folded cashmere sweater, textile science editorial',
  inn_35:
    'pristine bedroom with crisp white linen sheets, a bundle of fresh lavender and an elegant scent-booster pouch on the pillow, sleep-wellness editorial',

  // ── LHC: HDW — Hand Dish Wash (inn_36) ─────────────────────────────────
  inn_36:
    'dermatologist-style gentle hand dishwashing gel pump bottle beside soft hands rinsing a glass plate under running water, clean skincare-inspired editorial',

  // ── LHC: ADW — Automatic Dish Wash (inn_37) ────────────────────────────
  inn_37:
    'sleek smart dishwasher cartridge docked into a premium built-in dishwasher in a modern German kitchen, glowing status LED, IoT editorial',

  // ── LHC: HSC — Hard Surface Care (inn_38–inn_39) ───────────────────────
  inn_38:
    'an eco-friendly toilet care bottle on a bathroom shelf with bees and wildflowers visible through a window to a pollinator garden, biodiversity editorial',
  inn_39:
    'a Nigerian family kitchen in Lagos with modern multi-purpose sachet cleaners on the counter, warm golden afternoon light, African home editorial',

  // ── Cross-Category (inn_40–inn_43) ─────────────────────────────────────
  inn_40:
    'vibrant Sub-Saharan African open-air marketplace with a branded consumer-goods stall displaying sachets of shampoo and detergent, golden-hour editorial',
  inn_41:
    'a young Indonesian woman filming a beauty tutorial on her phone in a stylish Jakarta apartment with ring light and skincare products, live-shopping editorial',
  inn_42:
    'Brazilian woman with silky straight post-keratin hair flowing in the wind on a Rio beach at sunset, premium hair-care bottle in hand, editorial beauty',
  inn_43:
    'a holographic AI shopping agent interface hovering over a retail shelf of consumer goods, futuristic agentic commerce editorial, cool blue tech atmosphere',
};

/**
 * Build a deterministic Pollinations Flux URL for a given innovation.
 * Seed = innovation number → stable image per innovation across reloads.
 */
export function getInnovationImageUrl(
  innovationId: string,
  seed: number,
  size: 'card' | 'hero' = 'card'
): string | null {
  const subject = innovationPrompts[innovationId];
  if (!subject) return null;

  const width = size === 'hero' ? 1600 : 1200;
  const height = size === 'hero' ? 1000 : 900;
  const prompt = `${subject}, ${STYLE_ANCHOR}`;
  const encoded = encodeURIComponent(prompt);

  // Pollinations Flux — free, no auth, deterministic with stable seed.
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&enhance=true&nologo=true&seed=${seed}`;
}

export { innovationPrompts };
