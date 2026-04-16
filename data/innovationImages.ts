/**
 * PRISM Innovation Explorer — Cinematic Product Photography Map
 *
 * Each of the 43 innovation concepts gets a description-specific, cinematic
 * editorial photograph via Pollinations.ai Flux model. Every URL is
 * deterministic (stable seed) so repeated loads return the same image.
 *
 * Photography direction: McKinsey / Bain deck-grade visual quality.
 * Each prompt is engineered as a professional stock photographer's brief —
 * product-centric, editorially lit, brand-agnostic consumer goods aesthetic.
 *
 * Style anchor (shared across all 43):
 *   "cinematic editorial product photography, photorealistic high-end
 *    commercial stock photo, soft diffused natural lighting, shallow depth
 *    of field, clean minimalist composition, consumer goods premium aesthetic,
 *    no text, no logos, no watermarks, no brand names, 8K quality"
 */

const STYLE_ANCHOR =
  'cinematic editorial product photography, photorealistic high-end commercial stock photo, soft diffused natural lighting, shallow depth of field, clean minimalist composition, consumer goods premium aesthetic, no text, no logos, no watermarks, no brand names, 8K quality';

/**
 * Per-innovation subject prompts. Each describes the specific product
 * concept as a stock photographer's scene brief.
 */
const innovationPrompts: Record<string, string> = {
  // ── Original v3.0 portfolio (inn_01–inn_16) ────────────────────────────
  inn_01:
    'extreme close-up macro shot of a luxury scalp care serum dropper releasing a single golden droplet onto a healthy glowing scalp with visible hair parting, clinical glass bottle on white marble surface, spa bathroom environment with soft morning light through frosted glass',
  inn_02:
    'beauty editorial portrait of a confident woman with voluminous thick healthy hair caught mid-motion, a sleek clinical hair density serum bottle in sharp focus in the foreground on a minimalist vanity, warm directional studio lighting, shallow depth of field',
  inn_03:
    'overhead flat-lay of thin white concentrated laundry sheets fanned out artfully on a bed of fresh eucalyptus leaves beside perfectly folded crisp white linen, kraft paper packaging, bright clean kitchen counter, natural morning sunlight streaming in',
  inn_04:
    'elegant amber glass fabric refresh mist bottle with a fine spray halo captured mid-spritz beside a neatly folded cashmere sweater and silk blouse on a walnut shelf, warm golden hour light in a luxury walk-in closet',
  inn_05:
    'close-up of a sleek white auto-dosing laundry cartridge being inserted into a premium modern washing machine, glowing LED status indicator, clean contemporary laundry room with concrete and wood finishes, cool blue ambient light',
  inn_06:
    'premium wool overcoat hanging on a wooden hanger in a bright minimalist closet beside a row of garment care products including mist bottle and fiber repair cream on a marble shelf, warm natural gallery lighting, fashion editorial style',
  inn_07:
    'top-down masculine grooming flat-lay on dark veined marble: matte clay tin, beard oil in amber glass, face moisturizer tube, safety razor, charcoal soap bar, arranged with geometric precision, moody dramatic editorial lighting with deep shadows',
  inn_08:
    'woman looking at herself in a salon mirror while a stylist holds up a tablet showing AI-generated hair color simulation overlaid on her reflection, professional color tubes and mixing bowls on the trolley, bright modern salon interior with large windows',
  inn_09:
    'premium plant-based dishwashing gel in a frosted glass pump bottle beside sparkling crystal wine glasses and white ceramic plates on a bright Scandinavian kitchen counter, fresh herb sprigs, crisp natural daylight, clean food photography aesthetic',
  inn_10:
    'scientific close-up of a clear biotech hair repair ampoule being cracked open with visible luminous serum inside, held by a gloved hand with a stainless steel lab fermentation vessel softly blurred in the background, cool blue-white laboratory lighting',
  inn_11:
    'modern minimalist plug-in insect repellent device on a sun-dappled Mediterranean terrace table at golden hour, olive branches and citronella candles in the background, warm summer evening atmosphere with bokeh fairy lights',
  inn_12:
    'professional salon scene: stylist applying a bond-repair treatment to wet sectioned hair using a precision brush, amber treatment bottle prominently displayed on the styling trolley, soft diffused light from large salon windows, editorial beauty photography',
  inn_13:
    'vibrant street-level product display of colorful single-use sachets of shampoo and detergent hanging on clips at an open-air marketplace stall in a warm tropical setting, golden hour light, authentic everyday consumer moment',
  inn_14:
    'young woman running fingers through tousled textured second-day hair in soft morning bedroom light, a hair refresh mist bottle on the nightstand beside fresh flowers, warm intimate editorial beauty photography with natural window light',
  inn_15:
    'three elegant amber glass home care spray bottles with botanical labels arranged on a sunlit marble bathroom vanity beside eucalyptus branches, lavender bundles, and a rolled white towel, wellness spa atmosphere, luxury lifestyle editorial',
  inn_16:
    'modern in-store refill station with sleek brushed-metal dispensers filling reusable premium aluminum bottles, bright clean retail environment with warm wood accents, a customer hand reaching for a bottle, aspirational sustainability editorial',

  // ── v3.1 additions — Hair: Color (inn_17–inn_18) ───────────────────────
  inn_17:
    'portrait of a radiant woman in her early fifties with vibrant rich-toned professionally colored hair, a premium hair color tube and developer bottle artfully placed on a marble vanity in the foreground, luxury salon-at-home setting, warm flattering light',
  inn_18:
    'split composition: left half shows a woman taking a selfie with a phone-mounted color analysis device, right half shows a robotic countertop dispenser mixing a custom hair color formula, futuristic clean salon interior, bright diffused lighting',

  // ── Hair: Care (inn_19–inn_24) ─────────────────────────────────────────
  inn_19:
    'close-up beauty portrait of a Black woman with beautifully defined natural 4C coils, glistening with a curl-defining cream, a range of textured-hair care products in earth-toned packaging arranged on a warm wooden shelf behind her, rich golden editorial light',
  inn_20:
    'wellness-lifestyle shot of a woman in a bright modern bathroom holding a clinical hair recovery shampoo bottle, her reflection showing healthy regrowth, supplement capsules on the counter, clean aspirational health-beauty editorial',
  inn_21:
    'macro close-up of a luminous amber peptide serum ampoule with a single drop forming at the dropper tip, set against a blurred background of precision fermentation laboratory equipment, dramatic rim lighting, scientific beauty editorial',
  inn_22:
    'lifestyle flat-lay of a wellness hair ritual: botanical shampoo bottle, supplement capsule jar, a smartphone showing a biomarker tracking dashboard, fresh turmeric root and green tea leaves on a light linen surface, bright overhead natural light',
  inn_23:
    'elegant silver-haired woman in her late forties with glossy healthy hair applying a luxury treatment serum in a bright serene bathroom, premium glass bottles with minimalist design on the vanity, soft warm directional light, editorial beauty portrait',
  inn_24:
    'artful still-life of solid shampoo bars in earthy tones arranged on a wet concrete slab with tropical monstera leaves, a splash of water mid-freeze, a premium aluminum storage tin beside them, bright clean waterless beauty editorial',

  // ── Hair: Styling (inn_25–inn_26) ──────────────────────────────────────
  inn_25:
    'gen-z teenager with bold creatively styled hair in a colorful bedroom setup, ring light illuminating their face as they film a tutorial on their phone, styling products arranged on the desk, vibrant youthful energy, social-media-native editorial',
  inn_26:
    'clean product photography of a premium hair styling can with a minimalist metallic label on a white marble shelf beside a subscription delivery box with tissue paper, sharp commercial pack-shot lighting, modern bathroom setting',

  // ── Hair: Body (inn_27–inn_28) ─────────────────────────────────────────
  inn_27:
    'lifestyle shot of a fit woman applying a firming peptide body lotion to her arms in front of a full-length mirror in a bright modern bathroom, athleisure wear, clinical-yet-warm wellness aesthetic, natural morning light streaming in',
  inn_28:
    'a young woman in a sunlit tropical bathroom applying body lotion surrounded by lush green plants and teak wood accents, local botanical ingredients like coconut and turmeric visible on the counter, warm Southeast Asian lifestyle editorial',

  // ── LHC: FCN — Fabric Cleaning (inn_29–inn_31) ─────────────────────────
  inn_29:
    'striking split composition: a white concentrated detergent bottle in the foreground with lush green fern leaves wrapped around it, and industrial bio-fermentation tanks gleaming in soft focus behind, sustainability-meets-science editorial, cool natural light',
  inn_30:
    'a sleek premium laundry subscription box being opened on a modern kitchen counter, concentrated detergent pods visible inside with a QR code on the inner lid, smart washing machine control panel glowing in the background, lifestyle tech editorial',
  inn_31:
    'premium laundry detergent bottle on a clean white laundry room shelf with wind turbines visible through a large window beyond rolling green hills, carbon-neutral badge visible concept, crisp sustainability editorial with natural daylight',

  // ── LHC: FCA — Fabric Care (inn_32) ────────────────────────────────────
  inn_32:
    'luxury silk blouse hanging on a premium wooden hanger with a visible digital QR textile-passport tag, beside a specialty fabric care bottle on a bright minimalist shelf, soft natural window light, circular fashion editorial aesthetic',

  // ── LHC: FFI — Fabric Finisher (inn_33) ────────────────────────────────
  inn_33:
    'stack of ultra-fluffy pristine white towels in a sunlit linen closet with dried lavender sprigs laid across the top, an elegant frosted-glass fabric softener bottle beside them, warm diffused golden light, premium home lifestyle editorial',

  // ── LHC: LAD — Laundry Additives (inn_34–inn_35) ───────────────────────
  inn_34:
    'extreme close-up of cashmere sweater fibers being gently protected, a premium jar of fiber-repair laundry booster beside a neatly folded cashmere stack in jewel tones, soft studio lighting, textile-science-meets-luxury editorial',
  inn_35:
    'serene bedroom scene with crisp white bed linens, a scent-booster pouch resting on a plump pillow beside dried lavender stalks, warm golden evening light, sleep-wellness lifestyle editorial photography',

  // ── LHC: HDW — Hand Dish Wash (inn_36) ─────────────────────────────────
  inn_36:
    'elegant cylindrical hand dishwashing gel pump bottle in matte ceramic finish beside soft hands gently rinsing a glass plate under running water, bright Scandinavian kitchen, skincare-inspired premium product photography with warm natural light',

  // ── LHC: ADW — Automatic Dish Wash (inn_37) ────────────────────────────
  inn_37:
    'close-up of a smart dishwasher detergent cartridge with a glowing status LED being docked into a premium built-in dishwasher in a modern kitchen, companion app visible on a smartphone nearby, sleek IoT-tech editorial, cool blue accent lighting',

  // ── LHC: HSC — Hard Surface Care (inn_38–inn_39) ───────────────────────
  inn_38:
    'bright eco-friendly toilet care bottle with botanical design on a clean white bathroom shelf, view through the window showing a wildflower garden with bees, natural daylight, biodiversity-positive home care editorial',
  inn_39:
    'colorful single-use cleaning sachets arranged on a warm wooden kitchen counter in a bright modern home, a woman wiping a surface in the background, affordable everyday household care moment, warm golden afternoon light',

  // ── Cross-Category (inn_40–inn_43) ─────────────────────────────────────
  inn_40:
    'vibrant open-air marketplace in a warm climate with a consumer goods stall displaying colorful sachets and bottles of shampoo, detergent, and body care products, authentic shopping moment, rich golden-hour editorial photography',
  inn_41:
    'young woman in a stylish modern apartment filming a beauty tutorial with ring light and phone tripod, consumer care products artfully arranged on the desk, live-shopping social commerce aesthetic, bright warm lifestyle editorial',
  inn_42:
    'portrait of a woman with sleek glossy keratin-treated hair flowing in a warm breeze, premium hair care products in the foreground on a salon counter, warm sunset light, professional salon-quality beauty editorial',
  inn_43:
    'futuristic holographic AI shopping interface floating over a retail shelf filled with consumer goods products, cool blue tech atmosphere with warm product shelf lighting, agentic commerce concept editorial, cinematic depth of field',
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
