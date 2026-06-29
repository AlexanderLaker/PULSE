/**
 * consumerJourney.ts — Consumer Journey content (tiles, stage contexts).
 *
 * Extracted out of ConsumerJourney2.tsx on 2026-06-10 so content is data,
 * not code. This module is the SEED content; runtime content is served by
 * GET /api/journey (admin edits persist there) with this file as fallback.
 *
 * Content provenance is tracked per tile:
 *   author 'strategist' · 2026-04  — original hand-authored content (Apr 2026)
 *   author 'strategist' · 2026-06  — corrected/re-based June 2026
 *   author 'ai'         · 2026-06  — AI-suggested v3.1/v3.3 trend mapping,
 *                                    grade 'hypothesis', pending review
 * Evidence grades: 'verified' (sourced hard data) | 'estimate' (Fermi/consulting
 * estimate) | 'hypothesis' (needs validation).
 *
 * Tile→trend linkage is via trendCodes (canonical codes — see
 * data/trendCodeMap.ts). driverNote is display rationale text only.
 */

export type JourneyKey = 'lhc' | 'hair';
export type TileType = 'product' | 'tech' | 'service';
export type ProvenanceGrade = 'verified' | 'estimate' | 'hypothesis';

export interface TileProvenance {
  author: 'strategist' | 'ai';
  date: string; // YYYY-MM
  grade: ProvenanceGrade;
}

export type PoolImpactGrade = 'Low' | 'Med' | 'High';

export interface PoolImpactInfo {
  /** Profit-pool impact intensity from the 99 trends (Low/Med/High). */
  grade: PoolImpactGrade;
  /** tailwind = benefiting (green) · headwind = declining (red). */
  direction: 'tailwind' | 'headwind';
}

export interface JourneyTile {
  id: string;
  name: string;
  type: TileType;
  /** Canonical trend codes (see data/trendCodeMap.ts). */
  trendCodes: string[];
  /** Short display rationale ("T-07 digital replaces static instructions"). */
  driverNote: string;
  /** Impact intensity on this product type at this stage: 1 mild · 2 moderate · 3 strong. */
  intensity: 1 | 2 | 3;
  provenance: TileProvenance;
  /** Trend-derived profit-pool impact intensity + direction (graded from the 99 trends). */
  poolImpact?: PoolImpactInfo;
  /** Strategist Read — authored analysis (Summary / Strategic Evaluation).
   *  AUTHORED CONTENT, not simulation output. */
  analysis: string | null;
}

export interface JourneyStageDef {
  id: string;
  label: string;
  benefiting: JourneyTile[];
  negativelyImpacted: JourneyTile[];
}

export interface StageContext {
  henkelBrands: string;
  competitors: string;
  opportunity: string;
}

export const JOURNEY_CONTENT_VERSION = '2026-06-29';

export const LHC_JOURNEY: JourneyStageDef[] = [
  {
    "id": "sorting",
    "label": "Sorting",
    "benefiting": [
      {
        "name": "AI stain/fabric recognition apps",
        "type": "tech",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-Driven Formulation enables intelligent analysis",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** When a phone camera reads the garment, it also reads the regimen — and from there it picks the SKU. T-01 collapses what was a label-and-touch decision into an algorithmic recommendation, lifting the choice moment off the shelf and onto the device. The pool that used to sit in packaging-led discovery migrates to whoever controls the diagnostic-to-prescription path; once the consumer trusts the camera, brand comparison stops happening at the shelf.\\n\\n**2. Strategic Evaluation.** AI-driven formulation moves the choice moment off the shelf and onto the camera, so over the decade the pool migrates to whoever owns the diagnostic-to-prescription path. The structural bet is a Persil-grade garment-recognition and recommendation engine fed by HCB's enzyme and fabric-efficacy data — a hard-to-copy chemistry asset, not a generic app. Ceteris paribus, if HCB lets the recognition layer stay neutral the brand comparison it relies on simply stops happening; the capability to build is reading garment plus regimen, not another OEM tie-up.",
        "id": "lhc.sorting.exp.ai-stain-fabric-recognition-apps",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart fabric scanner & QR tools",
        "type": "tech",
        "trendCodes": [
          "T-07",
          "T-01"
        ],
        "driverNote": "T-07 AI Personalization + T-01 AI enablement",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-07 (Digital Product Passport) embeds QR-driven fabric metadata into the laundry journey. Scanning a garment's care profile unlocks prescriptive bundles — not just instructions, but the actual product stack that code-generator systems can recommend. This is the shelf displacing into supply-chain logic: the consumer follows a digital passport, not a brand.\\n\\n**2. Strategic Evaluation.** AI personalization plus digital-passport metadata turns the scan into the point where the product stack gets chosen, so the structural pool sits with whoever converts a care profile into a prescribed regimen. HCB's right-to-win is its enzyme and efficacy knowledge: the recommendation must be demonstrably better, not merely default. The bet this decade is owning the data layer that maps fabric metadata to Persil/Vernel performance across machines — a chemistry-and-data moat, not exclusive scanner hardware, which competitors and OEMs would route around.",
        "id": "lhc.sorting.exp.smart-fabric-scanner-and-qr-tools",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Garment care advisory service (digital)",
        "type": "service",
        "trendCodes": [
          "T-07",
          "K-04"
        ],
        "driverNote": "T-07 AI Personalization + K-04 Social Commerce",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-04 (Social Commerce) and T-07 (AI Personalization) converge on a new consumer moment: the on-demand garment concierge. Instead of a printed care label, the consumer texts or TikToks a photo; an AI service recommends not just a detergent but a rinse cycle, temperature, and a follow-up product (softener, refresh spray). The profit pool shifts from commodity shelf to subscription-grade advisory margins.\\n\\n**2. Strategic Evaluation.** Social commerce plus AI personalization create an on-demand care concierge where advisory judgment, not the printed label, picks the regimen — so the structural pool shifts toward whoever is trusted to give it. HCB should treat this as a branded knowledge service grounded in Persil and Vernel fabric and scent expertise, earning the recommendation rather than gating it behind a paywall any rival could undercut. The decade bet is becoming the garment-care authority consumers consult; the honest near-term move is to ride social channels and partner on reach, not build a standalone platform.",
        "id": "lhc.sorting.exp.garment-care-advisory-service-digital",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart home integration platforms",
        "type": "tech",
        "trendCodes": [
          "T-01",
          "T-08"
        ],
        "driverNote": "T-01 + T-08 Connected Appliances auto-sorting",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (Connected Appliances) collapses the sorting decision upstream: the washer itself reads WiFi—connected Philips Hue bulbs, smart home humidity sensors, even calendar data—and pre-selects a cycle and detergent. The consumer no longer chooses; the platform does. Profit migrates from consumer packaging choice to OEM default settings and recurring cartridge subscriptions.\\n\\n**2. Strategic Evaluation.** Connected appliances pull the sorting and dosing decision upstream into the platform, so the pool concentrates around recommended-detergent status and recurring replenishment rather than shelf choice. HCB's right-to-win is making Persil and Vernel the chemistry the machine reasons about — the efficacy and dosing intelligence the appliance trusts — across any connected washer, since Smartwash is machine-agnostic. The decade bet is dosing-and-data interoperability that keeps HCB present whoever owns the home hub; tying the future to one appliance partner would be fragile.",
        "id": "lhc.sorting.exp.smart-home-integration-platforms",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "DPP-enabled garment care scanners",
        "type": "tech",
        "trendCodes": [
          "G-07",
          "T-01"
        ],
        "driverNote": "G-07 Digital Product Passport + T-01 AI fabric recognition",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-07 (Digital Product Passport) and T-01 (AI Formulation) converge on a single product moment: the DPP QR on a garment triggers both care-regimen recommendation and the fulfillment of that regimen. The scanner becomes a transaction portal. Whoever controls the scanner controls the replenishment decision.\\n\\n**2. Strategic Evaluation.** The Digital Product Passport plus AI recognition fuse care advice and replenishment into one scan, so the pool flows to whoever turns the QR into a trusted regimen-and-reorder moment. HCB's distinct asset is fabric-durability and enzyme know-how: it can read passport data — fibre content, care history — and translate it into demonstrably better Persil and Vernel performance. The decade bet is owning that read-to-prescription logic as open, cross-machine capability; the passport is a regulatory rail to ride, not hardware to fence off.",
        "id": "lhc.sorting.exp.dpp-enabled-garment-care-scanners",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Large-print accessible care labels",
        "type": "product",
        "trendCodes": [
          "C-05"
        ],
        "driverNote": "C-05 Silver Economy ease-of-use packaging",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-05 (Silver Economy) targets the 60+ demographic driving 40% of LHC spend in Europe. Aging consumers depend on tactile and large-format care instructions; this is a packaging design trend driven by demographic demand, not regulation. Henkel can capture a premium position by making accessibility the brand signal.\\n\\n**2. Strategic Evaluation.** The silver economy makes accessibility a durable demand signal, so the pool tilts toward brands that design ease-of-use into the format rather than bolt it on. HCB's right-to-win is its trusted household heritage — Persil and Sil legibility, opening, dosing and tactile cues built natively for ageing hands and eyes. The decade bet is making accessible-by-design a defensible brand signature embedded across core packaging and product architecture, not a single premium SKU — a capability where private label and one-size-fits-all rivals are weakest.",
        "id": "lhc.sorting.exp.large-print-accessible-care-labels",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Manual sorting aids (baskets, dividers)",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI displacement of manual tasks",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 and T-07 (AI Personalization) are making manual sorting visual aids—colour-coded baskets, dividers, print guides—obsolete. The washer with an integrated camera and load-weight sensor becomes the sorting system; the consumer's job is simply to open the door. Profit shifts from low-margin plastic accessories to high-margin software subscriptions.\\n\\n**2. Strategic Evaluation.** AI recognition makes colour-coded baskets and dividers obsolete as the machine itself becomes the sorting system, so this low-margin accessory pool structurally drains toward software and appliance intelligence. The honest move is to harvest cleanly — concede the commoditising plastics to private label and redeploy resource into the recognition-and-dosing layer where Persil's chemistry and efficacy data give HCB a real right-to-win. Defending branded baskets would spend scarce innovation budget against format obsolescence; the pool is leaving, and HCB should move with it.",
        "id": "lhc.sorting.con.manual-sorting-aids-baskets-dividers",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Generic care label guides (print)",
        "type": "product",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 Digital replaces static instructions",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 (AI Personalization at Scale) removes the need for paper care guides inside or on packaging. A smartphone QR code triggers a personalized, voice-driven video tutorial tailored to the consumer's device language and washing machine model. Static printed guides are now a cost centre, not a feature.\\n\\n**2. Strategic Evaluation.** AI personalization replaces static printed guides with dynamic, device-specific instruction, so this pool is a small declining cost centre rather than a contested market. The honest move is to retire paper guidance in an orderly way and redeploy the freed packaging and design effort into the digital recommendation layer where Persil's fabric-care authority can be expressed. There is no pool to defend here; the structural value sits in owning the trusted prescription, not in printing instructions a phone now delivers better.",
        "id": "lhc.sorting.con.generic-care-label-guides-print",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Fabric identification cards",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI recognition obsoletes manuals",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI Fabric Recognition) makes the physical identification card redundant. A phone camera now identifies fibre content, weave density, and care sensitivity more accurately than a consumer consulting a printed card. The card's profit pool was never substantial; its death is not a competitive event but a format obsolescence.\\n\\n**2. Strategic Evaluation.** AI fabric recognition makes the printed identification card redundant — a phone reads fibre and care sensitivity more accurately — so this never-substantial pool dies of format obsolescence, not competition. The clean move is to stop funding card inserts and displays and redirect that effort to owning the recommendation that follows identification, where HCB's enzyme and efficacy knowledge is the durable asset. HCB should not fight AI with paper; it should be the trusted prescription the AI hands the consumer once the fabric is read.",
        "id": "lhc.sorting.con.fabric-identification-cards",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "pre_treating",
    "label": "Pre-Treating",
    "benefiting": [
      {
        "name": "Enzyme-based stain removers (bio-actives)",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + T-01 enzyme optimization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 (Bio-Based & Green Chemistry) and T-01 (AI enzyme optimization) converge on a new generation of stain-removal actives: cellulase, amylase, and protease enzymes optimized for specific fibre/stain combinations via AI screening. These actives are more efficacious than synthetic bleach, align with G-01/G-02 regulatory bans on PFCs and chlorine, and command 30–50% premiums over conventional formulations.\\n\\n**2. Strategic Evaluation.** Green chemistry plus AI enzyme screening shift the pre-treat pool toward efficacious bio-actives — cellulase, protease, amylase, lipase tuned to fibre and stain — and away from the chlorine bleach regulators are squeezing out. This sits squarely on HCB's strongest assets: Persil enzyme R&D and Sil's stain heritage. The decade bet is owning enzyme-efficacy leadership in pre-treat by investing in the active platform and AI-formulation capability — a chemistry moat slower reformulators cannot quickly copy. Vanish remains a well-resourced Reckitt powerbrand, so the win must be earned on demonstrable performance.",
        "id": "lhc.pre_treating.exp.enzyme-based-stain-removers-bio-actives",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Targeted stain pens & precision sprays",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats enable targeted dosing",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (Concentrated Formats) enables ultra-targeted stain dosing: a pen applicator or micro-spray delivers a 0.2ml dose of concentrated enzyme complex directly to the stain. This is the opposite of the pre-treat bucket; it reduces waste, increases efficacy per dose, and commands premiums. The trend is from \"drown the garment\" to \"laser the stain\".\\n\\n**2. Strategic Evaluation.** Concentrated formats move stain treatment from 'drown the garment' to 'laser the stain', and this precision pool — though smaller — premiumises on efficacy per dose. HCB's right-to-win is real: concentrate and Discs format leadership plus Sil's stain credibility let it engineer high-concentration targeted actives rivals cannot easily match. The decade bet is treating precision delivery as a defensible format capability anchored in Sil, won on demonstrable stain performance against well-resourced incumbents like Vanish — not on novelty alone.",
        "id": "lhc.pre_treating.exp.targeted-stain-pens-and-precision-sprays",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Ultrasonic stain erasers (devices)",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation + IoT devices",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (Manufacturing Automation) enables micro-scale IoT device production: ultrasonic vibration at 40kHz can disrupt stain particles without damaging fibres. This shifts stain removal from chemistry to hardware, creating a new product category at the intersection of appliances and laundry care. The profit pool here is device revenue + consumable refills (cleaning pads, power cells).\\n\\n**2. Strategic Evaluation.** Manufacturing automation opens a small new pool where stain removal shifts partly from chemistry to hardware plus consumable refills — a device-and-pad category adjacent to HCB's core. The honest read is that HCB's right-to-win is the enzyme chemistry inside the pad, not the electronics; the device is best ridden via partnership while HCB owns the active consumable, where Sil and Persil expertise compound. The decade bet is securing the refill-active layer of any ultrasonic format, not building hardware capability far from HCB's distinctive assets.",
        "id": "lhc.pre_treating.exp.ultrasonic-stain-erasers-devices",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Plant-based odor neutralizers",
        "type": "product",
        "trendCodes": [
          "T-02",
          "C-04"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + C-04 Conscious Consumption",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 (Bio-Based Chemistry) and C-04 (Conscious Consumption) drive a shift from synthetic fragrance masking to botanical odor neutralizers: charcoal, enzymes, and essential oils that degrade odor molecules rather than perfuming over them. The pool here expands as consumers trade synthetic fragrances for \"clean\" actives; margin expansion comes from premiumization, not volume.\\n\\n**2. Strategic Evaluation.** Green chemistry plus conscious consumption move the pool from synthetic fragrance masking to botanical actives that degrade odour molecules, premiumising on genuine elimination over perfume cover-up. HCB's right-to-win combines Sil/Persil active formulation with Vernel's fabric and scent technology — credibility to deliver 'eliminates, not masks' rather than relabel a fragrance. The decade bet is owning proven odour-elimination chemistry as a defensible position; the discipline is substantiation, since the same green-claims scrutiny that opens this pool will punish unproven 'clean' messaging.",
        "id": "lhc.pre_treating.exp.plant-based-odor-neutralizers",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart stain analyzer (app + device)",
        "type": "tech",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-Driven Formulation for stain ID",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI-Driven Formulation) and T-07 (AI Personalization at Scale) enable a stain-to-recommendation engine: the consumer uploads a photo of the stain (or places the garment in a handheld spectrometer); the app identifies stain type (blood, wine, grass, rust) and recommends the optimal Sil product + soak time + temperature. The pool shifts from retail shelf discovery to data-driven in-app commerce.\\n\\n**2. Strategic Evaluation.** AI formulation plus personalization create a stain-to-recommendation engine that moves discovery from the shelf into a diagnostic moment, so the pool flows to whoever credibly maps a stain to the right active and method. HCB's distinctive asset is the underlying stain-and-enzyme science — Sil and Persil efficacy data — that makes the recommendation trustworthy, not generic. The decade bet is owning that diagnostic intelligence as an open capability routing to HCB's superior actives; the honest move is to compete on accuracy and chemistry, not on subsidised hardware any rival could clone.",
        "id": "lhc.pre_treating.exp.smart-stain-analyzer-app-device",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Sustainable stain removal subscriptions",
        "type": "service",
        "trendCodes": [
          "C-04",
          "K-06"
        ],
        "driverNote": "C-04 Cleanical Beauty + K-06 Subscription models",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 (Conscious Consumption) and K-06 (Subscription & Auto-Replenishment) converge on a new commerce model: consumers subscribe to a quarterly Sil stain-removal bundle (four targeted products) curated for their household's stain profile (children, sports, cooking, wine consumption). The pool moves from one-shot purchases to recurring LTV optimization.\\n\\n**2. Strategic Evaluation.** Conscious consumption plus replenishment models point to recurring, household-profiled stain-care relationships, but this is a modest pool and the subscription trend itself is a contraction driver. HCB's right-to-win is the curated efficacy of Sil and Persil actives matched to a household's real stain mix, not a subscription wrapper any DTC brand can replicate. The decade bet is earning recurring relevance through demonstrably better, personalised stain performance; the honest stance is to ride replenishment where retail and platform partners already own the consumer rather than over-build a standalone service.",
        "id": "lhc.pre_treating.exp.sustainable-stain-removal-subscriptions",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Concentrated stain remover refill pouches",
        "type": "product",
        "trendCodes": [
          "C-13",
          "T-03"
        ],
        "driverNote": "C-13 Refill & Reuse Economy + T-03 Concentrated Formats",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-13 (Refill & Reuse Economy) and T-03 (Concentrated Formats) enable a 70% logistics-cost reduction via concentrated refill pouches: instead of shipping water-heavy 500ml bottles, Sil ships a 100ml concentrate pouch (refill-only) at 1/5 the carbon footprint and 40% lower COGS. Retailers gain shelf density; consumers gain a sustainable signal and lower total cost-of-ownership.\\n\\n**2. Strategic Evaluation.** Refill-and-reuse plus concentrated formats restructure the pre-treat pool around dematerialised, low-logistics-footprint delivery — concentrate pouches over water-heavy bottles — with a durable sustainability signal. This is a natural extension of HCB's concentrate and Discs format leadership and Sil's stain credibility, a genuine capability rather than a packaging gimmick. The decade bet is making refillable concentrate the default architecture for Sil pre-treat, with reusable applicators, so HCB leads the format shift; the discipline is keeping the sustainability claim substantiated as green-claims enforcement tightens.",
        "id": "lhc.pre_treating.exp.concentrated-stain-remover-refill-pouches",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Chlorine-based pre-treaters",
        "type": "product",
        "trendCodes": [
          "G-01",
          "G-02"
        ],
        "driverNote": "G-01 PFAS Restriction + G-02 Microplastics Ban",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** This is not a demand story; it is a shelf story. G-01 (PFAS restriction) and G-02 (microplastics ban Phase 2) reclassify chlorine pre-treat chemistries as either reformulation cases or de-list cases under the EU REACH and PPWR cascade. Pool does not migrate to a substitute SKU automatically—it migrates to whoever has the bio-enzymatic stand-in already on the shelf when the listing window opens.\\n\\n**2. Strategic Evaluation.** This is a shelf story, not a demand story: PFAS and microplastics rules reclassify chlorine pre-treat chemistries toward reformulation or delisting, and the pool migrates to whoever has a credible bio-enzymatic stand-in listed when the window opens. HCB should harvest the declining chemistry deliberately while redeploying resource into Sil and Persil enzyme alternatives its R&D already supports. The structural move is to be the compliant substitute on the shelf as the category resets — noting Vanish is a well-resourced Reckitt rival reformulating in parallel, so readiness wins, not assumed competitor slowness.",
        "id": "lhc.pre_treating.con.chlorine-based-pre-treaters",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Solvent-based fabric protectors",
        "type": "product",
        "trendCodes": [
          "G-01",
          "G-03"
        ],
        "driverNote": "G-01 PFAS + G-03 Cosmetics Regulation extends to textiles",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Solvent-based fabric protectors (silicone resins, hydrocarbon chains) face a double squeeze: G-01 (PFAS extension to \"PFOA-free\" solvents) and G-03 (Cosmetics Regulation tightening on inhalation hazards). Formulators cannot simply swap solvents; the entire chemistry stack requires de-risking. Retailers will delist before brands can reformulate, collapsing the category faster than demand would alone.\\n\\n**2. Strategic Evaluation.** Solvent-based protectors face a regulatory double squeeze where retailers will delist before the chemistry can be re-engineered, collapsing the category faster than demand alone — this pool is structurally leaving. The honest move is a clean exit ahead of the cliff, redeploying SKU capacity and R&D into enzyme-based actives where Sil and Persil have a real right-to-win. Chasing a solvent reformulation burns scarce capability against a closing window; HCB should harvest, exit cleanly, and move resource to where the pool is going.",
        "id": "lhc.pre_treating.con.solvent-based-fabric-protectors",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Soil-release coatings (PFCs)",
        "type": "product",
        "trendCodes": [
          "G-01"
        ],
        "driverNote": "G-01 PFAS Restriction (direct regulatory hit)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-01 (PFAS restriction) is past the point of debate: the PFHxA restriction adopted in 2024 begins applying to consumer textile uses from late 2026, and the universal PFAS restriction is advancing through the ECHA process. Soil-release chemistries (fluorocarbon chains that prevent dirt adhesion) are the definition of PFAS. For fluorocarbon soil-release chemistry the question is delisting timing, not direction. The profit pool for PFC-based soil-release coatings is already zero; the only variable is delisting speed.\\n\\n**2. Strategic Evaluation.** Fluorocarbon soil-release chemistry is, by definition, PFAS, and with restrictions advancing the structural pool is effectively gone — the only variable is delisting speed. This is hygiene, not strategy: exit cleanly and ensure HCB's compliant enzyme-based soil-release alternatives hold the shelf adjacency as PFC products depart. The redeployment is into the durable bio-active platform where Persil R&D compounds; there is no opportunity to defend here, only an orderly exit and a clean handoff to compliant chemistry.",
        "id": "lhc.pre_treating.con.soil-release-coatings-pfcs",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Heavy chemical stain blockers",
        "type": "product",
        "trendCodes": [
          "G-05"
        ],
        "driverNote": "G-05 Green Claims Directive (greenwashing crackdown)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-05 (Green Claims Directive) is a greenwashing enforcement mechanism. Products marketed as \"stain blockers\" using heavy chemical formulations (quaternary ammonium compounds, synthetic organofluorines) face substantiation demands. Brands cannot claim \"effective stain protection\" without clinical-grade proof; marketing claims will be audited and material penalties apply per false claim under EU enforcement.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement removes the substantiation behind 'stain blocker' messaging on heavy chemical formulations, so the pool tied to unproven claims contracts — a claims reset, not a category exit. HCB's structural advantage is that its enzyme efficacy is genuinely demonstrable, letting it reframe Sil and Persil around proven performance while weaker claims fall away. The decade bet is making substantiated efficacy the basis of competition; the discipline is auditing claims proactively, since well-resourced rivals like Vanish face the same bar and will reset their messaging too.",
        "id": "lhc.pre_treating.con.heavy-chemical-stain-blockers",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Synthetic perfume-heavy pre-treaters",
        "type": "product",
        "trendCodes": [
          "C-04",
          "G-05"
        ],
        "driverNote": "C-04 Conscious Consumption + G-05 Green Claims",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 (Conscious Consumption) and G-05 (Green Claims Directive) erode the market for fragrance-dominant pre-treaters. Consumers now demand efficacy-first formulations; G-05 bans unsubstantiated fragrance claims (\"fresh all day\"). Pre-treaters marketed primarily on fragrance now lose the claim that justified the premium positioning.\\n\\n**2. Strategic Evaluation.** Conscious consumption plus green-claims enforcement erode the fragrance-led pre-treat pool by stripping the unsubstantiated scent claims that justified its premium, pushing value toward efficacy-first formulations. HCB should reposition Sil around demonstrable enzymatic stain removal — its real asset — and harvest the fragrance-dominant lines rather than defend them. The structural bet is owning the 'works, provably' space as the perfume halo loses its claim; this is a repositioning of resource toward proven actives, with the same scrutiny applying to all fragrance-heavy incumbents.",
        "id": "lhc.pre_treating.con.synthetic-perfume-heavy-pre-treaters",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Retailer own-brand stain removers (premium PL)",
        "type": "product",
        "trendCodes": [
          "C-01"
        ],
        "driverNote": "C-01 Private Label Structural Penetration at 42% share",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-01 (Private Label Structural Penetration) now extends into pre-treat category. Premium private label (Sainsbury's Taste The Difference, Carrefour Selection) copies branded formulations within 6 months and undercuts on price by 35–40%. The stain-remover shelf is becoming a listing contest, not a brand contest: whoever secures high-facings at eye level wins.\\n\\n**2. Strategic Evaluation.** Structural private-label penetration turns the pre-treat shelf into a listing contest where premium own-brand fast-follows branded formulas, compressing the pool for undifferentiated SKUs. HCB's defence is genuine, hard-to-copy efficacy — Sil's stain heritage and Persil enzyme performance — plus value-tier assets like Weißer Riese and Spee to fight on the right rungs rather than chase price to the floor. The decade move is to harvest commoditising mid-tier exposure and concentrate resource where demonstrable performance and brand trust keep HCB ahead of formula-copying private label.",
        "id": "lhc.pre_treating.con.retailer-own-brand-stain-removers-premium-pl",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Skill-dependent multi-step treatment products (cleaning-fluency decline)",
        "type": "product",
        "trendCodes": [
          "C-31"
        ],
        "driverNote": "C-31 Gen Z cleaning-fluency decline — only 34% know basic garment-care tasks",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-31: Gen Z enters household formation with materially lower cleaning fluency — the DB cites only 34% knowing basic garment-care tasks. Products that assume diagnostic skill (which stain, which treatment, which temperature) lose this cohort to single-step, mistake-proof alternatives or to not treating at all. The pre-treat stage is the most skill-dependent moment in the journey.\n\n**2. Strategic Evaluation.** Generational decline in cleaning fluency erodes demand for skill-dependent, multi-step treatments at the most diagnostic moment in the journey, so the pool shifts toward mistake-proof, all-in-one formats. HCB can convert this threat into a defence by radically simplifying Sil — universal-stain claims and guidance that remove the need for expertise — while its concentrate and Discs format leadership captures the fluency-poor consumer downstream. The structural bet is owning simplicity as a designed capability, redeploying from products that assume diagnostic skill toward formats that need none.",
        "id": "lhc.pre_treating.con.skill-dependent-multi-step-treatment-products-cl",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "loading",
    "label": "Loading",
    "benefiting": [
      {
        "name": "Microfibre filters (catch clothing shedding)",
        "type": "product",
        "trendCodes": [
          "G-02"
        ],
        "driverNote": "G-02 Microplastics Ban Phase 2 (regulatory tailwind)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-02 (Microplastics Ban Phase 2) extends beyond intentional additives to unintentional shedding from garments. A microfibre filter in the washing machine drum now prevents 0.2–0.5g of textile fibres (microplastics) from entering wastewater per load. This is a regulatory tailwind: governments are mandating microfibre capture, turning it from a niche feature into a mass-market appliance add-on.\\n\\n**2. Strategic Evaluation.** The microplastics rules turn microfibre capture from niche feature into a mandated, mass-market context, so the pool tilts toward detergents engineered to minimise shedding and work cleanly with filter-equipped machines. HCB's right-to-win is Persil's enzyme and surfactant science — formulating for low fibre release and filter compatibility is a chemistry capability, not a marketing label. The decade bet is owning fibre-gentle, filter-optimised performance as the regulatory baseline arrives, positioning HCB as the chemistry the compliant machine is designed around.",
        "id": "lhc.loading.exp.microfibre-filters-catch-clothing-shedding",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart load sensors / weight add-ons",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances + IoT load detection",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (Connected Appliances) enables external IoT load sensors that retrofit onto any washer. The sensor measures actual load weight and fabric composition via acoustic analysis, transmitting recommendations to the Smartwash app. This is the retrofit path for older machines; it extends the connected-laundry moat to used and budget appliances that do not have native connectivity.\\n\\n**2. Strategic Evaluation.** Connected appliances enable retrofit load sensing that extends auto-dosing to older and budget machines, but the structural value sits in the dosing intelligence and chemistry, not the sensor hardware. HCB's right-to-win is making Persil and Vernel the actives the system meters precisely across any washer — Smartwash is machine-agnostic, so this is a data-and-chemistry play, not a device business. The decade bet is owning the dosing logic any retrofit sensor feeds; the honest stance is to partner on hardware reach while HCB keeps the recurring active relationship.",
        "id": "lhc.loading.exp.smart-load-sensors-weight-add-ons",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Laundry optimization balls",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats reduce detergent need",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (Concentrated Formats) enables ultra-concentrated detergent payloads embedded into reusable silicone balls. Instead of pre-measuring liquid, the consumer drops a ball into the drum; enzymes and surfactants are released over 90 minutes. This is the format bridge between pods (locked in by detergent companies) and bulk liquid (commodity).\\n\\n**2. Strategic Evaluation.** Concentrated formats open a modest pool for reusable-dosing devices that bridge single-use pods and commodity liquid, premiumising on refillable convenience. HCB's right-to-win is its concentrate and Discs leadership and Persil chemistry — the high-payload active inside the device is the defensible asset, not the silicone shell. The decade bet is owning refillable concentrated dosing as a format extension where HCB's formulation depth shows, rather than treating it as a gadget; the value is in the recurring concentrate, where private label and single-use rivals are weaker.",
        "id": "lhc.loading.exp.laundry-optimization-balls",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Auto-load-weighing machine adapters",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation integration",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (Manufacturing Automation) enables low-cost load-weighing retrofit adapters that bolt onto washer drums. Unlike external sensors, these integrate directly into the machine's water-intake system, delivering real-time load feedback and auto-dosing recommendations. This is the bridge between legacy machines and connected appliances.\\n\\n**2. Strategic Evaluation.** Manufacturing automation makes low-cost load-weighing retrofits viable, bridging legacy machines into auto-dosing — but as with sensors, the structural pool is the metered chemistry and the recurring active, not the adapter. HCB's right-to-win is making Persil and Vernel the actives any retrofitted machine doses precisely, across brands, since Smartwash works machine-agnostically. The decade bet is owning the dosing-and-active layer through interoperable refills; hardware adapters are best built with appliance partners while HCB keeps the durable consumable relationship and its formulation moat.",
        "id": "lhc.loading.exp.auto-load-weighing-machine-adapters",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Fabric care dispensing systems",
        "type": "product",
        "trendCodes": [
          "T-03",
          "T-08"
        ],
        "driverNote": "T-03 Concentrated Formats + T-08 Auto-dosing",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (Concentrated Formats) and T-08 (Auto-dosing) converge on integrated fabric-care dispensing: a single cartridge housing detergent, softener, and stain-removal actives that the machine dispenses in correct proportions at correct times. This is the Nespresso model: the consumer never measures; the machine does.\\n\\n**2. Strategic Evaluation.** Concentrated formats plus auto-dosing converge on integrated multi-active dispensing — detergent, softener, stain active released in proportion — so the pool moves to whoever supplies the precision-dosed chemistry. HCB's right-to-win is unusually strong: concentrate and Discs leadership plus Persil and Vernel actives spanning detergent, softening and stain in one system. The decade bet is owning that multi-active dosing platform as chemistry that works across machines — Smartwash is machine-agnostic — so the moat is formulation and dosing IP, not a proprietary cartridge slot.",
        "id": "lhc.loading.exp.fabric-care-dispensing-systems",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Delicate bags / drum accessories",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Smart machines obsolete manual aids",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (Connected Appliances) eliminate the need for manual protection aids. Smart machines now have fabric-detection sensors and cycle-selection algorithms that automatically reduce agitation for delicate items, obviating the need for garment bags, drum liners, or protective capsules. The category is being automated away.\\n\\n**2. Strategic Evaluation.** Connected appliances automate fabric protection through detection and gentler cycles, draining the manual delicates-accessory pool toward the machine itself. The honest move is to harvest these low-margin mechanical aids and redeploy toward chemical optimisation — Vernel and Persil enzyme balance tuned for delicate cycles — where HCB has a real right-to-win the OEM does not. The structural value is shifting from mechanical protection to fabric-care chemistry; HCB should follow the pool there rather than defend accessories that smart machines render unnecessary.",
        "id": "lhc.loading.con.delicate-bags-drum-accessories",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Manual dosing aids / scoops",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Auto-dosing displaces manual measuring",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (Auto-dosing) is rendering the measuring scoop obsolete. Connected washers auto-dispense detergent based on load, soil level, and water hardness; older machines are being retrofitted with auto-dispensers or smart cartridges. The scoops and measuring cups that filled billions of laundry rooms are now waste.\\n\\n**2. Strategic Evaluation.** Auto-dosing and cartridge formats render the measuring scoop obsolete, so this pool structurally disappears into the dosing system. The clean move is to retire scoops in an orderly way and redeploy toward concentrate, refill and auto-dosing formats where Persil and Vernel chemistry and HCB's concentrate leadership compound. There is no pool to defend in the scoop itself; the durable value is owning the precise-dosing relationship — the actives the machine meters — which is exactly where HCB's formulation strength sits.",
        "id": "lhc.loading.con.manual-dosing-aids-scoops",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Fabric softening balls (low-tech)",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated formats eliminate need",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (Concentrated Formats) eliminates the softening ball. Ultra-concentrated Vernel liquid or capsules deliver the same softening efficacy at a fraction of the dose; they dissolve completely without leaving residue on fabrics or inside machines. Low-tech balls are now a cost centre without a functional advantage.\\n\\n**2. Strategic Evaluation.** Concentrated formats eliminate the low-tech softening ball — concentrated Vernel liquid and capsules deliver equal softening with no residue — so this pool drains into superior formats, not a competitor. The honest move is to harvest the ball line cleanly and consolidate behind Vernel's concentrated and Discs formats, where its fabric and scent technology is the real asset. This is a format transition to manage, not a battle to fight; HCB should move softening value into the concentrate architecture where its capability leads.",
        "id": "lhc.loading.con.fabric-softening-balls-low-tech",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Generic load guides (printed)",
        "type": "product",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 AI Personalization replaces static guides",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 (AI Personalization) replaces static printed load guides with dynamic app-based dosing. Instead of \"full load = 50ml\", the Smartwash app calculates optimal dose based on soil level, water hardness, machine type, and selected cycle. Printed guides become outdated before they ship; digital is faster, more accurate, and personalizable.\\n\\n**2. Strategic Evaluation.** AI personalization replaces static printed dosing guides with dynamic, condition-aware recommendation, making printed guidance a small declining cost centre that can even contradict the better digital answer. The honest move is to retire it in an orderly way and redeploy the freed effort into the dosing-and-recommendation layer where Persil and Vernel chemistry is the durable asset. There is no pool to defend in the printed guide; the structural value is owning the precise, trusted dosing prescription the consumer now follows digitally.",
        "id": "lhc.loading.con.generic-load-guides-printed",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "add_products",
    "label": "Add Products",
    "benefiting": [
      {
        "name": "Concentrated / ultra-compact detergents",
        "type": "product",
        "trendCodes": [
          "T-03",
          "G-04"
        ],
        "driverNote": "T-03 Concentrated Formats (core innovation) + G-04 PPWR",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Concentrated detergents compress the wash payload into smaller volumes, reducing transport logistics by 40-60% and cutting plastic per wash (T-03). PPWR mandates 30% recycled content and refill accessibility by 2030 (G-04), making dilute formats economically indefensible — the profit pool migrates to whoever owns the concentrated-format shelf position first, locking out competitors by format choice at the retail set.\\n\\n**2. Strategic Evaluation.** Concentration is where the laundry pool consolidates this decade: packaging-waste regulation makes dilute formats structurally disadvantaged, and the brand that defines the compact standard sets the reference others answer to. Henkel's right-to-win is genuine format leadership through Persil's concentrate and Discs heritage and the enzyme efficacy that lets a smaller dose still out-clean. The bet is to keep extending dose-density as a proprietary moat, with value tiers carried along so trade-down stays inside the portfolio.",
        "id": "lhc.add_products.exp.concentrated-ultra-compact-detergents",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Detergent sheets & pods (eco-formats)",
        "type": "product",
        "trendCodes": [
          "T-03",
          "G-04",
          "E-02"
        ],
        "driverNote": "T-03 Solid Formats + G-04 PPWR + E-02 Water scarcity",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Sheet and solid-pod formats (Earth Breeze, Tru Earth, Blueland archetype) eliminate water weight entirely, cutting landed cost 50-70% versus liquid, while addressing E-02 water-scarcity pressure and G-04 packaging mandates with zero plastic. Category growing 15%+ CAGR; the pool sits in whoever commands the plastic-free shelf position and owns the sustainability narrative before PL sheets scale (now <3% but ramping fast).\\n\\n**2. Strategic Evaluation.** Sheets and solid pods convert water-scarcity and packaging pressure into a plastic-free claim space that indie brands seeded but cannot defend on performance, since perceived under-cleaning still caps mainstream conversion. Henkel's edge is enzyme and surfactant science applied to the low-water matrix, not the format novelty. The long-term bet is a credible Persil-grade solid that out-credentials DTC players on results, held ready to scale as the format crosses into the mainstream rather than launched prematurely into a niche.",
        "id": "lhc.add_products.exp.detergent-sheets-and-pods-eco-formats",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Refill systems & eco-subscriptions",
        "type": "service",
        "trendCodes": [
          "G-04",
          "C-04"
        ],
        "driverNote": "G-04 PPWR Packaging Waste Regulation + C-04 Conscious",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-04 PPWR mandates reusable container systems and refill-at-point accessibility by 2030; C-04 Conscious Consumption drives 12%+ CAGR in refill adoption in Northern Europe. The profit pool is not just product — it is recurring subscription revenue, customer lock-in, and retailer shelf ownership through exclusive refill cartridge partnerships.\\n\\n**2. Strategic Evaluation.** Refill is where packaging regulation reshapes the format, but the durable prize is the concentrate and dosing chemistry that travels through any refill vessel, not a subscription wrapper or an exclusive station deal. Henkel's right-to-win is Persil and Vernel concentrate technology engineered for low-packaging delivery. The bet is to own the refillable formulation standard and stay format-flexible across whatever in-store and at-home reuse systems retailers and regulation eventually settle on.",
        "id": "lhc.add_products.exp.refill-systems-and-eco-subscriptions",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Bio-enzymatic booster packs",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + T-01 enzyme optimization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 bio-based chemistry and T-01 AI-optimized enzyme cocktails are displacing chemical whiteners and synthetic surfactants, expanding the premium detergent pool by 8-12% CAGR. The win goes to the brand that ships a clinically-proven, non-synthetic stain engine first — cost of entry is lab time, not scale.\\n\\n**2. Strategic Evaluation.** AI-optimised enzyme design and bio-based chemistry expand the premium pre-treat pool around a verifiable, non-synthetic stain engine that private label cannot easily replicate. This plays to Henkel's core strength: enzyme and stain R&D, with Sil's stain heritage as a credible house for it. The competitive set includes Reckitt's retained, well-resourced Vanish, so the claim must be genuinely superior, not merely greener. The long-term move is to compound that advantage into a defendable pre-treat platform anchored on demonstrated efficacy.",
        "id": "lhc.add_products.exp.bio-enzymatic-booster-packs",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Premium fragrance bead boosters",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization Hair Care extends to home care",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Laundry scent boosters (Lenor Unstoppables archetype) sit at the intersection of C-03 premiumization (consumers now pay a clear price premium) and C-28 (a multi-billion EU market, 18% CAGR forecast to more than double by 2030). Profit migrates to whoever owns the premium fragrance narrative and controls scent-perception proprietary chemistry before the category commoditizes on Amazon.\\n\\n**2. Strategic Evaluation.** Scent boosters have graduated into a structurally premium add-on at the wash moment, and the pool keeps growing as long as proprietary scent-perception chemistry resists commoditisation. The segment is dominated by an intensity-led incumbent archetype, so undifferentiated entry loses. Henkel's right-to-win is Vernel's scent and fabric technology, repositioned on conscious-freshness and encapsulation performance rather than raw intensity. The bet is to own a distinctive, sustainability-credible signature and merchandise the attach decision beside the detergent.",
        "id": "lhc.add_products.exp.premium-fragrance-bead-boosters",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Plant-based washing pod tablets",
        "type": "product",
        "trendCodes": [
          "T-02",
          "G-05"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + G-05 Green Claims",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 bio-based surfactants and G-05 Green Claims Directive (requiring substantiation) reward brands that ship genuinely plant-derived formulations with clinical proof — not just messaging. The pool is the premium eco segment, where consumers pay 15-25% premium for verifiable bio-chemistry and transparent sourcing.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement turns genuinely plant-derived chemistry from a marketing line into a defensible asset, rewarding brands that can substantiate sourcing and efficacy where rivals can only message. The pool is the premium eco tier, and the moat is proof, not packaging. Henkel's right-to-win is bio-based surfactant and enzyme capability plus the regulatory and certification scale to stand behind the claim. The bet is a substantiated plant-based platform in compact formats, letting verifiability become the durable point of difference.",
        "id": "lhc.add_products.exp.plant-based-washing-pod-tablets",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Modular detergent mix-your-own systems",
        "type": "product",
        "trendCodes": [
          "T-07",
          "T-03"
        ],
        "driverNote": "T-07 AI Personalization + T-03 Concentrated Formats",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 AI personalization and T-03 concentrated formats enable consumers to assemble custom formulations on-demand — selecting enzyme strength, fragrance intensity, and water hardness compensation from modular building blocks. Pool is niche (a small EU segment today) but growing 20%+ CAGR among premium digital natives who value customization and believe mass formulations are suboptimal.\\n\\n**2. Strategic Evaluation.** Personalised, mix-your-own formulation is a genuine but niche frontier for digitally native premium shoppers, and the honest read is that the pool stays small and the right move is to learn rather than over-build bespoke infrastructure. Henkel's relevant asset is formulation depth, hardness and enzyme know-how, that could feed modular components if the model proves out. The bet is a contained capability probe, with the option to fold any validated customisation back into the mainstream Persil range.",
        "id": "lhc.add_products.exp.modular-detergent-mix-your-own-systems",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Subscription laundry boxes (recurring)",
        "type": "service",
        "trendCodes": [
          "K-06"
        ],
        "driverNote": "K-06 Subscription Lock-in trend + convenience",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-06 subscription lock-in and convenience drive D2C recurring-revenue adoption; consumers on auto-replenishment spend 30-40% more over 12 months versus one-time buyers, and churn drops 60% once a second purchase completes. Pool is lifetime value per consumer, not per-transaction margin.\\n\\n**2. Strategic Evaluation.** Replenishment subscriptions shift value toward lifetime household relationships, but a branded box is a thin, low-pool play that creates little defensibility on its own. The deeper lesson is that the winning asset is being the repeat-default formulation, not operating a logistics service. Henkel's edge remains product superiority and the Persil-Vernel-Sil cross-sell, which can ride any recurring channel. The bet is to make the brand the one consumers and platforms keep re-ordering, letting owned and third-party surfaces compete to carry it.",
        "id": "lhc.add_products.exp.subscription-laundry-boxes-recurring",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Discount-exclusive branded value formats",
        "type": "product",
        "trendCodes": [
          "K-01"
        ],
        "driverNote": "K-01 Discount Retail Channel Expansion at 25-35% share",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-01 discount retailers (Aldi/Lidl at 25-35% grocery share) are now sophisticated enough to negotiate exclusive SKU formats (smaller pack sizes, unique fragrance variants, regional-only formulations) from suppliers, creating a structural moat around their own-brand detergent. The pool here is volume at razor-thin margin — but it is volume that otherwise goes to PL.\\n\\n**2. Strategic Evaluation.** Discounters now have the scale to commission exclusive branded formats, turning the value tier into a contestable pool that would otherwise default entirely to own-brand. The strategic point is reach and shelf presence, not margin, holding ground that protects the premium architecture above it. Henkel's right-to-win is established value-tier equity such as Weisser Riese and Spee deployed as deliberate own-brand shields. The bet is to keep a branded anchor in the discount set, preserving mental and physical availability where buyers first meet the category.",
        "id": "lhc.add_products.exp.discount-exclusive-branded-value-formats",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart auto-dosing detergent cartridges",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances auto-dosing (Henkel Smartwash)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 connected appliances create a replenishment-lock-in moment: once a household adopts Henkel's machine-agnostic AI auto-dosing system (as Henkel Smartwash does, working across washing machines rather than tied to any one OEM), that household becomes a recurring-revenue Persil dispenser for years. Pool is not just the detergent SKU — it is the installed dosing base and the habit moat that makes it harder for competitors to reach that consumer.\\n\\n**2. Strategic Evaluation.** Connected dosing reframes detergent as a chemistry-and-data service: Smartwash is a machine-agnostic AI cartridge-dosing platform that optimises dose across any washer, so the durable pool is precision-dosing performance and the data around it, not any appliance tie. The asset is Henkel's formulation and dosing intelligence, which travels independent of any single OEM. The bet is to own the cross-machine dosing standard, where the consumer benefit is right-dose efficacy and waste reduction, keeping the platform open rather than betting on one manufacturer.",
        "id": "lhc.add_products.exp.smart-auto-dosing-detergent-cartridges",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Hispanic-household laundry formats (US growth segment)",
        "type": "product",
        "trendCodes": [
          "C-18"
        ],
        "driverNote": "C-18 Hispanic household growth — larger households, scent-forward preferences, value-premium mix",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-18 on the LHC side: Hispanic households are larger, wash more frequently, and over-index on scent-forward and value-premium laundry products — a structurally growing demand pool that Persil, all and Purex serve today without targeting. The pool expands fastest in scent boosters and fabric conditioner, linking to C-28.\n\n**2. Strategic Evaluation.** Larger, higher-frequency, scent-forward Hispanic households are a structurally expanding US demand pool that today's range serves without deliberately targeting, with growth concentrated in scent boosters and fabric conditioner. This is range, format and availability work, best read through mental and physical availability rather than national share. Henkel's right-to-win is Persil's efficacy story combined with Vernel-derived scent technology against an entrenched incumbent. The bet is to build distinctive presence here as a compounding demographic tailwind for the US portfolio.",
        "id": "lhc.add_products.exp.hispanic-household-laundry-formats-us-growth-seg",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Detergent sheets & ultra-light strips (Earth Breeze / Tru Earth model)",
        "type": "product",
        "trendCodes": [
          "C-22"
        ],
        "driverNote": "C-22 laundry sheet/strip disruption — plastic-free positioning, DTC-led",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-22: detergent sheets (Earth Breeze, Tru Earth, Blueland) convert plastic-free positioning and shipping economics into a wedge format — small absolute pool today, but the format owns the 'zero-plastic laundry' claim and recruits eco-switchers from liquids. The DB scores this cautiously (gp1 6%, prob 3): efficacy perception and cost-per-wash still cap mainstream conversion.\n\n**2. Strategic Evaluation.** Sheets and strips own the zero-plastic claim and recruit eco-switchers, but the absolute pool stays modest while efficacy perception and cost-per-wash cap mainstream conversion. This is a fast-follow option, not an urgent build, and the honest stance is readiness rather than pre-emptive cannibalisation of the concentrate franchise. Henkel's edge is that a Persil-grade sheet would instantly out-credential DTC players on cleaning credibility. The bet is to hold a validated formulation and trigger on genuine category-share signals, with performance as the differentiator.",
        "id": "lhc.add_products.exp.detergent-sheets-and-ultra-light-strips-earth-br",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Auto-dish tabs for first-time dishwasher households (EM conversion)",
        "type": "product",
        "trendCodes": [
          "C-27"
        ],
        "driverNote": "C-27 HDW→ADW conversion — dishwasher penetration India 4% / China 12% vs Germany 71%; dish-category analogue mapped here pending a dish journey",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-27: dishwasher penetration in India (4%), China (12%) and Brazil (9%) versus Germany's 71% defines a decade-long conversion runway — every converting household switches from hand-dish liquid to auto-dish tabs, a 3-4x value-per-occasion upgrade. Somat's pool expands with machine penetration, not market share. (Mapped into the laundry journey's product-choice stage as the nearest consumer moment; a dedicated dish journey would house it properly.)\n\n**2. Strategic Evaluation.** Low dishwasher penetration in large emerging markets defines a long conversion runway, where each converting household upgrades from hand-dish to higher-value auto-dish tabs, expanding Somat's pool with machine adoption rather than share. The decisive moment is the first tab chosen at machine purchase, which tends to persist. Reckitt's retained Finish owns this playbook today. Henkel's right-to-win is Somat's auto-dish credibility; the bet is to win the first-tab moment through machine-attach presence and entry formats as penetration compounds.",
        "id": "lhc.add_products.exp.auto-dish-tabs-for-first-time-dishwasher-househo",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "In-wash scent boosters as routine add-on (Unstoppables archetype)",
        "type": "product",
        "trendCodes": [
          "C-28"
        ],
        "driverNote": "C-28 scent boosters graduated to structural premium LAD segment",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-28: scent boosters have graduated from novelty to structural premium segment — an add-on purchase at the detergent moment that expands basket value without cannibalising the base SKU. P&G's Lenor Unstoppables created and still owns the segment archetype; the DB split this trend out from generic premiumisation in v3.3 because the pool is now independently material (gp1 8%).\n\n**2. Strategic Evaluation.** In-wash scent boosters have become a structural premium add-on that lifts basket value at the detergent moment without cannibalising the base SKU, which is why the pool now stands on its own. The segment is defined by an established intensity-led archetype, so the path is differentiation, not imitation. Henkel's right-to-win is Vernel's scent-technology credibility, positioned on conscious, bio-based freshness and merchandised at the detergent shelf where the attach happens. The bet is to own a distinctive freshness signature rather than competing on potency.",
        "id": "lhc.add_products.exp.in-wash-scent-boosters-as-routine-add-on-unstopp",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Specialist delicates & performance-fabric detergents (Perwoll occasion)",
        "type": "product",
        "trendCodes": [
          "C-29"
        ],
        "driverNote": "C-29 technical-fabric wardrobes (35%+ of EU wardrobe) revive the delicates wash occasion",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-29: athleisure, merino and performance synthetics now make up 35%+ of the average European wardrobe, reviving a dedicated delicates/performance wash occasion that generic detergents serve badly (odour retention in synthetics, fibre damage in technical knits). The DB named this 'the Perwoll occasion' — Henkel owns the reference brand for it.\n\n**2. Strategic Evaluation.** Wardrobes shifting toward athleisure, merino and technical synthetics revive a dedicated delicates and performance-wash occasion that generic detergents serve badly, reopening a pool Henkel is uniquely placed to own. Perwoll is the reference brand for this need, making the move a platform play rather than a defensive niche, with garment-longevity pressure turning apparel brands into natural co-marketers. The bet is to extend Perwoll into performance and odour-technology territory and occupy that claim space before a mass rival builds a credible sub-line.",
        "id": "lhc.add_products.exp.specialist-delicates-and-performance-fabric-dete",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "AI shopping agents & auto-replenishment subscriptions",
        "type": "tech",
        "trendCodes": [
          "T-11"
        ],
        "driverNote": "T-11 agentic commerce — $190-385B of US e-commerce via agents by 2030 (Morgan Stanley)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-11: Morgan Stanley sizes AI shopping agents at a very large share of US e-commerce by 2030. Replenishment categories go first — detergent is the canonical agent purchase (low consideration, predictable cadence, spec-comparable). The agent layer is a new product type at the Add Products moment: it is what the consumer now 'uses' to buy. The trend itself remains the model's largest distribution threat — its margin and private-label consequences sit on the declining side of this stage; what benefits here is the agent layer itself.\\n\\n**2. Strategic Evaluation.** Agentic commerce makes replenishment categories like detergent an early target, and the agent layer itself becomes the new purchase surface even as it pressures margin and favours own-brand on the declining side. The benefiting move is to be the default the agent inherits. Henkel's right-to-win is machine-readable product data on efficacy, sustainability and price-per-wash, reliable availability, and brand salience strong enough that a human overrides toward Persil. The bet is to build agent-legible superiority and off-platform salience now, before the channel concentrates.",
        "id": "lhc.add_products.exp.ai-shopping-agents-and-auto-replenishment-subscr",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Bio-manufactured surfactant & fragrance formulations",
        "type": "product",
        "trendCodes": [
          "T-15",
          "T-16"
        ],
        "driverNote": "T-15 precision fermentation ($36B by 2030) + T-16 synthetic-biology surfactants/fragrances",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-15 + T-16 (grouped — collinear bio-manufacturing vectors): precision fermentation (a multi-billion pool by 2030, 40%+ CAGR) and synthetic-biology ingredient design produce bio-identical surfactants and aroma molecules without agricultural supply chains. Consumer-visible as a new claims class — 'brewed, not drilled' — and structurally as price-stable, low-carbon, EUDR-immune inputs (counters E-03/E-11/G-11 cost loads).\\n\\n**2. Strategic Evaluation.** Precision fermentation and synthetic biology let surfactants and aroma molecules be made without agricultural supply chains, creating a brewed-not-drilled claims class and a lower-carbon, deforestation-immune input base. The decisive asset is offtake and capacity position secured before rivals lock scarce supply, where Henkel's R&D, sourcing and regulatory scale are real advantages. The bet is to build an early bio-manufacturing supply position for hero ingredients and make palm-free chemistry a durable cost and claim moat, releasing claims only once supply scales.",
        "id": "lhc.add_products.exp.bio-manufactured-surfactant-and-fragrance-formul",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Film-free unit-dose alternatives (coated tablets, moulded concentrates)",
        "type": "product",
        "trendCodes": [
          "G-14",
          "T-03"
        ],
        "driverNote": "G-14 PVA challenge + T-03 concentrated formats — the post-film unit-dose play",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-14 expansion side: if biodegradability standards turn against PVA film, film-free unit-dose formats (coated tablets, compressed and moulded concentrates, water-jacket capsules) inherit the convenience pool that pods built. First credible mover converts a regulatory shock into format leadership — the same dynamic that built the pod category now runs in reverse.\n\n**2. Strategic Evaluation.** If biodegradability standards turn against unit-dose film, the convenience pool the pod category built migrates intact to film-free formats such as coated tablets and moulded concentrates, and the first credible mover converts a regulatory shock into format leadership. Henkel's right-to-win is its concentrate and tablet formulation depth, the same chemistry that also feeds sheet and strip optionality. The bet is to hold a film-free Discs successor at launch readiness and trigger on the regulatory signal, since the post-film claim space is won early, not after.",
        "id": "lhc.add_products.exp.film-free-unit-dose-alternatives-coated-tablets-",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Traditional bulk powder detergent",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats displace dilute powders",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 concentrated formats collapse the economic case for dilute powder: weight-for-weight, concentrated liquid and sheets deliver 3-5x more wash payload per liter transported, cutting landed cost 50%+ and enabling superior shelf appeal. Pool contracts 8-12% annually as inventory converts to concentrated; holding bulk powder is inventory obsolescence risk.\\n\\n**2. Strategic Evaluation.** Concentration steadily erodes the economic case for dilute bulk powder, so this pool contracts and holding it mainly carries obsolescence risk. The right read is harvest-and-redeploy, not defence: capture the converting consumer on the compact shelf before they default to own-brand concentrate. Henkel's relevant asset is its concentrate and value-tier equity, which can absorb the migrating powder buyer within the portfolio. The bet is to release shelf and complexity from dilute powder deliberately and reinvest behind compact formats, keeping trade-down inside Henkel.",
        "id": "lhc.add_products.con.traditional-bulk-powder-detergent",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Conventional large liquid bottles",
        "type": "product",
        "trendCodes": [
          "T-03",
          "G-04"
        ],
        "driverNote": "T-03 Concentrated Formats + G-04 PPWR (packaging)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-04 PPWR mandates 30% recycled content and 8% weight reduction by 2030, making 2-3L plastic bottles economically indefensible (recycled plastic is 40% more expensive than virgin). T-03 concentration makes volume per dose irrelevant. Pool contracts 10-15% annually as shelf converts to pods, sheets, and cartridges. Standard 2L bottles are dead weight.\\n\\n**2. Strategic Evaluation.** Packaging-waste regulation and the rise of compact formats make large plastic bottles a declining, increasingly costly pool, and the value is captured by migrating the consumer to higher-margin compact alternatives rather than defending bottle shelf. Henkel's asset is the Discs and concentrate franchise that the bottle volume should feed. The bet is a managed harvest: prune large-bottle complexity where compact alternatives are established, redeploy freed shelf and supply capacity to compact and refill formats, and treat the discontinuation as deliberate portfolio simplification.",
        "id": "lhc.add_products.con.conventional-large-liquid-bottles",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Chlorine-based whiteners / bleach",
        "type": "product",
        "trendCodes": [
          "G-01",
          "G-02"
        ],
        "driverNote": "G-01 PFAS + G-02 Microplastics regulatoin",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-01 PFAS restriction and G-02 microplastics ban Phase 2 reclassify chlorine-based pre-treaters and optical brighteners as compliance liabilities. Reformulation is table stakes; the pool does not migrate to a substitute SKU — it splits between whoever has the bio-enzymatic stand-in ready at the listing moment and retailers who delist the category entirely.\\n\\n**2. Strategic Evaluation.** PFAS and microplastics restrictions reclassify chlorine pre-treaters and optical brighteners as compliance liabilities, and the pool does not migrate cleanly to a substitute; it splits between whoever has the bio-enzymatic stand-in ready at listing and retailers who simply delist. This is a defend-and-redeploy moment where readiness wins shelf. Henkel's right-to-win is its enzyme and stain capability, with Sil as a credible substitute house, against Reckitt's retained Vanish. The bet is to have a compliant alternative listed as the category resets, converting the shock into own-brand defence.",
        "id": "lhc.add_products.con.chlorine-based-whiteners-bleach",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Separate water softening salts",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Integrated water treatment in machines",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 integrated water-treatment systems built into connected washers (Miele TwinDos, Bosch HomeConnect) eliminate the need for separate water-softening salts; machine automatically adjusts hardness compensation. Pool contracts as machine base shifts to integrated treatment. Separate salt sales decline 5-8% annually.\\n\\n**2. Strategic Evaluation.** Integrated water-treatment built into modern machines erodes the standalone softening-salt occasion, and with a minimal franchise here Henkel should let this niche contract rather than defend it. The smarter redeployment is to absorb hardness compensation into the detergent and dosing layer itself, where Henkel's formulation strength applies. The bet is to build hardness-adaptive performance into Persil chemistry and into machine-agnostic connected dosing such as Smartwash, delivering the softening benefit inside the wash rather than chasing a shrinking adjacent SKU.",
        "id": "lhc.add_products.con.separate-water-softening-salts",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Synthetic optical brighteners",
        "type": "product",
        "trendCodes": [
          "G-05"
        ],
        "driverNote": "G-05 Green Claims Directive (microplastic brighteners banned)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-05 Green Claims Directive requires scientific substantiation for brightness claims, and optical brighteners (fluorescent compounds that absorb UV and re-emit visible light) are increasingly classified as microplastic shedders. Pool contracts as regulations tighten and retailers delist synthetic brighteners in favor of enzymatic brightening. Profit goes to whoever has a non-synthetic alternative ready.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement and microplastic-shedding scrutiny turn synthetic optical brighteners into a contracting, increasingly delistable pool, and the profit moves to whoever has a substantiated non-synthetic brightening route ready. Henkel's right-to-win is enzyme-based brightening science that delivers visible whiteness without fluorescent compounds. The bet is to lead the reformulation rather than react to it: convert Persil's brightening to a defensible enzymatic, compliant basis and let verifiable, naturally derived performance become the differentiator that own-brand and slower rivals struggle to match.",
        "id": "lhc.add_products.con.synthetic-optical-brighteners",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Anti-greying chemical additives",
        "type": "product",
        "trendCodes": [
          "G-03"
        ],
        "driverNote": "G-03 Cosmetics Regulation VII/VIII extends to additives",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-03 Cosmetics Regulation extends to laundry additives that make color-preservation claims; anti-greying chemistry now requires the same safety dossier as a cosmetic. Reformulation cost rises 30-50%; pool contracts as brands defer innovation to more profitable categories. The entrants are brands willing to invest in dossier work.\\n\\n**2. Strategic Evaluation.** Extending cosmetic-grade safety dossiers to colour-care additives raises the compliance bar and contracts the pool as weaker players defer the chemistry, which paradoxically advantages whoever funds the dossier work. Henkel's right-to-win is colour-care formulation depth plus the regulatory scale to carry the safety burden smaller rivals cannot. The bet is to treat tightening regulation as a barrier-to-entry, investing in a compliant, dye-preserving colour-protection platform that consolidates the premium occasion as less-resourced competitors and own-brand retreat from the added substantiation cost.",
        "id": "lhc.add_products.con.anti-greying-chemical-additives",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "DIY home-made detergent kits",
        "type": "product",
        "trendCodes": [
          "C-06",
          "C-25"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze + C-25 Household atomisation pressures mass-pack economics",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-06 cost-of-living squeeze and C-25 household atomization (smaller households have less incentive to bulk-produce) compress the DIY detergent addressable market. Niche stays niche — the economics don't work for households making <20 washes per month. Pool is negligible and declining.\\n\\n**2. Strategic Evaluation.** Cost-of-living pressure and shrinking household sizes keep DIY detergent a marginal niche whose per-wash economics rarely beat branded value tiers, so this is a non-threat warranting no strategic response. Henkel's value-tier equity already undercuts home-made on a per-wash basis once convenience and efficacy are counted. The honest read is to let the segment self-limit and direct no investment toward it. The only long-term relevance is keeping value-tier price-per-wash and ease-of-use visibly compelling, which removes the rationale for DIY entirely.",
        "id": "lhc.add_products.con.diy-home-made-detergent-kits",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Branded detergents losing share to premium PL",
        "type": "product",
        "trendCodes": [
          "C-01",
          "X-13"
        ],
        "driverNote": "C-01 Private Label 42% EU6 + X-13 Retailer vertical integration deepens PL moat",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-01 private label at 42% EU6 value share (Circana's highest recording) is not a value play — PL has graduated to premium tiers. X-13 vertical integration (Walmart, Carrefour, Lidl operating contract manufacturing) means PL detergent now offers equivalent efficacy to mid-tier brands at 30-40% lower price. Branded share contracts 3-5% annually as conversion accelerates.\\n\\n**2. Strategic Evaluation.** Premium private label, deepened by retailer vertical integration, is a structural headwind that erodes mid-tier branded share at near-parity efficacy. The right read is portfolio concentration, not a price war the brand cannot win: harvest mid-tier equities as own-brand shields and redeploy trade and innovation behind defensible territory. Henkel's right-to-win sits in Persil premium, where superiority still commands a real premium, and Vernel fabric care, where own-brand has little foothold. The bet is a deliberate exit from the contested middle into demonstrable superiority.",
        "id": "lhc.add_products.con.branded-detergents-losing-share-to-premium-pl",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Mid-tier detergent range (squeezed middle)",
        "type": "product",
        "trendCodes": [
          "C-06",
          "C-01"
        ],
        "driverNote": "C-06 Cost-of-Living trading down + C-01 PL penetration",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-06 cost-of-living pressure pushes consumers down to value/PL, while Persil premium captures affluent shoppers willing to pay for science — the mid-price tier is being eaten from both ends. The mid is no longer a defensible price position; it is the funding line that retailers raid for PL listings and the only buyer is the shopper who has already left.\\n\\n**2. Strategic Evaluation.** The mid-price tier is squeezed from both ends as cost-pressed shoppers trade down and science-led premium captures affluent ones, leaving the middle as a funding line retailers raid for own-brand listings. The right read is harvest, not defence, and the structural winner is the brand that exits cleanly first rather than prolonging the decline with margin cuts. Henkel's assets are Persil premium for reinvestment and its value tiers as deliberate own-brand shields. The bet is to pull complexity from the middle and concentrate the freed envelope where margin exists.",
        "id": "lhc.add_products.con.mid-tier-detergent-range-squeezed-middle",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Import-dependent raw material formulations",
        "type": "product",
        "trendCodes": [
          "G-08",
          "E-01"
        ],
        "driverNote": "G-08 Tariffs & Trade Wars + E-01 Palm Oil Disruption",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-08 tariffs (US escalation, EU retaliatory measures) and E-01 palm-oil supply disruption (Indonesia B50 diverts oleochemical feedstock to fuel, 20-40% price spikes on oleochemicals) hit imported-input formulations hardest. Brands locked into Asian enzyme sourcing and palm-derived surfactants face 8-15% COGS inflation within 12 months. Pool contracts as brands either reformulate (costly) or accept margin compression.\\n\\n**2. Strategic Evaluation.** Tariff escalation and palm-oil feedstock disruption load cost onto import-dependent formulations, pressuring the pool for whoever is locked into distant enzyme and palm-derived surfactant sourcing. The defensible response is supply resilience treated as margin strategy, not reporting overhead. Henkel's right-to-win is its sourcing and R&D scale, including a credible path into bio-manufactured surfactants that sidesteps palm and long supply chains. The bet is to progressively regionalise critical inputs and build fermentation-derived substitution capacity, converting input-cost exposure into a structural sourcing advantage.",
        "id": "lhc.add_products.con.import-dependent-raw-material-formulations",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Mid-tier branded SKUs under retailer range rationalisation",
        "type": "product",
        "trendCodes": [
          "K-03"
        ],
        "driverNote": "K-03 Retailer consolidation — Schwarz/Aldi/Edeka/Rewe concentration cuts branded assortment",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-03: Schwarz Group, Aldi and Edeka/Rewe together control an estimated 40-50% of European grocery volume relevant to Henkel, and consolidation is accelerating range rationalisation — fewer branded SKUs per category, more shelf handed to own-brand. The squeezed slice is the mid-tier: brands strong enough to pay for listing but too weak to be non-negotiable.\n\n**2. Strategic Evaluation.** Retailer consolidation accelerates range rationalisation, and the most exposed slice is mid-tier and second-line SKUs strong enough to pay for listing but not strong enough to be non-negotiable. The right read is portfolio concentration: anchor on must-stock leaders and innovation SKUs with proven rotation, and earn category-captain standing where Henkel holds data leadership. Henkel's right-to-win is Persil's defensible leading positions plus its category and shopper data. The bet is to treat every tail SKU as a listing at risk and consolidate before the retailer makes the cut.",
        "id": "lhc.add_products.con.mid-tier-branded-skus-under-retailer-range-ratio",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Input-cost & compliance pass-through on branded price ladders",
        "type": "product",
        "trendCodes": [
          "E-03",
          "E-06",
          "E-09",
          "E-11"
        ],
        "driverNote": "E-03 CBAM/Scope-3 + E-06 nearshoring + E-09 climate adaptation + E-11 Scope-3+ decarbonisation — converging cost stack",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Four converging cost trends (CBAM/Scope-3 reporting, supply-chain nearshoring, climate adaptation of European plants, downstream decarbonisation mandates) load structural cost onto formulated products. None is consumer-facing alone; together they widen the branded-vs-PL price gap at shelf — the consumer experiences them as price ladder inflation. Grouped into one tile deliberately: these are collinear cost vectors, not four separate consumer moments.\n\n**2. Strategic Evaluation.** Converging carbon, nearshoring, climate-adaptation and downstream decarbonisation costs load structural expense onto formulated products and widen the branded-versus-own-brand price gap at shelf, though none is consumer-facing alone. The battle is won upstream, where low-carbon sourcing and regionalised supply become margin defence. Henkel's right-to-win is its sourcing scale and the bio-manufacturing path to lower-carbon inputs. The bet is to attack the cost stack at source and, where pass-through is unavoidable, take it through pack architecture rather than sticker price, which is what closes the own-brand gap fastest.",
        "id": "lhc.add_products.con.input-cost-and-compliance-pass-through-on-brande",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Hard-to-recycle trigger sprays & multi-material packs (EPR fee loading)",
        "type": "product",
        "trendCodes": [
          "E-04"
        ],
        "driverNote": "E-04 EPR eco-modulation penalises trigger sprays and multi-material packaging",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-04: EPR eco-modulation is expanding across EU member states, and fee schedules specifically penalise multi-material formats — trigger sprays (Bref, WC Frisch archetypes) carry the highest per-unit fee loading. The cost is invisible to consumers until it surfaces as price or format change; the profit pool shifts toward mono-material and refill formats.\n\n**2. Strategic Evaluation.** Expanding eco-modulated packaging fees penalise multi-material formats such as trigger sprays most heavily, shifting the pool toward mono-material and refill designs while the cost stays invisible until it surfaces as price. Whoever converts first earns a compounding per-unit advantage across the spray portfolio, effectively a regulatory subsidy for early movers. Henkel's right-to-win is packaging-engineering and reformulation capability at scale across its spray range. The bet is to lead mono-material and refill conversion ahead of fee escalation, turning compliance into a structural cost edge.",
        "id": "lhc.add_products.con.hard-to-recycle-trigger-sprays-and-multi-materia",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Retail-media-gated shelf & search placement (pay-to-play discovery)",
        "type": "service",
        "trendCodes": [
          "K-08"
        ],
        "driverNote": "K-08 US retail media $69B by 2026 — Amazon/Walmart capture 89% of incremental margin",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-08: US retail media reaches a multi-billion scale in 2026 with Amazon and Walmart capturing ~89% of incremental spend — brand discovery at the digital shelf is now an auction, and the auctioneer is the retailer. The detergent aisle's first page is sold, not earned; trade economics shift from margin negotiation to media buying, with the DB scoring this the single largest customer-force pool transfer (gp1 20%, prob 5).\\n\\n**2. Strategic Evaluation.** Retail media turns the digital shelf into an auction run by the retailer, a major customer-side pool transfer where discovery is bought rather than earned and trade economics shift from margin to media buying. The disciplined read is to treat retail media as a P&L line with return discipline, concentrating spend on defensible brand and top-category terms and starving the long tail. Henkel's structural answer is owned mental availability built off-platform, the only real discount on on-platform auctions. The bet is salience strong enough that buyers and agents seek Persil by name.",
        "id": "lhc.add_products.con.retail-media-gated-shelf-and-search-placement-pa",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Retailer-agent baskets defaulting to PL & margin-optimised SKUs",
        "type": "tech",
        "trendCodes": [
          "K-09"
        ],
        "driverNote": "K-09 agentic commerce shifts retailer-brand power — agent defaults favour retailer economics",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-09: when retailer-owned shopping agents assemble the weekly basket, the default detergent is whatever optimises the retailer's economics — private label or the brand paying for agent placement. The shelf fight becomes an algorithm fight, and the algorithm's owner is also a competitor (via PL). This is the retailer-side mirror of T-11's consumer-agent disruption.\n\n**2. Strategic Evaluation.** When retailer-owned agents assemble the basket, the default detergent becomes whatever serves the retailer's economics, usually private label, so the shelf fight becomes an algorithm fight whose owner is also a competitor. The defensive read mirrors planogram captaincy: secure named-brand default status early and contractually, with the data sharing that makes it stick. Henkel's right-to-win is leading brand strength plus machine-readable product data that lets agents verify Persil's claims directly. The bet is to win agent-default position and build that data layer now, before a permanent own-brand default sets.",
        "id": "lhc.add_products.con.retailer-agent-baskets-defaulting-to-pl-and-marg",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Promo economics rerouted through retailer loyalty apps",
        "type": "service",
        "trendCodes": [
          "K-11"
        ],
        "driverNote": "K-11 loyalty programs cannibalise trade spend — dm App / Clubcard pricing as data toll-booths",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-11: retailer loyalty programmes (Clubcard pricing, dm App, Carrefour Rewards) are evolving into data toll-booths — promotional discounts only reach consumers through the retailer's app, making the retailer the gatekeeper of price perception and harvesting the consumer data brands used to get from promotions. Trade spend buys less visibility and yields less learning.\n\n**2. Strategic Evaluation.** Retailer loyalty programmes are becoming data toll-booths: discounts reach shoppers only through the retailer's app, making it the gatekeeper of price perception while harvesting the data brands once gained from promotions. The read is to protect first-party signal and price perception, not simply fund participation. Henkel's right-to-win is brand pull and price-pack discipline that let it negotiate from strength. The bet is to participate only with explicit data-back terms, hold a share of promotion in owned channels, and architect packs so the loyalty-app price point is planned rather than conceded.",
        "id": "lhc.add_products.con.promo-economics-rerouted-through-retailer-loyalt",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Branded variety & impulse purchasing collapsed into agent auto-baskets",
        "type": "product",
        "trendCodes": [
          "T-11",
          "T-12"
        ],
        "driverNote": "T-11 agentic commerce + T-12 brand invisibility in low-consideration categories",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-11 + T-12: when agents buy detergent autonomously, the browsing moment that drove variant discovery, impulse trade-up and scent-led switching disappears — the agent re-orders the proven SKU and optimises on price-per-wash and ratings. Brand equity is bypassed at exactly the moment it used to convert; the DB grades T-12's brand-invisibility risk at gp1 14%.\n\n**2. Strategic Evaluation.** As agents auto-reorder proven SKUs and optimise on price-per-wash and ratings, the browsing moment that drove variant discovery, trade-up and scent-led switching disappears, and brand equity is bypassed exactly where it used to convert. The defensible read is to rebuild variety inside the auto-order, rotating scent drops and Vernel add-on prompts agents can surface, and to make superiority legible to algorithms, not only humans. Henkel's right-to-win is Vernel scent technology plus structured data. The bet shifts spend from last-touch persuasion to upstream salience, since the human still sets the first default.",
        "id": "lhc.add_products.con.branded-variety-and-impulse-purchasing-collapsed",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "US import-cost pass-through on EU-made premium SKUs",
        "type": "product",
        "trendCodes": [
          "G-09"
        ],
        "driverNote": "G-09 US tariffs & reshoring — Henkel US ops exposed to imported inputs and finished goods",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-09: confirmed US tariff escalation hits EU-manufactured premium SKUs and imported inputs into Henkel's US plants — the consumer-visible end is widening price gaps between imported premium (Persil) and domestically produced value tiers (all, Purex) on the same shelf. gp1 12% at probability 5 makes this the heaviest near-term regulatory load on the US portfolio.\n\n**2. Strategic Evaluation.** US tariff escalation widens the shelf price gap between EU-made premium and domestically produced value tiers, the heaviest near-term regulatory load on the US portfolio. The read is supply localisation and controlled trade-down within the portfolio rather than discounting the premium tier into the gap. Henkel's right-to-win is its US manufacturing footprint and a portfolio spanning premium and value, so displaced demand can be absorbed internally. The bet is to regionalise critical premium production and re-source tariffed inputs where chemistry allows, defending margin structurally rather than ceding the consumer.",
        "id": "lhc.add_products.con.us-import-cost-pass-through-on-eu-made-premium-s",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Palm-derivative surfactant formulas under biodiversity sourcing mandates",
        "type": "product",
        "trendCodes": [
          "G-11",
          "G-06"
        ],
        "driverNote": "G-11 biodiversity/nature mandates + G-06 EUDR — palm-derived surfactant chains under traceability pressure",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-11 (+G-06 EUDR): biodiversity frameworks and deforestation regulation put palm-derived surfactant chains — the backbone of mainstream detergent formulation — under traceability and disclosure pressure. Consumer-visible as certification labels first, reformulation later; cost-visible immediately in compliance and segregated-supply premiums.\n\n**2. Strategic Evaluation.** Biodiversity and deforestation regulation place palm-derived surfactant chains, the backbone of mainstream formulation, under traceability and disclosure pressure that surfaces first as certification cost and later as reformulation. The hedge is the same asset as the bio-manufacturing opportunity: fermentation-derived surfactants sidestep the land-use question entirely. Henkel's right-to-win is its sourcing scale and emerging bio-manufacturing capability. The bet sequences certified-segregated palm in the near term as a claimable position into fermentation-based substitution structurally, moving before palm content becomes a shelf-level liability under campaign pressure.",
        "id": "lhc.add_products.con.palm-derivative-surfactant-formulas-under-biodiv",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "PVA-film pods & discs under biodegradability challenge",
        "type": "product",
        "trendCodes": [
          "G-14"
        ],
        "driverNote": "G-14 PVA biodegradability standards — unit-dose film chemistry contested",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-14: polyvinyl-alcohol film — the wrapper of effectively all liquid unit-dose laundry and dish formats, including Persil Discs and Somat caps — faces tightening biodegradability standards and NGO-driven microplastic framing. The DB scores it gp1 18%: if PVA is reclassified adversely, the entire unit-dose premium architecture is exposed at once.\n\n**2. Strategic Evaluation.** Tightening biodegradability standards and microplastic framing around unit-dose film threaten the wrapper of nearly all liquid pods and dish capsules at once, making this the portfolio's most concentrated regulatory exposure given how central Discs and Somat caps are. The read is a two-track defence, not denial. Henkel's right-to-win is its formulation science and the credibility to lead the evidence base where the chemistry is genuinely contested. The bet is to fund and publish independent biodegradation evidence now, since silence cedes the framing, while holding film-free unit-dose formats at launch readiness.",
        "id": "lhc.add_products.con.pva-film-pods-and-discs-under-biodegradability-c",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Data-driven platform private label in replenishment categories",
        "type": "product",
        "trendCodes": [
          "X-10"
        ],
        "driverNote": "X-10 Amazon vertical integration — PL powered by real-time demand and search data",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-10: Amazon's FMCG private label differs in kind from retail PL — it is built on real-time search, basket and review data, launched against demand gaps the data reveals, and merchandised by the platform's own ranking algorithms. In replenishment categories like detergent, platform PL plus subscription defaults is a structural share harvester (gp1 10%).\n\n**2. Strategic Evaluation.** Platform private label differs in kind from retail own-brand: built on live search, basket and review data, launched against revealed demand gaps and pushed by the platform's own ranking, it is a structural share harvester in replenishment categories like detergent. On-platform, Henkel must win the subscription slot, the real shelf, and keep ratings above the threshold where platform own-brand attacks weak incumbents first. Off-platform, this is the strongest case for channel diversification and owned demand, since concentrating volume on one platform hands a competitor its demand curve.",
        "id": "lhc.add_products.con.data-driven-platform-private-label-in-replenishm",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "select_wash",
    "label": "Select Wash Settings",
    "benefiting": [
      {
        "name": "Smart home apps (auto program selection)",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances + IoT integration",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 connected appliances + IoT integration create a machine-to-cloud moment where the washer itself recommends the wash program based on fabric type, soil level, and water hardness. This moves brand choice from consumer (at the detergent shelf) to machine algorithm (invisible to consumer). Pool is structural lock-in: whoever's formula is the OEM default captures 70%+ of that machine's lifecycle purchasing.\\n\\n**2. Strategic Evaluation.** Connected appliances (T-08) move program choice from the consumer to the machine, so the decade's pool migrates to whoever the washer trusts to set dose and cycle. The right-to-win is not an OEM default slot but Persil's cold and enzyme efficacy data feeding any machine's recommendation logic, machine-agnostically. Henkel's bet is to make Smartwash dosing chemistry and wash data the credible input across LG, Bosch, Samsung and others, supplying intelligence rather than buying hardware exclusivity.",
        "id": "lhc.select_wash.exp.smart-home-apps-auto-program-selection",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "AI-based wash cycle advisors",
        "type": "tech",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-Driven systems for fabric optimization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 AI-driven formulation systems analyze fabric care tags, soil photos, and water hardness to prescribe optimal wash programs and detergent selections, moving diagnosis from consumer intuition to algorithmic authority. Pool is whoever controls the diagnostic moment — once the phone camera or washer display says \"use Persil,\" brand comparison stops.\\n\\n**2. Strategic Evaluation.** AI advisors (T-01) collapse fabric-care judgement into an algorithm that names the detergent, so the pool accrues to whoever owns the diagnostic, not the shelf. The defensible asset is Henkel's enzyme and stain efficacy corpus translated into a wash-recommendation engine that any phone camera or machine display can call. The bet is to license validated dosing logic into third-party advisors across machines and platforms, keeping Persil and Vernel the substantiated answer rather than chasing app installs.",
        "id": "lhc.select_wash.exp.ai-based-wash-cycle-advisors",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Auto-dosing machine ecosystems",
        "type": "tech",
        "trendCodes": [
          "T-08",
          "T-05"
        ],
        "driverNote": "T-08 Connected Appliances + T-05 Automation",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 connected appliances + T-05 manufacturing automation create closed-loop dosing: the machine reads the load, communicates water hardness, and auto-pulls the exact detergent amount from an integrated cartridge. Nespresso-model recurring revenue: hardware creates dependency on cartridge refills. Pool is the installed-machine base and the 10-year cartridge revenue stream per machine.\\n\\n**2. Strategic Evaluation.** Closed-loop auto-dosing (T-08, T-05) converts detergent into a recurring refill stream, the highest-stickiness pool of the decade. Smartwash is the right vehicle precisely because it doses across any machine, so the moat is dosing chemistry plus wash data, not a hardware-locked cartridge slot. The bet is to make Persil refills the chemistry consumers reorder regardless of appliance brand, partnering with OEMs to supply intelligence while keeping the consumer relationship and reorder data with Henkel.",
        "id": "lhc.select_wash.exp.auto-dosing-machine-ecosystems",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Voice-activated wash controls",
        "type": "tech",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI + smart home voice assistants",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 AI + smart home voice assistants (Alexa, Google Home, Siri) enable washing-machine control via voice (\"Alexa, run delicate wash, light soil, Persil\"). This removes friction from OEM-brand recommendation moments; voice commands default to the machine manufacturer's preset programs, which can be brand-parameterized by Henkel.\\n\\n**2. Strategic Evaluation.** Voice control (T-01) strips friction from cycle selection and could let assistants nominate a detergent at the spoken command, an emerging premiumising layer rather than a near-term pool. The right-to-win is Persil cold and delicate efficacy translated into voice-invokable wash routines that any assistant or OEM can surface, machine-agnostically. The bet is optionality: stand up substantiated routine definitions so Persil is the validated answer when voice ordering matures, not a bid for assistant exclusivity today.",
        "id": "lhc.select_wash.exp.voice-activated-wash-controls",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Mobile app machine pairing",
        "type": "service",
        "trendCodes": [
          "T-07",
          "K-04"
        ],
        "driverNote": "T-07 AI Personalization + K-04 Social Commerce",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 AI personalization + K-04 social commerce enable users to pair their smartphone with the washing machine, unlocking personalized wash recommendations, purchase history tracking, and social sharing of laundry results. Pool is engagement, data, and recurring SKU recommendations — the mobile app becomes the customer's laundry diary.\\n\\n**2. Strategic Evaluation.** Machine pairing plus social commerce (T-07, K-04) turns the phone into a laundry record that drives reorders and recommendation data, shifting the pool toward whoever holds that data layer. The asset is dosing and efficacy intelligence that pairs with any connected washer, not a hardware tie. The bet is to make Smartwash the agnostic data and reorder hub across machines, with one-tap repurchase of Persil and Vernel into the consumer's chosen retailer, owning relationship and signal rather than a walled app.",
        "id": "lhc.select_wash.exp.mobile-app-machine-pairing",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "AI-optimized cold-wash cycle programs",
        "type": "tech",
        "trendCodes": [
          "T-01",
          "E-07"
        ],
        "driverNote": "T-01 AI-Driven Formulation + E-07 Energy Cost Volatility",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 AI formulation optimizes detergent efficacy at 20-30°C wash temperatures, addressing E-07 energy cost volatility (European energy costs 2-3x US levels). Machines running 80%+ of washes at cold temperatures create a new competitive moment: whoever owns cold-wash superiority wins the efficiency-conscious consumer without sacrificing efficacy.\\n\\n**2. Strategic Evaluation.** AI-tuned cold programs (T-01) plus European energy volatility (E-07) make sub-30C the default wash, and the pool flows to whoever proves efficacy at low temperature. This is Henkel's core right-to-win: Persil's cold-wash and enzyme R&D. The bet is to own substantiated cold efficacy as a category claim and wire it into connected eco-cycles so the machine recommends it, positioning Persil as the brand that keeps clean performance as temperatures fall, ceteris paribus on competitive response.",
        "id": "lhc.select_wash.exp.ai-optimized-cold-wash-cycle-programs",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Manual mechanical program dials",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances displace manual controls",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 connected appliances replace manual dial-and-button interfaces with touchscreens and cloud-connected program selection. Dial-based washers are legacy; pools migrates to whoever controls the digital program library. New machine installs in Europe at 15M+ annually are 90%+ digital-enabled by 2025.\\n\\n**2. Strategic Evaluation.** Mechanical dials fade as connectivity (T-08) moves program selection into software; this is an appliance-interface decline, not a detergent pool to defend. Henkel holds no equity in dial hardware, so there is nothing to harvest beyond ensuring efficacy data populates the digital program libraries that replace it. The redeploy is to invest behind cold-wash and connected-dosing intelligence across machines, where the value that dials used to gate now actually concentrates.",
        "id": "lhc.select_wash.con.manual-mechanical-program-dials",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Generic dosing instructions (packaging)",
        "type": "product",
        "trendCodes": [
          "T-01",
          "T-07"
        ],
        "driverNote": "T-01 AI + T-07 Personal dosing replaces generic",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 AI + T-07 personalization displace one-size-fits-all dosing tables printed on cartons. Connected machines auto-read load weight and hardness, recommending precise dosing to within 1-2mL. Generic instructions become irrelevant; pool contracts as packaging investment in print-based guidance becomes waste.\\n\\n**2. Strategic Evaluation.** Printed dosing tables (T-01, T-07) lose relevance as connected machines read load and hardness and meter precisely, so this guidance pool quietly contracts. There is little to defend; the graceful harvest is to let pack instructions thin while shifting authority to data-driven dosing. The redeploy is to make Smartwash dosing chemistry the precise recommendation engine across machines, capturing the accuracy value that static print can no longer deliver and supporting lighter packaging in passing.",
        "id": "lhc.select_wash.con.generic-dosing-instructions-packaging",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Paper washing guides / manuals",
        "type": "product",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 Digital instructions replace paper",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 digital instructions (app-based, video tutorials, AI chatbots) replace paper washing guides entirely. Paper is bulky, costly to print and ship, and rarely consulted post-purchase. Pool disappears; paper guides are pure cost center with zero consumer value.\\n\\n**2. Strategic Evaluation.** Paper guides (T-07) are a cost line with negligible consumer value once digital and in-machine guidance exist; the pool simply disappears. Harvest by removing the insert as packaging is reworked, not by defending it. Redeploy the freed attention to substantiated digital dosing and care guidance tied to Persil and Vernel efficacy, so the instruction moment becomes a data-led touchpoint that reinforces the brand rather than a discarded leaflet.",
        "id": "lhc.select_wash.con.paper-washing-guides-manuals",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "washing_cycle",
    "label": "Washing Cycle",
    "benefiting": [
      {
        "name": "Smart / connected washers (auto-dose)",
        "type": "tech",
        "trendCodes": [
          "T-08",
          "T-05"
        ],
        "driverNote": "T-08 Connected Appliances + T-05 Manufacturing Automation",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected appliances with auto-dosing cartridges) collapses the detergent selection moment into machine firmware: the washer recommends and dispenses the dose without user friction. This shifts the profit pool from shelf-driven brand choice to whoever controls the OEM cartridge relationship and the recurring refill channel. Machine learning optimizes detergent chemistry to water hardness, soil load, and fabric type in real time, rendering conventional off-the-shelf selection obsolete.\\n\\n**2. Strategic Evaluation.** Connected auto-dosing washers (T-08, T-05) move the selection moment into firmware and convert detergent into recurring refills, the decade's stickiest pool. Smartwash wins here because it doses across any machine, so the moat is dosing chemistry plus wash data, not a pre-loaded default cartridge or locked refill. The bet is to make Persil the refill consumers reorder regardless of appliance brand, supplying OEMs with validated dosing intelligence while keeping the reorder relationship and data with Henkel.",
        "id": "lhc.washing_cycle.exp.smart-connected-washers-auto-dose",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Cold-wash optimized detergents",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-Driven formulation for cold-water efficiency",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI formulation) has cracked cold-water efficacy. Persil Green Power and Ariel Turn To 30 both optimize surfactant blend and enzyme cocktail for sub-20°C water. Cold wash captures E-07 (energy costs 2-3x US levels in Europe) — every degree reduction in water temperature shrinks COGS for the consumer. The pool migrates from hot-wash specialists (legacy positioning) to whoever owns the efficacy claim at cold, which also aligns with sustainability messaging.\\n\\n**2. Strategic Evaluation.** Cold-wash efficacy is the strongest tailwind in this set: T-01 formulation plus European energy costs (E-07) make low-temperature washing the default, and the pool migrates from hot-wash heritage to whoever owns proven cold performance. This is Persil's home turf in enzyme and surfactant cold R&D. The bet is to lock the substantiated cold-efficacy claim and embed it into connected eco-cycles so the machine reinforces cold defaults, ahead of competitors closing the gap, ceteris paribus.",
        "id": "lhc.washing_cycle.exp.cold-wash-optimized-detergents",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Water softening integrated systems",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances + integrated water treatment",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected machines) integrate water hardness detection and targeted softening chemistry into the wash cycle, eliminating the need for external Calgon-type sachets. Inline IoT sensors measure water mineral content and micro-dose integrated zeolites or citrate sequestrants, optimizing fabric hand and detergent performance. The pool shifts from a standalone water-care category into a software-driven, in-cycle optimization managed by machine firmware.\\n\\n**2. Strategic Evaluation.** As connected machines (T-08) sense hardness and dose softening in-cycle, standalone water-care erodes and the function folds into wash chemistry, a pool Henkel can claim through formulation. The right-to-win is Persil and Vernel softening and sequestrant know-how supplied as in-wash chemistry across machines, not a proprietary second cartridge slot. The bet is to make Henkel chemistry the hardness-managing layer any washer can call on, transferring Vernel softening equity into integrated dosing rather than defending sachets.",
        "id": "lhc.washing_cycle.exp.water-softening-integrated-systems",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Maintenance & care subscriptions",
        "type": "service",
        "trendCodes": [
          "K-06"
        ],
        "driverNote": "K-06 Subscription models + post-purchase services",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-06 (subscription models) applied to washing machines creates predictable, high-margin recurring revenue through machine health and hygiene contracts. Subscribers receive auto-delivered cartridges (detergent, softener, machine cleaner) on a fixed cycle, plus diagnostic alerts when drum or seals need attention. The profit pool shifts from one-time transaction friction into predictable subscription economics with embedded brand loyalty.\\n\\n**2. Strategic Evaluation.** Subscription mechanics (K-06) turn replenishment into predictable, loyal revenue, and auto-dosing makes laundry a natural fit as cartridges deplete on a known cadence. The asset is Henkel's dosing and care chemistry, delivered through a machine-agnostic replenishment programme rather than tied to one OEM's appliance sale. The bet is to anchor Persil and Vernel refills plus machine-care in a subscription that travels across washers, capturing reorder economics and consumer data without betting on hardware exclusivity.",
        "id": "lhc.washing_cycle.exp.maintenance-and-care-subscriptions",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Energy-monitor detergents (IoT-linked)",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances report water/energy usage",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected appliances) can report real-time water and energy usage to the consumer app, and the detergent formulation itself can be optimized per cycle to minimize energy draw. Products positioned as \"smart energy-saving\" detergent that trigger firmware adjustments (reduced spin speeds when moisture content is low, shorter heat-up cycles) create a new \"efficiency\" differentiation axis beyond cleaning power. Consumers pay for measurable utility savings — a tangible ROI claim.\\n\\n**2. Strategic Evaluation.** Connected telemetry (T-08) lets the wash report energy and water use, opening an efficiency axis beyond cleaning where measurable savings premiumise the product. Henkel's right-to-win is cold and low-energy formulation paired with honest, substantiated savings reporting, readable on any connected machine rather than a single ecosystem. The bet is to fuse Persil cold efficacy with credible efficiency feedback so the brand owns the energy-saving claim, keeping substantiation defensible under green-claims scrutiny and avoiding overstated figures.",
        "id": "lhc.washing_cycle.exp.energy-monitor-detergents-iot-linked",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Machine health predictive services",
        "type": "service",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation + IoT monitoring",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (automation and IoT) enables predictive maintenance: drum vibration, cycle duration variance, and water flow anomalies signal bearing wear, pump failure, or seal degradation weeks before catastrophic failure. A detergent company that owns the diagnostics can offer extended machine warranty or preventive service contracts, generating high-margin SaaS-like revenue. The pool shifts from one-time detergent sales into lifecycle appliance stewardship.\\n\\n**2. Strategic Evaluation.** Predictive maintenance (T-05) lets diagnostics signal wear before failure, extending a detergent brand into lifecycle appliance stewardship and higher-retention service revenue. Realistically this is a partner play: Henkel supplies care chemistry and replenishment data into OEM and service networks rather than owning the diagnostics hardware. The bet is to attach Persil and Vernel replenishment and machine-care to a partnered care offering across appliance brands, building data-led switching costs that product-only competitors cannot replicate, without overstating Henkel's hardware role.",
        "id": "lhc.washing_cycle.exp.machine-health-predictive-services",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Wash-cycle additives from divesting brands",
        "type": "product",
        "trendCodes": [
          "X-01"
        ],
        "driverNote": "X-01 Reckitt Essential Home Divestiture share capture",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-01 (Reckitt Essential Home Advent divestiture) creates a 12-18 month window when the divested Essential Home brands (Air Wick, Calgon, Woolite) face cost-cutting and withdrawal from premium innovation (Vanish and Finish are retained Reckitt powerbrands, not part of this divestiture). Henkel can acquire or poach the R&D teams, consumer data, and retail shelf space before private-equity cost structures render these brands untenable as innovation platforms. Wash-cycle additive categories (stain fighters, fabric protectors, scent enhancers) are temporarily orphaned.\\n\\n**2. Strategic Evaluation.** The Reckitt portfolio reshaping (X-01) opens a share window in additives as the divested Essential Home brands (including Calgon, now Advent-owned and not held by Henkel) face cost discipline. Vanish and Finish are retained Reckitt powerbrands, so the opening is competitive share, not orphaned IP. The bet is to push Sil-led stain and Vernel scent-booster innovation into shelf and consumers loosened during the transition, redeploying behind integrated, connected-dosing additive formats while the disruption lasts.",
        "id": "lhc.washing_cycle.exp.wash-cycle-additives-from-divesting-brands",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Low-water wash programs & waterless cleaning formats",
        "type": "product",
        "trendCodes": [
          "E-10"
        ],
        "driverNote": "E-10 freshwater crisis — 40% supply gap by 2030 mandates water-light formulation",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-10: with global freshwater demand projected to exceed supply by 40% by 2030 (UNEP), water-stressed markets are moving from voluntary eco-programs to mandated water efficiency — washing machines' low-water cycles need detergents formulated for low-dilution performance, and waterless/low-water cleaning formats gain regulatory tailwind in stressed regions. The water crisis itself stays a category headwind (cost, reformulation, usage suppression) — what benefits here is the water-light format layer.\n\n**2. Strategic Evaluation.** Freshwater stress (E-10) is pushing machines and regulators toward low-water cycles, and the benefiting layer is detergent engineered for low-dilution performance. Henkel's right-to-win is formulating Persil to perform at minimal water as a spec, becoming the recommended chemistry for connected eco-cycles (linking T-08). The bet is to lead low-water efficacy claims in water-stressed metros where it is a first-order purchase driver, then scale, treating water-light performance as a design constraint rather than a niche variant.",
        "id": "lhc.washing_cycle.exp.low-water-wash-programs-and-waterless-cleaning-f",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Standard non-connected machines",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances obsolete legacy hardware",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected appliances) adoption is accelerating: 18% of new European washing machine sales in 2025 are IoT-enabled; forecast is 35% by 2028. Legacy vented, non-connected machines are becoming obsolete as OEMs sunset models, retailers reduce SKU allocation, and manufacturers pivot to smart production. The profit pool for conventional detergent (designed for variable user behavior) contracts as machines become deterministic, software-driven systems that optimize dose and cycle automatically.\\n\\n**2. Strategic Evaluation.** As connectivity (T-08) spreads, the conventional-detergent pool built around variable user behaviour contracts while the installed base of standard machines slowly ages out, leaving a long but declining tail to harvest, not defend. The move is to keep mainstream Persil efficient and disciplined on SKU complexity while redirecting R&D and investment toward cold-wash and connected-dosing chemistry. Manage the legacy line for cash and migrate equity into the connected, agnostic dosing pool where future growth concentrates.",
        "id": "lhc.washing_cycle.con.standard-non-connected-machines",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Hot-wash detergent formulas",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI cold-wash optimization + energy efficiency",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI formulation) has optimized cold-water cleaning to parity with hot wash in most soil conditions. E-07 (energy costs 2-3x US levels) and E-02 (water scarcity) drive consumers away from hot-wash programs. The hot-wash detergent pool shrinks as cold becomes the default — hot-wash-specific formulations (high-temperature starch builders, oxygen bleach activators) lose their structural reason to exist. Pool moves to energy-efficient, cold-optimized chemistry.\\n\\n**2. Strategic Evaluation.** Hot-wash chemistry is in structural decline as cold efficacy (T-01) reaches parity and energy costs push defaults down; this is a high-headwind pool to harvest gracefully, not protect. The redeploy is decisive: consolidate R&D and capacity into cold-optimised Persil and let high-temperature-specific formulations wind down as demand fades. Frame the shift as leadership, signalling that Henkel has moved its weight into the cold-wash growth pool first rather than clinging to shrinking hot-wash positioning.",
        "id": "lhc.washing_cycle.con.hot-wash-detergent-formulas",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Standalone Calgon-type water softeners",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Integrated machine water treatment",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (integrated machine water treatment) renders standalone sachets obsolete. As connected washers implement inline water hardness detection and micro-dosing of softening agents, the Calgon category (sachet water softeners added per wash) becomes redundant. Consumers will not pay for external softening when the machine handles it automatically. Pool contracts 40-60% by 2030 as adoption curves flatten.\\n\\n**2. Strategic Evaluation.** In-machine hardness sensing and dosing (T-08) erode standalone softeners; the category is a managed decline. Henkel does not own Calgon (now Advent-owned within Essential Home), so there is no asset to harvest here, only mental shelf space to redeploy. The move is to let Vernel claim the softening and conditioning function within integrated, connected dosing across machines, carrying its softening equity into in-wash chemistry rather than competing for a contracting standalone sachet pool.",
        "id": "lhc.washing_cycle.con.standalone-calgon-type-water-softeners",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Static water-hardness testing strips",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 IoT machines auto-detect water hardness",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (IoT machines auto-detect water properties in real time) eliminate the need for consumer manual testing. Testing strips are a dying artifact of non-connected laundry — when the machine reads water hardness automatically, consumer-operated diagnostic tools have zero value proposition. This is a rapid, clean extinction: no transition pool, no nuance. Just obsolescence.\\n\\n**2. Strategic Evaluation.** Connected machines (T-08) read hardness automatically, removing the consumer's reason to test manually; the strip pool extinguishes with little transition value. Henkel holds no position to defend, so there is nothing to harvest beyond using adoption as a signal. The redeploy is to fold hardness adjustment into Persil and Smartwash dosing chemistry so the machine senses and the formulation responds, capturing automatically the diagnostic value that strips used to sell.",
        "id": "lhc.washing_cycle.con.static-water-hardness-testing-strips",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "High-temperature wash detergents",
        "type": "product",
        "trendCodes": [
          "E-02"
        ],
        "driverNote": "E-02 Water Scarcity + energy efficiency trends",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-07 (European energy costs 2-3x US levels, energy is 8-15% of manufacturing COGS) and E-02 (water scarcity mandates lower-temperature regimens) combine to eliminate high-temperature wash as a viable consumer choice. Detergent chemistry optimized for 60°C and above has no demand rationale remaining. The pool migrates entirely to cold-and-warm (15-40°C) formulations that align with both cost and sustainability.\\n\\n**2. Strategic Evaluation.** Energy costs (E-07) and water-saving pressure (E-02) remove the rationale for high-temperature wash chemistry, contracting this pool toward the warm-to-cold band. Harvest gracefully: wind down formulations tuned for the hottest cycles and consolidate into low-temperature Persil, simplifying the portfolio and reducing complexity as you go. The redeploy is to channel that capacity behind cold and warm efficacy, where both cost and sustainability now anchor demand, ceteris paribus on consumer behaviour.",
        "id": "lhc.washing_cycle.con.high-temperature-wash-detergents",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Energy-intensive hot-wash programs",
        "type": "tech",
        "trendCodes": [
          "E-07"
        ],
        "driverNote": "E-07 Energy Cost Volatility at 2-3x US levels",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-07 is structural: European energy is 2-3x US levels, and OEM manufacturers are discontinuing 60°C and 90°C wash programs from new machines in favor of 20°C \"quick wash\" and 40°C \"standard\" settings. Detergent companies built their entire formulation portfolios around hot-water performance; as machines stop offering hot as a default, the demand rationale for temperature-resilient detergents disappears. Pool contracts 30-40% by 2030.\\n\\n**2. Strategic Evaluation.** OEMs are sunsetting the hottest programs (E-07), erasing demand for temperature-resilient detergent; an industry-wide headwind, not a Henkel-specific one. The move is to harvest the legacy gracefully while leading the narrative that efficient cold wash beats conventional hot on both cleaning and footprint, grounded in Persil's substantiated cold efficacy. Redeploy investment into the cold-wash pool and connected eco-cycles, positioning the shift as inevitable and desirable rather than a defended loss.",
        "id": "lhc.washing_cycle.con.energy-intensive-hot-wash-programs",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "unloading",
    "label": "Unloading",
    "benefiting": [
      {
        "name": "Anti-mustiness freshness solutions",
        "type": "product",
        "trendCodes": [
          "C-04"
        ],
        "driverNote": "C-04 Conscious Consumption wants fresh, not masked",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 (conscious consumption demands fresh without synthetic masking) creates demand for active anti-mustiness molecules that eliminate odor sources rather than covering them. Bacterial growth in the washing machine and damp loads triggers mustiness; solutions using silver ions, hydrogen peroxide, or enzymatic bio-actives address the root cause. This is a new occasion (machine hygiene) layered on top of laundry, not a replacement for softeners, expanding the pool.\\n\\n**2. Strategic Evaluation.** Conscious consumption (C-04) rewards eliminating odour at source over masking, opening an incremental machine-hygiene and anti-mustiness occasion layered on top of softening. Henkel's right-to-win is active-molecule and enzymatic know-how that addresses biofilm and damp-load odour credibly. The bet is to extend Vernel and machine-care into a substantiated freshness-at-source range, prompted at the right moments via connected reminders across machines, expanding total fabric-care spend rather than cannibalising softener, with claims kept defensible.",
        "id": "lhc.unloading.exp.anti-mustiness-freshness-solutions",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Anti-wrinkle post-cycle sprays",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats enable targeted sprays",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (concentrated formats) enables post-cycle, on-the-hanger treatment sprays that eliminate wrinkles without ironing. Unlike traditional fabric softeners (added to the wash), post-cycle sprays target the wrinkle moment itself, creating a new consumer occasion. C-04 (conscious consumption) drives demand for plant-derived, low-VOC formulations. This is additive to existing softener categories, not substitutive — expanding total fabric care spend.\\n\\n**2. Strategic Evaluation.** Concentrated formats (T-03) enable post-cycle, on-the-hanger treatments that target the wrinkle moment itself, a new occasion additive to in-wash softening, with C-04 pushing plant-derived low-VOC chemistry. Vernel is the natural carrier, and the right-to-win is finishing and conditioning formulation rather than a connected gimmick. The bet is to own a credible iron-skipping finishing format that multiplies fabric-care touchpoints per consumer, prompted at the unload moment, expanding the pool ahead of slower competitor response.",
        "id": "lhc.unloading.exp.anti-wrinkle-post-cycle-sprays",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart unload reminders (app notifications)",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances send completion alerts",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected appliances send notifications) transforms the unloading moment from a forgotten chore into a coordinated consumer touchpoint. When the machine notifies the consumer that the load is dry and ready to fold, it creates an ideal moment to recommend Vernel fabric care products (anti-wrinkle spray, freshness booster, fabric protector). The profit pool shifts from \"catch the consumer at the shelf\" to \"intercept the consumer at the unload moment.\"\\n\\n**2. Strategic Evaluation.** Connected completion alerts (T-08) convert a forgotten chore into a timed touchpoint, shifting interception from shelf to the unload moment when fabric-finishing intent peaks. The asset is relevant, substantiated Vernel recommendations delivered across any connected machine, not a single-ecosystem feature. The bet is to make the notification a credible care prompt for finishing sprays and freshness products, capturing incremental basket at the moment of need while keeping the recommendation honest rather than promotion-driven.",
        "id": "lhc.unloading.exp.smart-unload-reminders-app-notifications",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Odor-elimination fabric mists",
        "type": "product",
        "trendCodes": [
          "C-04"
        ],
        "driverNote": "C-04 Conscious Consumption + bio-based solutions",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 (conscious consumption and cleanical beauty) drives demand for active odor-removal technologies (enzymes that digest sweat proteins, bacterial-static silver treatments, or bio-based volatile eliminator molecules) over synthetic fragrance masking. T-03 (concentrated formats) enables portable, spray-on treatments. The pool expands as consumers adopt layered fabric care: wash + softener + between-wash odor control, multiplying touchpoints and SKUs per consumer.\\n\\n**2. Strategic Evaluation.** Conscious consumption (C-04) plus concentrated formats (T-03) grow demand for active, between-wash odour elimination over fragrance masking, adding a layered fabric-care occasion of wash, soften and refresh. Vernel's right-to-win is enzyme and active-odour chemistry that genuinely removes odour, substantiated rather than perfumed. The bet is to own credible efficacy in on-garment mists, multiplying SKUs and touchpoints per consumer, with claims defensible under green and wellness-claims scrutiny rather than headline numbers.",
        "id": "lhc.unloading.exp.odor-elimination-fabric-mists",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Microfiber-safe freshness products",
        "type": "product",
        "trendCodes": [
          "G-02"
        ],
        "driverNote": "G-02 Microplastics Ban creates new care category",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-02 (microplastics ban phase 2) restricts the use of microbeads in cosmetics and detergents; synthetic polymer particles in dryer sheets and fabric softeners face similar restrictions. Athleisure and technical-fabric ownership (C-29: 35% of European wardrobes) creates new demand for microfiber-safe fabric care that does not shed particles. This is a regulatory-driven white space: brands that ship microfiber-safe formulations capture both sustainability-conscious and athletic-wear consumers.\\n\\n**2. Strategic Evaluation.** The EU microplastics restrictions (G-02) plus the rise of technical and athleisure fabrics open a regulatory white space for shedding-safe, microfiber-compatible fabric care. The right-to-win is polymer-aware softening and detergent formulation that performs on synthetics without contributing particles. The bet is to pre-own the microfiber-safe positioning across Vernel and Persil with lab-substantiated compatibility, so Henkel captures the trade-up as reclassification bites, treating the regulation as a demand creator rather than a constraint.",
        "id": "lhc.unloading.exp.microfiber-safe-freshness-products",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Functional neuro-scent finishers (calm / focus-positioned freshness)",
        "type": "product",
        "trendCodes": [
          "T-19"
        ],
        "driverNote": "T-19 neuro-scents — EEG/fMRI-validated functional fragrance",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-19: neuro-scents — fragrances engineered and clinically validated (EEG/fMRI) for measured cognitive-emotional effects — open a functional layer on top of laundry freshness: 'calm' bed linen, 'focus' workwear. Small pool today (gp1 6%, prob 3) but it premiumises the unloading/fresh-laundry moment where scent perception peaks.\n\n**2. Strategic Evaluation.** Neuro-scents (T-19) add a measured functional layer to laundry freshness at the unload moment where scent perception peaks; a small but premiumising pool today. Vernel is the natural carrier, and the genuine differentiator is measured-benefit substantiation versus aromatherapy folklore, which also keeps claims defensible under green and wellness-claims scrutiny (G-05). The bet is optionality on sensory premiumisation (C-09): pilot a limited premium line to build the capability, valuing the trend for future positioning rather than near-term volume.",
        "id": "lhc.unloading.exp.functional-neuro-scent-finishers-calm-focus-posi",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Standalone fabric softeners (liquid)",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats integrated into pods",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (concentrated formats integrated into pods) renders standalone rinse-aid liquid softeners redundant as Persil Discs and Vernel in-wash softening become the default. Machine auto-dosing systems dispense all ingredients from a single cartridge; separate liquid purchases require extra rinse cycles, extra handling, and extra shelf space. Consumer convenience optimization drives the pool entirely into integrated formats by 2030.\\n\\n**2. Strategic Evaluation.** Concentrated and integrated formats (T-03) erode standalone rinse-aid softeners as in-cartridge and in-disc softening become the convenient default, contracting this pool toward integrated dosing. Harvest the liquid line gracefully while migrating Vernel softening equity into integrated and cartridge formats that any auto-dosing machine can dispense. The redeploy is to invest behind that softening chemistry within connected dosing, framing Vernel as moving upstream into the wash rather than retreating from the category.",
        "id": "lhc.unloading.con.standalone-fabric-softeners-liquid",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Heavy perfumed rinse aids",
        "type": "product",
        "trendCodes": [
          "C-04"
        ],
        "driverNote": "C-04 Conscious Consumption + subtle scent preference",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 (conscious consumption) rejects synthetic fragrance overload in favor of subtle, true-to-nature scent profiles. Consumer sentiment data (NielsenIQ 2025) shows 62% of European consumers perceive \"heavy perfumed\" as \"chemical and artificial.\" Heavy rinse-aid formulations (5-8% fragrance oil) lose credibility. The pool migrates to scent-booster cartridges with lower fragrance intensity and C-28 (scent boosters more than doubling by 2030) that let consumers modulate intensity.\\n\\n**2. Strategic Evaluation.** Conscious consumption (C-04) reads heavy synthetic perfuming as artificial, eroding high-fragrance rinse aids while growing controllable, lower-intensity scent and scent-booster formats. Harvest the heavy-perfume legacy gracefully and bifurcate Vernel: a low-fragrance, high-efficacy softening line for the restraint segment and modular scent boosters for those who want to dial intensity up. The redeploy moves equity from one loud format into two demand spaces, capturing both the subtle and the customisable scent pools.",
        "id": "lhc.unloading.con.heavy-perfumed-rinse-aids",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Synthetic static-control sheets",
        "type": "product",
        "trendCodes": [
          "G-05",
          "E-02"
        ],
        "driverNote": "G-05 Green Claims + E-02 sustainability concerns",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-05 (green claims directive bans unsubstantiated environmental claims) is restricting marketing of synthetic dryer sheets as \"safe,\" and E-02 (water scarcity and sustainability pressure) drives consumers toward reusable dryer balls and heat-pump dryers that generate less static. Traditional synthetic sheet softeners (quaternary ammonium compounds coated on paper) are falling out of favor as a \"chemical\" solution. Pool migrates to bio-based alternatives and mechanical (ball) solutions.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement (G-05) and sustainability pressure (E-02) erode synthetic dryer sheets as reusable balls and heat-pump drying spread, contracting this pool. Treat it as a format pivot, not a category exit: harvest the synthetic sheet gracefully and redeploy Vernel into reusable dryer balls and a substantiated bio-based sheet alternative. The bet is to own the compliant, lower-footprint static-control formats credibly, capturing the sustainability trade-down with claims that hold under the directive rather than defending the legacy chemistry.",
        "id": "lhc.unloading.con.synthetic-static-control-sheets",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "drying",
    "label": "Drying",
    "benefiting": [
      {
        "name": "Heat pump dryers (energy-efficient)",
        "type": "tech",
        "trendCodes": [
          "E-02"
        ],
        "driverNote": "E-02 Energy efficiency + climate consciousness",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-02 (energy efficiency) and E-07 (structural energy cost disadvantage in Europe) drive adoption of heat-pump dryers, which use 40-60% less energy than vented dryers. Installed base will shift from 70% vented to 50% heat-pump by 2030. Heat-pump drying requires lower temperatures and longer cycles, changing fabric interaction chemistry and creating demand for heat-pump-optimized fabric care products. This is a hardware-driven expansion pool.\\n\\n**2. Strategic Evaluation.** The decade-long shift from vented to heat-pump drying rewrites fabric-interaction chemistry: lower temperatures and longer cycles change how softeners and scents deposit and release. Henkel has no appliance asset, so the bet is to own the consumable layer Vernel's freshness equity uniquely fits — conditioning and scent chemistry reformulated for low-temperature deposition, positioned as the default fabric-care for heat-pump owners. Ceteris paribus, this is a real right-to-win on chemistry, not a hardware race; the format transition is the entry window.",
        "id": "lhc.drying.exp.heat-pump-dryers-energy-efficient",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Dryer sheets with scent boosters",
        "type": "product",
        "trendCodes": [
          "C-09"
        ],
        "driverNote": "C-09 Fragrance Premiumization in Home Care at 15%+ growth",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-09 (fragrance premiumization in home care at 15%+ growth) and C-28 (scent boosters more than doubling by 2030) combine to create demand for dual-function dryer sheets that deliver both static control and premium fragrance. P&G Lenor Unstoppables created the scent-booster category in the wash; the drying stage is the next frontier. Combining static control (the dryer sheet function) with fragrance delivery (the booster function) creates a natural product bundle that expands the profit pool.\\n\\n**2. Strategic Evaluation.** Fragrance premiumization is migrating the scent-booster occasion from the wash into drying, fusing static control with long-lasting scent deposition. Vernel's freshness and scent-technology equity is the asset to extend here, owning a premium dryer-stage scent tier rather than competing on commodity sheets. The durable bet is bio-based, low-residue scent carriers that satisfy tightening EU claims rules — differentiating on substantiated freshness longevity, not synthetic load. A genuine tailwind where Henkel's scent franchise transfers directly.",
        "id": "lhc.drying.exp.dryer-sheets-with-scent-boosters",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Tumble dryer balls (eco-friendly)",
        "type": "product",
        "trendCodes": [
          "G-04",
          "E-02"
        ],
        "driverNote": "G-04 PPWR + E-02 Water Scarcity reduces fabric conditioner need",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-04 (PPWR packaging waste reduction) and E-02 (water scarcity reduces fabric softener demand) drive adoption of reusable wool dryer balls as chemical-free static elimination. Dryer balls are durable (50+ uses per set), plastic-free, and require zero chemical input, aligning with E-04 (EPR fee escalation) which penalizes single-use packaging. The pool expands as consumers replace boxes of disposable sheets with durable sets.\\n\\n**2. Strategic Evaluation.** PPWR and softener-reduction pressure favor reusable, plastic-free static control, but the durable hardware itself (wool balls) is not where Henkel wins — margin and repeat purchase have largely walked out with the disposable. The defensible move is to supply the refreshable consumable: Vernel scent inserts or refill drops that re-dose reusable balls, converting a one-time hardware sale into a recurring freshness revenue line. Partner or co-market on the ball; own the recurring scent chemistry.",
        "id": "lhc.drying.exp.tumble-dryer-balls-eco-friendly",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Dehumidifiers for air-dry optimization",
        "type": "tech",
        "trendCodes": [
          "E-02"
        ],
        "driverNote": "E-02 Water Scarcity drives alternative drying",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-02 (water scarcity and water-usage reduction) drives interest in air-drying as an alternative to machine drying. In humid European climates (UK, Benelux, northern Germany), air-drying requires longer hang time (8-12 hours vs 45 minutes in a dryer). Dehumidifiers solve the water-absorption problem and create a new adjacent product category. The pool expands as consumers optimize the air-dry occasion with humidity-control technology.\\n\\n**2. Strategic Evaluation.** Water-consciousness and energy cost are reviving air-drying, but dehumidifier hardware sits entirely outside Henkel's right to win. The honest play is adjacency, not manufacture: position Vernel's freshness and anti-musty chemistry as the companion to slow indoor drying, where damp hang-time risks odor — a genuine consumer problem Vernel's scent and freshness equity can own. Co-merchandise with appliance brands; do not chase the device. A modest, real tailwind for the chemistry, harvested through partnership.",
        "id": "lhc.drying.exp.dehumidifiers-for-air-dry-optimization",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart dryer sensors & IoT tracking",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances enable drying optimization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected appliances) enables dryers with moisture sensors that auto-stop, preventing over-drying and shrinkage. IoT tracking reports drying time, energy consumption, and garment condition back to the Henkel Smartwash app. This creates a closed-loop garment care feedback loop: wash data → drying recommendations → fabric health status → next-care product recommendation. The profit pool expands as sensors unlock new data-driven service opportunities.\\n\\n**2. Strategic Evaluation.** Connected drying generates garment-condition data, but the value to Henkel is the consumable recommendation, not the sensor or firmware. The realistic decade bet is a thin integration layer — Persil/Somat Smartwash, which works in any machine, ingesting drying signals to trigger garment-protection and delicate-care recommendations — rather than chasing OEM firmware exclusivity, which Henkel cannot win and should not frame as lock-in. Low-magnitude tailwind: useful as a discovery channel for Vernel protection chemistry, not a hardware position.",
        "id": "lhc.drying.exp.smart-dryer-sensors-and-iot-tracking",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Gentle-dry garment longevity products",
        "type": "product",
        "trendCodes": [
          "E-08",
          "C-04"
        ],
        "driverNote": "E-08 Textile Longevity + C-04 Conscious Consumption",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-08 (EU textile longevity mandates) and C-04 (conscious consumption) drive demand for drying-stage products that extend garment life: heat-protective conditioning treatments, fabric-strengthening sheets, and anti-pilling agents applied during tumble drying. The drying moment is the last touchpoint before storage; products applied here can mitigate heat-stress damage and add measurable lifespan extension. This is a new occasion-based pool within drying.\\n\\n**2. Strategic Evaluation.** EU textile-longevity mandates make drying the last damage-mitigation touchpoint before storage — heat-stress protection and anti-pilling are a credible new occasion. This is squarely Henkel's right to win: Persil's garment-longevity chemistry and Vernel's fibre-conditioning equity extend naturally into a dryer-stage protection format tied to the EU durability agenda. The durable bet is substantiated fibre-life extension, not a scent line dressed as care. Small today but strategically aligned with the longevity thesis Henkel should be building across the journey.",
        "id": "lhc.drying.exp.gentle-dry-garment-longevity-products",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Traditional vented tumble dryers",
        "type": "tech",
        "trendCodes": [
          "E-02"
        ],
        "driverNote": "E-02 Energy efficiency pressure + heat pump adoption",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** E-02 (energy efficiency standards escalating) and E-07 (European energy costs 2-3x US levels) are rendering vented dryers technologically obsolete. EU eco-design regulations (2024-2027) will restrict vented-dryer energy consumption, making the format uneconomical. New machine sales of vented dryers will decline 60-70% by 2030. Fabric care products designed around vented-dryer chemistry (high-temperature, rapid drying) lose their structural context.\\n\\n**2. Strategic Evaluation.** EU eco-design rules are structurally retiring the vented format; products tuned to its high-temperature, rapid-drying physics lose their context regardless of marketing. This is a clean harvest, not a defense: hold legacy SKUs for the declining installed base with no growth investment, and redeploy Vernel R&D into low-temperature heat-pump and air-dry chemistry where the pool is migrating. The correct read under ceteris paribus is managed decline, with capability and spend flowing to the formats that survive.",
        "id": "lhc.drying.con.traditional-vented-tumble-dryers",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Basic drying racks (commoditized)",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Smart dryers with optimal timing",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (smart dryers with auto-stop and energy optimization) and E-02 (water-scarcity-driven air-dry adoption) are fragmenting the drying-rack market into two tiers: (1) smart/connected racks (IoT humidity control, mobile app integration) and (2) ultra-premium, design-led racks for affluent consumers. The basic commoditized rack (unconnected, no brand positioning) is squeezed and disappears. This is not a Henkel category, but signal is relevant: drying is no longer a commodity moment.\\n\\n**2. Strategic Evaluation.** The commoditized rack is being squeezed out by smart and design-led tiers, but this is not and will not be a Henkel category — there is no consumable hook in a bare rack. Treat it purely as a signal that the drying stage is moving upmarket toward services and managed care, and let that inform where Vernel's freshness chemistry attaches (smart/air-dry occasions). No product action; monitor as a leading indicator, redeploy attention to the chemistry-bearing adjacencies.",
        "id": "lhc.drying.con.basic-drying-racks-commoditized",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Chemical static-removing sprays",
        "type": "product",
        "trendCodes": [
          "G-05"
        ],
        "driverNote": "G-05 Green Claims Directive bans synthetic chemicals",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-05 (green claims directive bans unsubstantiated environmental claims on chemical products) and consumer backlash against synthetic chemistry in home care (C-04, conscious consumption) are removing demand for chemical-based anti-static sprays. Synthetic cationic surfactants marketed as \"anti-static\" face increasing scrutiny for false efficacy claims. Consumers are switching to wool dryer balls and heat-pump dryers that generate less static naturally.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement and conscious-consumption rejection are collapsing demand for synthetic anti-static sprays as wool balls and heat-pump drying displace the need entirely. This is a clean exit with no regret — reformulating to bio-based here chases a use-case that hardware is eliminating, not a chemistry gap worth owning. Harvest residual volume, hold no growth spend, and redeploy any freshness intent into bio-based scent and garment-protection occasions that have a durable pool. Exit the static-spray premise, not just the synthetics.",
        "id": "lhc.drying.con.chemical-static-removing-sprays",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Dryer perfume papers (PVA-based)",
        "type": "product",
        "trendCodes": [
          "G-02"
        ],
        "driverNote": "G-02 Microplastics Ban (polymer particle restrictions)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-14 (PVA biodegradability reclassification petition) is challenging the classification of polyvinyl alcohol (PVA/PVOH) — the water-soluble polymer film used in dryer scent papers and laundry pods — as genuinely biodegradable. Marine biologists and NGOs argue PVA sheds non-degrading nano-plastics in cold-water, low-shear conditions. EU Parliament reclassification is expected 2027-2028, triggering de-listing. This is a regulatory extinction event for PVA-based products.\\n\\n**2. Strategic Evaluation.** Mounting scrutiny of PVA biodegradability puts the entire water-soluble-film scent-paper format under regulatory and reputational risk this decade. The bet is not to defend the carrier but to migrate the function: shift Vernel's scent-delivery chemistry onto compostable, cellulose-based carriers ahead of any reclassification, turning a looming headwind into a bio-based freshness credential. Honest framing — this is risk-managed reformulation of a format Henkel can credibly own on scent, not a claim that timing or outcome is certain.",
        "id": "lhc.drying.con.dryer-perfume-papers-pva-based",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "ironing",
    "label": "Ironing",
    "benefiting": [
      {
        "name": "Garment steamers (replacing irons)",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances + faster convenience trend",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Garment steamers displace the iron as the primary post-wash garment refreshment tool, driven by T-08 (connected appliances enabling precision heat distribution) and the consumer preference for convenience over labor-intensity. The ironing pool migrates from a laundry-stage consumable to an appliance-stage capital investment. Premium brands (Philips, Rowenta) capture margin that once sat in starch and spray categories; FMCG loses the repeat-purchase occasion and must find the new touch point or exit the stage entirely.\\n\\n**2. Strategic Evaluation.** Steamers are structurally displacing the iron, moving value from FMCG consumables into appliance capital — Henkel has no hardware answer and should not pretend to one. The right-to-win is steamer-adjacent chemistry: a pre-steam fabric treatment leveraging Vernel's fibre-conditioning and freshness equity to cut crease-set time and improve finish, co-marketed with steamer brands rather than defending the board. A real but bounded tailwind; own the consumable that rides the appliance, accept the device belongs to others.",
        "id": "lhc.ironing.exp.garment-steamers-replacing-irons",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Anti-wrinkle fabric treatment sprays",
        "type": "product",
        "trendCodes": [
          "T-03",
          "C-04"
        ],
        "driverNote": "T-03 Concentrated Formats + C-04 Conscious Consumption",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Spray-and-wear chemistry collapses the ironing stage into a pre-wearing intervention, eliminating the board and heat entirely. T-03 (concentrated formats) enables lightweight, portable bottles that sit in the dresser or carry in travel bags. C-04 Conscious Consumption rejects the resource cost of ironing, favoring bio-based enzymatic wrinkle releasers over synthetic starch. The pool shifts from appliance-dependent (irons, steamers) to portable, repeatable SKUs.\\n\\n**2. Strategic Evaluation.** Spray-and-wear chemistry collapses ironing into a pre-wearing intervention, shifting the pool from appliance-dependent to portable, repeatable SKUs — a format Henkel can genuinely own. Vernel's fabric-care equity transfers directly into a bio-based enzymatic wrinkle-release spray that answers conscious-consumption rejection of starch and the resource cost of ironing. The durable bet is substantiated, plant-based crease control as a standalone occasion, not a line extension. Modest pool but a credible right-to-win on chemistry where the iron is being abandoned.",
        "id": "lhc.ironing.exp.anti-wrinkle-fabric-treatment-sprays",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Wrinkle-release fabric technologies (apparel)",
        "type": "tech",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI formulations for wrinkle-resistant textiles",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Apparel brands (Uniqlo, H&M, Nike, Lululemon) are embedding wrinkle-release finish chemistry directly into garment fibers at manufacture, using T-01 (AI-optimized finishes) to reduce wrinkle formation by 40-60% without post-wash intervention. The chemistry migrates from the laundry aisle into the textile mill supply chain, away from consumer-facing FMCG entirely. This is a silent pool contraction masquerading as an expansion trend.\\n\\n**2. Strategic Evaluation.** Embedding wrinkle-release finishes at the textile mill moves this chemistry into the apparel supply chain, away from the laundry aisle — an expansion that is, for FMCG, a quiet pool contraction Henkel cannot defend at the fibre-supplier level. The realistic move is a defensive halo, not growth: a credible care claim (Persil/Sil) for protecting performance and tech-finished garments, capturing care-sensitive shoppers who want to preserve the embedded investment. Position to retain the wash relationship; do not chase the mill chemistry.",
        "id": "lhc.ironing.exp.wrinkle-release-fabric-technologies-apparel",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Steam closets / smart garment refresh cabinets",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances + IoT clothing care",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Standalone wardrobe appliances (Electrolux, Samsung, LG prototypes) deploy steam, ozone, or UV sanitization for whole-garment refresh without washing or ironing. T-08 (connected home) integrates with closet sensors that trigger cycles based on wear frequency and environmental humidity. The stage function inverts: instead of preparing garments to wear, the appliance conditions them after wearing. Repeat-purchase chemicals vanish; capital goods replace consumables.\\n\\n**2. Strategic Evaluation.** Refresh cabinets invert the stage — conditioning garments after wear rather than preparing them for it — and over the decade replace consumables with capital goods. Henkel cannot build the cabinet, so the only defensible position is to supply the in-cabinet consumable: a Vernel scent or refresh cartridge for third-party appliances, pursued through genuine consumables partnerships, not exclusivity claims Henkel cannot enforce. A longer-horizon, low-magnitude bet; secure the chemistry slot early, accept the hardware and ecosystem belong to the OEMs.",
        "id": "lhc.ironing.exp.steam-closets-smart-garment-refresh-cabinets",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Portable cordless garment steamers",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation enables compact designs",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Cordless handheld steamers (Philips, Rowenta entry-price SKUs at 2.5M+ units annually in EU) eliminate the power-cord friction that confined irons to a single location. T-05 (manufacturing automation) enables compact, efficient heating elements; consumer adoption of convenience wins over the ironing-board stage entirely. Pool moves from scheduled laundry work to impulse, just-before-wearing interventions.\\n\\n**2. Strategic Evaluation.** Cordless steamers remove the location friction that confined irons, pushing the pool toward impulse, just-before-wearing care — but the device is a commodity appliance Henkel has no claim on. The move is the cross-sell consumable: a Vernel pre-steam fabric treatment placed at steamer purchase and use points, leveraging freshness and conditioning equity to own the recurring chemistry around someone else's hardware. A small, low-conflict adjacency; co-market with steamer brands, do not enter the device.",
        "id": "lhc.ironing.exp.portable-cordless-garment-steamers",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart garment care services (on-demand)",
        "type": "service",
        "trendCodes": [
          "K-04"
        ],
        "driverNote": "K-04 Social Commerce + convenience premium",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Hyper-local garment services (Tide's Laundry Care sub-subscription in select US cities; emerging EU equivalents like Swash and On Demand Laundry) replace consumer washing and ironing entirely with on-demand pickup, professional treatment, and return. K-04 (social commerce) and convenience premiumization drive this segment at 25%+ CAGR among affluent urban 25-45 demographics. The traditional laundry stage is outsourced; FMCG consumables vanish.\\n\\n**2. Strategic Evaluation.** On-demand garment services outsource washing and ironing entirely, vaporizing at-home consumables in the affluent urban segment — Henkel cannot win on service logistics or per-item economics. The defensible play is reverse supply: license Persil and Vernel chemistry to service providers as the branded professional consumable, capturing volume without bearing delivery cost. The durable bet is becoming the trusted formulation behind these services as they scale, a B2B redeployment of brand equity — not a consumer-service entry Henkel has no right to win.",
        "id": "lhc.ironing.exp.smart-garment-care-services-on-demand",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Spray-and-wear anti-wrinkle solutions",
        "type": "product",
        "trendCodes": [
          "C-05",
          "T-03"
        ],
        "driverNote": "C-05 Silver Economy ease-of-use + T-03 Concentrated Formats",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Ultra-convenient spray formats (Fabuloso Cil in Latin America, emerging in EU) target time-poor and aging consumers (C-05 Silver Economy — 50+ consumers spend 25% more on convenience products and have lowest ironing frequency). T-03 concentrated formats reduce weight and toxicity; the spray category is the fastest-growing sub-segment of at-home wrinkle care. Pool is explicitly incremental — new SKU occasion, not substitution.\\n\\n**2. Strategic Evaluation.** An aging, time-poor consumer base with the lowest ironing frequency makes spray-and-wear an explicitly incremental occasion, not a substitution — a genuine new pool. Vernel's fabric-care trust is the credible vehicle for a concentrated, low-toxicity \"no iron required\" format aligned to the Silver Economy's convenience premium. The durable bet is bio-based crease control built for ease-of-use, owning a distinct SKU tier where Henkel's freshness equity transfers cleanly. A real, low-cannibalization tailwind on chemistry Henkel can own.",
        "id": "lhc.ironing.exp.spray-and-wear-anti-wrinkle-solutions",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Traditional irons & ironing boards",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Steamers + smart fabrics displace irons",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Time spent ironing in European households declined 40% from 2010-2024 (Eurostat). T-08 (steamers and smart appliances), fabric innovations reducing wrinkle formation, and the cultural shift away from iron-dependent fashion (athleisure, knitwear, performance fabrics) are structural headwinds. The ironing pool is not migrating to a substitute consumable; it is being abandoned entirely.\\n\\n**2. Strategic Evaluation.** Ironing time has fallen structurally as steamers, wrinkle-reducing fabrics, and athleisure abandon the iron-dependent wardrobe — this pool is not migrating to a consumable, it is being vacated. Henkel holds no iron hardware, so the move is to use the contraction as a forcing event: harvest legacy starch margin with no reinvestment and redirect capability into the spray and steamer-adjacent chemistry where volume is concentrating. The honest read is managed exit of the iron premise, with spend following the consumer to portable care.",
        "id": "lhc.ironing.con.traditional-irons-and-ironing-boards",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Ironing starch sprays (traditional)",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Solid formats + fabric finish technologies",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Starch and sizing chemicals are bound to the iron moment; as ironing contracts, starch sales decline structurally at 5-7% CAGR across the EU. T-03 (concentrated formats) and fabric finish technologies (AI-optimized wrinkle-resistant textiles at manufacture) eliminate the need for starch augmentation. The category is not being replaced — it is disappearing because the ironing stage is disappearing.\\n\\n**2. Strategic Evaluation.** Starch is bound to the iron moment; as ironing contracts and mill-applied finishes spread, the category erodes structurally rather than being substituted. Treat it as a harvest: hold SKUs in price-insensitive heritage markets with advertising and promotion withdrawn, and redeploy the trade envelope into Vernel's bio-based wrinkle-release spray, which serves the same need without the labor liability. Where margin supports it, supply discounters on contract rather than reinvesting. Clean managed decline, with capability flowing to the surviving format.",
        "id": "lhc.ironing.con.ironing-starch-sprays-traditional",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Ironing accessories (covers, pads, stands)",
        "type": "product",
        "trendCodes": [
          "C-06"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze + ironing decline",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Ironing-board covers, pressing pads, and steam-board accessories are secondary to the iron itself; as steamer adoption accelerates (T-08) and ironing-free fashion norms spread, the ironing infrastructure market contracts 8-10% annually. C-06 (cost-of-living squeeze) further depresses discretionary purchases of replacement covers and premium pressing surfaces. The pool is structural erosion, not migration.\\n\\n**2. Strategic Evaluation.** Board covers, pads and stands are secondary infrastructure to a stage being abandoned, with cost-of-living pressure further depressing discretionary replacement — there is no consumable hook and no Henkel right to win. Verify and de-list any licensed SKUs, but treat this purely as a leading indicator confirming ironing-stage contraction. The redeploy is unchanged: accelerate spray and steamer-adjacent chemistry where the consumer is migrating. No product action; monitor and reallocate attention.",
        "id": "lhc.ironing.con.ironing-accessories-covers-pads-stands",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Starch and sizing products (classic)",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI fabrics reduce starch need",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Classic fabric sizing (starch, fabric finish sprays) is bound to the pre-iron or in-wash laundry moment. T-01 (AI-optimized wrinkle-resistant finishes embedded in textiles at manufacture) and the migration away from cotton-dominant, wrinkle-prone wardrobes eliminate the chemistry step. Henkel holds near-zero share in this category (it is a P&G/generic space), but the 6-8% annual contraction is a profit-pool signal to monitor.\\n\\n**2. Strategic Evaluation.** Classic sizing is tied to the pre-iron moment that mill-applied wrinkle finishes and a less wrinkle-prone wardrobe are eliminating; Henkel holds near-zero share, making this an orthogonal macro signal rather than a portfolio exposure. No direct action — read the structural contraction as supporting evidence for redirecting investment into Vernel's bio-based wrinkle-release and steamer-adjacent positioning. A canary for ironing-stage irrelevance, not a target to defend or enter.",
        "id": "lhc.ironing.con.starch-and-sizing-products-classic",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "folding_storing",
    "label": "Folding & Storing",
    "benefiting": [
      {
        "name": "Smart anti-moth & fabric protection",
        "type": "product",
        "trendCodes": [
          "T-01",
          "C-04"
        ],
        "driverNote": "T-01 AI-optimized formula + C-04 Conscious Consumption",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** AI-optimized, bio-based moth-protection formulas (T-01, T-02) using pheromone disruption and botanical actives replace synthetic naphthalene/PDCB mothballs that are being phased out under G-01 (PFAS restriction). E-05 (climate-driven pest shifts) expands geographic risk and drives year-round protection demand in regions previously moth-free. Pool grows as chemistries become science-backed and regulation-compliant.\\n\\n**2. Strategic Evaluation.** Phase-out of naphthalene/PDCB mothballs plus climate-driven, year-round pest spread opens a credible bio-based protection pool. Vernel's freshness equity combined with botanical and pheromone-disruption actives is a plausible right-to-win on a science-backed, regulation-compliant moth-guard format positioned against legacy synthetics and private-label cedar. The durable bet is substantiated, natural-origin garment protection, not heavy synthetic chemistry.",
        "id": "lhc.folding_storing.exp.smart-anti-moth-and-fabric-protection",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Fabric perfumes & closet scents (premium)",
        "type": "product",
        "trendCodes": [
          "C-03",
          "T-17"
        ],
        "driverNote": "C-03 Premiumization in home care + T-17 Neurocosmetic sensory science",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Premium fabric perfumes (Creed, Jo Malone) and science-backed closet scents are capitalizing on T-17 Neurocosmetics (scent engineering for measurable sensory outcomes) and C-03 Premiumization in home care (consumers now pay a clear premium for closet scent products). The segment is growing 12%+ CAGR as fragrance becomes a standalone category anchor within fabric care. Margin is concentrated in premium price-point offerings.\\n\\n**2. Strategic Evaluation.** Premium closet scent is becoming a standalone, high-margin anchor within fabric care as sensory science and home-care premiumization converge. Vernel's freshness and scent equity gives Henkel a credible right to win here, extending into a premium closet-care range built on partnered fragrance science and positioned as holistic closet wellness rather than commodity scent. The durable bet is owning the engineered-freshness narrative at the premium tier — a genuine, low-cannibalization tailwind where Henkel's scent heritage transfers and margin concentrates.",
        "id": "lhc.folding_storing.exp.fabric-perfumes-and-closet-scents-premium",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart wardrobe management apps",
        "type": "tech",
        "trendCodes": [
          "T-07",
          "T-08"
        ],
        "driverNote": "T-07 AI Personalization + T-08 IoT closet sensors",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** AI-powered wardrobe apps (TheOutfitter, Sekitsuyo, Aire) combine T-07 (AI personalization) with T-08 (IoT closet sensors) to optimize outfit selection, track garment care history, and recommend washing frequency based on fabric type and wear patterns. The apps become the decision interface for when and how to launder, shifting brand choice from the consumer to the algorithm. Whoever controls the app interface controls the product recommendation.\\n\\n**2. Strategic Evaluation.** Wardrobe apps increasingly mediate the care decision, shifting brand choice toward the algorithm — whoever holds the interface holds the recommendation. Henkel cannot out-build tech-native players, so the move is discovery-layer presence, not a product: have Persil and Vernel surface as default recommended care within leading apps, with Persil/Somat Smartwash (machine-agnostic) supplying the wash-frequency logic. A low-magnitude tailwind; secure the recommendation slot through partnership, avoid the temptation to build an app Henkel has no right to win.",
        "id": "lhc.folding_storing.exp.smart-wardrobe-management-apps",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Anti-humidity & moisture control devices",
        "type": "tech",
        "trendCodes": [
          "E-02"
        ],
        "driverNote": "E-02 Water Scarcity + climate adaptation",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Electronic and silica-based humidity control (rechargeable dehumidifiers, IoT sensors) protect stored garments from mold, mildew, and odor formation, driven by E-02 (water scarcity consciousness — consumers avoid rewashing) and climate variability. The pool grows as consumers internalize that rewashing is both wasteful and damaging to garments. Devices and refillable absorbents form a recurring-revenue model.\\n\\n**2. Strategic Evaluation.** Humidity control to avoid wasteful rewashing and protect stored garments is a recurring-revenue adjacency, but the dehumidifier hardware is not Henkel's to own. The defensible move is the refillable consumable: Vernel-branded scent or freshness inserts paired with third-party closet dehumidifiers, converting hardware ownership into recurring freshness purchase. Partner on the device, own the cartridge chemistry. A small, low-cannibalization tailwind where Vernel's freshness equity attaches to someone else's hardware.",
        "id": "lhc.folding_storing.exp.anti-humidity-and-moisture-control-devices",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Bio-based garment protection solutions",
        "type": "product",
        "trendCodes": [
          "T-02",
          "C-04"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + C-04 Conscious",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Botanical and fermentation-derived protective chemistries (bio-based moth repellents, natural water-repellents, enzymatic fabric brighteners) replace synthetic PFOAs and microplastic finishes, driven by G-01 (PFAS restriction), G-02 (microplastics ban), and C-04 (conscious consumption). T-02 (bio-based chemistry transition) and T-15 (precision fermentation for ingredient supply) compress the lab-to-shelf cycle from 5 years to 18-24 months, enabling rapid category expansion.\\n\\n**2. Strategic Evaluation.** PFAS and microplastics restrictions plus precision-fermentation supply are compressing bio-based protective chemistry from lab to shelf — a structural tailwind squarely in Henkel's wheelhouse. Sil's enzyme/stain heritage and Vernel's fabric-care equity are the credible vehicles for fermentation-derived moth repellents, natural water-repellents and enzymatic pre-treats, supplied through fermentation partnerships. The durable bet is owning the regulation-compliant, premium alternative to legacy synthetics across closet protection and stain care — a genuine right-to-win on chemistry, not hardware.",
        "id": "lhc.folding_storing.exp.bio-based-garment-protection-solutions",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart storage container systems",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected Appliances + home automation",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** IoT-enabled storage containers (Rubbermaid Brilliance with humidity sensors, emerging smart fabric bags) integrate with T-08 (connected home) ecosystems, tracking garment inventory, humidity levels, and triggering alerts when protection or refreshing is needed. The closet becomes an actively managed system, not a passive wardrobe depository. Recurring service revenue (firmware updates, alerts, protection refills) replaces one-time storage purchases.\\n\\n**2. Strategic Evaluation.** Connected storage turns the closet into a managed system with recurring service revenue, but the container and firmware sit outside Henkel's right to win. The realistic position is ecosystem consumable: Vernel freshness and protection products integrated as the recommended refill within third-party smart-storage systems, secured through genuine partnerships rather than exclusivity claims. A low-magnitude, longer-horizon tailwind; own the consumable slot in the smart-closet value chain, leave the hardware and platform to others.",
        "id": "lhc.folding_storing.exp.smart-storage-container-systems",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Extended-range pest protection products",
        "type": "product",
        "trendCodes": [
          "E-05"
        ],
        "driverNote": "E-05 Climate-Driven Pest Shifts expanding geographic range",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Climate change is shifting moth and carpet beetle distribution northward and year-round in temperate Europe (E-05). Regions previously safe from moth damage (Northern Germany, Scandinavia, UK) now require year-round protection. Market expands geographically — consumers buying moth products for the first time in regions where the category was historically minimal. Pool grows both in depth (higher penetration in existing markets) and breadth (new geographic markets).\\n\\n**2. Strategic Evaluation.** Climate change is pushing moth and beetle risk northward and year-round, opening genuinely new geographies where the protection category barely existed — depth in existing markets and breadth into newly at-risk northern Europe. This rides the same bio-based moth-guard bet: extend Vernel's freshness-anchored, science-backed protection into expanding regions on the climate-risk rationale. A real geographic tailwind, captured with expansion discipline; the right-to-win is the bio-based chemistry, not a new hardware or device play.",
        "id": "lhc.folding_storing.exp.extended-range-pest-protection-products",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Mothballs (chemical, declining appeal)",
        "type": "product",
        "trendCodes": [
          "G-01",
          "C-04"
        ],
        "driverNote": "G-01 PFAS concerns + C-04 Conscious Consumption",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Synthetic naphthalene and paradichlorobenzene (PDCB) mothballs face regulatory headwinds (G-01 PFAS-adjacent restrictions in several EU states) and consumer rejection driven by C-04 (conscious consumption preference for natural alternatives). Henkel holds no mothball SKUs, but the category's 12-15% annual contraction in EU (Circana) signals the end of synthetic moth-protection chemistries. The pool is being cannibalized by bio-based alternatives, not by non-purchasing.\\n\\n**2. Strategic Evaluation.** Regulatory pressure and conscious-consumption rejection are structurally retiring synthetic naphthalene/PDCB mothballs; Henkel holds no SKUs here, so this is a switching opportunity, not a loss. As legacy products de-list, use the category reset as a forcing event in retailer conversations to convert shelf space directly to Vernel's bio-based moth guard. The honest read is a competitor-vacated pool Henkel can capture on a compliant, premium, natural-origin alternative — redeploying toward the bio-based protection thesis, not defending synthetics.",
        "id": "lhc.folding_storing.con.mothballs-chemical-declining-appeal",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Basic storage boxes & organizers",
        "type": "product",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Smart storage obsoletes manual systems",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Passive plastic storage (Rubbermaid, Ikea, Dollar Tree basic containers) is being displaced by T-08 (smart storage systems with sensors and IoT connectivity) and the rise of minimal-inventory fashion (outfit repeating, capsule wardrobes). The basic storage category is not being upgraded within itself; it is being transcended by smarter systems. Profit-pool contraction is structural, not substitutional.\\n\\n**2. Strategic Evaluation.** Passive plastic storage is being transcended by smart systems and minimal-inventory wardrobes, not upgraded within itself — and there is no consumable hook, so no Henkel right to win. Read it purely as a leading indicator of smart-closet adoption velocity, and let that pace the Vernel consumable integrations into managed-storage ecosystems. De-list any licensed SKUs; redeploy development attention to the smart-closet partnerships where freshness and protection chemistry attaches. Monitor, do not enter.",
        "id": "lhc.folding_storing.con.basic-storage-boxes-and-organizers",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Synthetic fragrance closet bars",
        "type": "product",
        "trendCodes": [
          "C-04"
        ],
        "driverNote": "C-04 Conscious Consumption + natural preference",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Traditional synthetic fragrance bars (Reckitt legacy, generic private label) are declining as C-04 (conscious consumption) rejects synthetic VOCs and petrochemical fragrances, and T-17 (neurocosmetics) drives preference for science-backed, subtle scent over heavy synthetic masking. The category loses appeal on both regulatory (G-02 VOC restrictions pending in some states) and sensory grounds. Pool contracts as consumers either buy nothing or trade up to premium natural scents.\\n\\n**2. Strategic Evaluation.** Synthetic fragrance bars are declining on both conscious-consumption rejection of petrochemical scent and the shift toward subtle, science-backed freshness — and Henkel carries minimal legacy share. Treat this as category contraction, not a Henkel loss, and use it to build the case for a premium, natural-origin Vernel closet-scent position as the conscious alternative. The redeploy is to ensure planograms route switching demand from delisted synthetic bars into Vernel's bio-based scent rather than to white space.",
        "id": "lhc.folding_storing.con.synthetic-fragrance-closet-bars",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Wool blanket storage treatments",
        "type": "product",
        "trendCodes": [
          "T-02"
        ],
        "driverNote": "T-02 Bio-Based Chemistry replaces synthetic treatments",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Synthetic wool-protective sprays (mothproofing, fiber softening treatments) are being replaced by T-02 (bio-based alternatives) and increasingly by integrated protective finishes applied at manufacture. The category is small (a marginal EU niche) and declining 8-10% annually as consumers increasingly buy machine-washable wool (tech-treated at the mill) instead of chemically protecting stored blankets. Margin is minimal; pool is specialist.\\n\\n**2. Strategic Evaluation.** Synthetic wool-protective sprays are a small, specialist, declining pool — displaced by bio-based alternatives and machine-washable, mill-treated wool — with no meaningful Henkel involvement. Harvest any legacy product through discount channels and exit cleanly; there is no durable right-to-win in this niche. Redeploy the freed capability into the broader bio-based fabric-protection innovation where Sil's enzyme heritage and Vernel's equity have a real, scalable claim. Managed exit, capability redirected to the protection thesis.",
        "id": "lhc.folding_storing.con.wool-blanket-storage-treatments",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "taking_out",
    "label": "Taking Out of Closet",
    "benefiting": [
      {
        "name": "On-the-go clothing refresh sprays",
        "type": "product",
        "trendCodes": [
          "C-06"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze reduces dry cleaning",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Portable deodorizing sprays (Febreze On The Go, Lysol Fabric Mist, emerging DTC brands) enable between-wearing garment refresh without washing, driven by C-06 (cost-of-living squeeze — consumers extend wash intervals to save water and energy) and outfit-repeating behavior (athleisure culture, capsule wardrobes). The segment is 15-18% CAGR in EU, with Febreze commanding 65% share. Pool is explicitly incremental — new occasion, not cannibalization.\\n\\n**2. Strategic Evaluation.** Outfit-repeating under cost-of-living pressure is creating a genuinely new fabric-care occasion this decade, not cannibalising the wash. The pool to own is the between-wear refresh ritual itself, and Vernel's freshness equity is the natural anchor against an incumbent built on synthetic fragrance load. The structural bet is to make refresh a recognised standalone category Vernel defines rather than a softener line-extension, with bio-based, lower-VOC chemistry as the durable point of difference as aerosol regulation tightens. Ceteris paribus, this is among the higher-conviction new pools for the LHC portfolio.",
        "id": "lhc.taking_out.exp.on-the-go-clothing-refresh-sprays",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Deodorizing mists (quick freshening)",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats enable portable bottles",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Ultra-lightweight, concentrated deodorizing mists (4-6 oz bottles, low impulse price point) enable impulse and travel-use occasions that full-size refresh sprays do not capture. T-03 (concentrated formats) enables very low COGS positioning at premium price-to-use. The segment is fastest-growing within between-wash fabric care (25%+ CAGR among 18-35 consumers), driven by subscription and travel packaging trends.\\n\\n**2. Strategic Evaluation.** Concentrated-format chemistry unlocks a portable, impulse sub-occasion that full-size refresh cannot reach: gym bag, travel, desk drawer. The capability bet is formulation density and a compact delivery system that hold scent and dosing in a small format, extending the Vernel refresh franchise into a higher-frequency carry-along habit rather than launching a separate brand. Strategically this is a penetration and velocity lever on the core refresh pool, won on concentrate know-how Henkel already has, not on a new technology platform.",
        "id": "lhc.taking_out.exp.deodorizing-mists-quick-freshening",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Fragrance refresh boosters (natural)",
        "type": "product",
        "trendCodes": [
          "C-04",
          "T-02"
        ],
        "driverNote": "C-04 Conscious Consumption + T-02 Bio-Based Chemistry",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Bio-based fragrance refresh products (essential oil mists, fermentation-derived aroma molecules, neurocosmetic scents) command 30%+ price premiums over synthetic equivalents, driven by C-04 (conscious consumption), T-17 (neurocosmetics), and T-02 (bio-based chemistry). The segment is expanding into previously non-purchasing households (premium-conscious consumers who ignored legacy Febreze as \"too chemical\") and is growing 20%+ CAGR.\\n\\n**2. Strategic Evaluation.** Conscious-consumption and bio-based chemistry are pulling a premium tier into the refresh pool, opening households that dismissed legacy synthetic refreshers as too chemical. The move is to extend Vernel upward with genuinely bio-derived, naturally-scented refresh chemistry and a transparent ingredient story, converting commodity softener equity into conscious fabric wellness. Where a signature scent needs perfumery credibility Henkel lacks in-house, partner a fragrance house for the aroma layer while owning the formulation and the claim. The bet is defensible premium positioning, substantiated, not a marketing veneer.",
        "id": "lhc.taking_out.exp.fragrance-refresh-boosters-natural",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Fabric care on-demand services",
        "type": "service",
        "trendCodes": [
          "K-04"
        ],
        "driverNote": "K-04 Social Commerce + convenience premium",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Dedicated garment refresh services (on-demand pickup, professional deodorizing, and return within 24 hours) are emerging at premium per-garment price points in major EU cities, serving affluent time-poor consumers. K-04 (social commerce) and convenience premiumization drive adoption at 40%+ CAGR in select urban markets. The service is explicitly incremental — an occasion addition to traditional laundry, not a replacement.\\n\\n**2. Strategic Evaluation.** On-demand garment-refresh services are a real new urban occasion, but the value Henkel can defensibly capture is the chemistry inside them, not the logistics. The bet is to become the branded consumable platform such services run on, supplying Vernel and bio-based deodorising chemistry into their workflow rather than owning pickup and delivery economics Henkel has no right to win. Social-commerce discovery means the brand should travel with the service, so the consumer learns the chemistry is Vernel. A modest but capital-light B2B2C presence in an emerging convenience vertical.",
        "id": "lhc.taking_out.exp.fabric-care-on-demand-services",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart scent dispensers",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 IoT fabric care devices",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Connected scent devices (IoT-enabled sachets with humidity triggers, scheduled release, and app-controlled intensity) address E-02 (water scarcity — scent boosts replace rewashing) and T-08 (connected home integration). Devices achieve 2-3x scent longevity by releasing fragrance only when humidity spikes, reducing consumption and waste. Recurring revenue model: device hardware (capital) + refill cartridges (consumable).\\n\\n**2. Strategic Evaluation.** Connected scent hardware is entering the home, but device manufacture is not Henkel's right to win; the cartridge chemistry is. The bet is a hardware-agnostic consumables play: Vernel-branded refill cartridges compatible across emerging smart-scent and connected-home devices, won on fragrance and freshness performance rather than an exclusive lock to any one platform. This keeps Henkel in the recurring-refill economics and multiplies brand touchpoints without carrying device R&D or obsolescence risk. A small pool, valuable mainly as a foothold in the connected fabric-care ecosystem as routines re-form.",
        "id": "lhc.taking_out.exp.smart-scent-dispensers",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Full re-wash cycle (replaced by refresh)",
        "type": "service",
        "trendCodes": [
          "C-06"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze pressure + water scarcity",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Full re-wash cycles for lightly worn garments are being displaced by refresh sprays and between-wear care products (C-06 cost-of-living squeeze incentivizes one-wearing intervals without laundering; E-02 water scarcity makes rewashing economically and environmentally irrational). The traditional laundry occasion is contracting as outfit-repeating culture and water-conservation norms harden. This is a structural contraction in wash frequency, not a substitution within the wash itself.\\n\\n**2. Strategic Evaluation.** The displacement of full re-washing for lightly worn garments is a structural shift in wash frequency that Henkel should ride, not resist. The harvest-and-redeploy logic is to let detergent volume soften gracefully while migrating value into the higher-margin refresh and between-wear occasion the same trend creates, so the portfolio follows the consumer rather than defending a declining number of cycles. The core wash stays the premium-deep-clean job when it does occur; refresh captures the new intervals. Read this as reallocation within Henkel's own pools, not lost demand, under the no-management-response assumption.",
        "id": "lhc.taking_out.con.full-re-wash-cycle-replaced-by-refresh",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Heavy synthetic fragrance products",
        "type": "product",
        "trendCodes": [
          "C-04"
        ],
        "driverNote": "C-04 Conscious Consumption shift to subtle",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Heavily fragranced fabric products (synthetic VOC-laden formulations, especially mass-market Febreze and Lysol variants) face structural headwinds from C-04 (conscious consumption preference for subtle, natural scent) and T-17 (neurocosmetics shift from overwhelming fragrance to measured sensory outcomes). Regulatory winds (pending EU VOC restrictions on consumer-use aerosols) further compress the heavy-scent category. Pool contracts as purchasing shifts to natural and neurocosmetic alternatives.\\n\\n**2. Strategic Evaluation.** Heavy synthetic-fragrance fabric products face a converging squeeze from conscious-consumption taste and tightening VOC and aerosol rules. The redeploy move is to treat the contracting heavy-scent pool as a conversion source: position Vernel refresh as the subtle, science-backed successor and pull defecting volume toward real-fragrance, lower-VOC chemistry. This is a harvest of declining demand into a cleaner Henkel proposition, executed through honest reformulation and claims rather than out-fragrancing the incumbent on its own terms. The shift rewards transparency, which favours an enzymatic-and-natural story over masking.",
        "id": "lhc.taking_out.con.heavy-synthetic-fragrance-products",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Conventional dry cleaning services",
        "type": "service",
        "trendCodes": [
          "C-06",
          "E-02"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze + E-02 sustainability",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Full-service dry cleaning (chemical-based pressing, solvent treatment) is contracting 5-7% CAGR in EU as C-06 (cost-of-living squeeze — per-garment dry cleaning is a luxury good under inflation) and E-02 (water scarcity and chemical waste concerns) drive consumers to home-care alternatives. The category is not being replaced by a cheaper service; it is being displaced by on-home refresh and care. Margin is concentrated in premium garments for affluent consumers — a shrinking addressable base.\\n\\n**2. Strategic Evaluation.** Conventional dry cleaning is contracting structurally as affordability pressure and water-and-solvent concerns push consumers toward home care, leaving a shrinking premium-garment base. Henkel rides this by positioning home-care chemistry, Vernel refresh and Sil pre-treatment, as the credible everyday alternative for the occasions leaving the dry-cleaner, capturing migrating demand into higher-frequency, higher-margin home routines. The strategic posture is to absorb the displaced occasion rather than mourn the service, framing home care as the practical substitute for all but genuinely specialist garments. A redeploy of a declining service pool into owned consumable chemistry.",
        "id": "lhc.taking_out.con.conventional-dry-cleaning-services",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "wearing",
    "label": "Wearing",
    "benefiting": [
      {
        "name": "Anti-stain / anti-odor smart textiles",
        "type": "tech",
        "trendCodes": [
          "T-01",
          "T-02"
        ],
        "driverNote": "T-01 AI-optimized fiber coatings + T-02 Bio-Based",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 AI-driven fiber coatings suppress stain and odor formation at the molecular level, preventing damage before it occurs. This shifts the pool from post-damage remediation to pre-damage protection. T-02 bio-based binders replace PFAS chemistry, enabling premium positioning. Whoever locks the textile supply chain into proprietary chemistry wins the garment lifecycle profit.\\n\\n**2. Strategic Evaluation.** Smart-textile coatings shift the garment-lifecycle pool upstream, from remediating damage after the fact to preventing it at the fibre. The durable bet is to be the chemical anchor in that supply chain: pair Sil's enzyme heritage and Persil performance science with fibre and textile makers to embed bio-based, PFAS-free anti-stain and anti-odour chemistry into the cloth itself before a competitor locks exclusivity. Owning the chemistry layer, not the textile, is where Henkel's right to win sits. If proprietary coatings standardise without Henkel inside, re-entry later becomes acquisition-dependent rather than organic.",
        "id": "lhc.wearing.exp.anti-stain-anti-odor-smart-textiles",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Garment protection nano-coatings",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + T-01 nano-formulations",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 and T-02 enable ultra-thin bio-based nano-coatings that repel stains and weather without PFAS chemistry (G-01). Coatings persist through 5-10 washes, justifying a clear per-garment premium. Pool dynamics: protective coatings are marginal-cost add-ons to existing laundry, not substitutions — they expand profit without cannibalizing core wash sales. Scotchgard's exit accelerates market opening.\\n\\n**2. Strategic Evaluation.** PFAS restriction is voiding the old durable-water-repellent pool just as bio-based nano-coatings mature, and EU garment-longevity policy gives protection a regulatory rationale beyond convenience. The bet is consumer-applied, spray-on protective chemistry that survives multiple wash cycles, carried into market on Vernel's fabric-care credibility so the proposition reads as care, not industrial coating. Seeding through laundry and dry-cleaning channels first can build proof and halo before broad retail. This is incremental protection spend layered onto existing laundry, expanding the pool rather than cannibalising the wash, won on green chemistry.",
        "id": "lhc.wearing.exp.garment-protection-nano-coatings",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Textile softeners (beyond wash cycle)",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats enable targeted application",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 concentrated formats enable leave-on fabric softeners applied after wash or drying — not during it. This expands the softening pool from single in-wash occasion per load to a multi-product care chain (Conditioning Spray, Dryer Sheets, Closet Mist) that compounds frequency and basket size. Zero cannibalization: the washing machine pool does not shrink when softener spend migrates to post-wash formats.\\n\\n**2. Strategic Evaluation.** Concentrated leave-on formats let softening escape the drum and become a multi-touch care chain: conditioning spray, dryer formats, closet mist. The bet is to own conditioning after the wash as deliberately as the incumbent owns in-drum scent boosters, extending Vernel's softening franchise to the large tumble-dry and post-wash population without shrinking the in-wash pool. Existing in-wash distribution and softener credibility are the unfair advantage to convert into the post-wash occasion. The prize is added care frequency and basket, captured by being first to define softening as a chain rather than a single load step.",
        "id": "lhc.wearing.exp.textile-softeners-beyond-wash-cycle",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Clothing repair kits & devices",
        "type": "product",
        "trendCodes": [
          "C-04"
        ],
        "driverNote": "C-04 Conscious Consumption + garment lifecycle extension",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 conscious consumption and E-08 textile longevity regulation converge: consumers pay a modest premium to extend garment life via repair kits. The repair pool is incremental to washing — it increases Henkel's touch frequency per garment. Indie brands (Patagonia, The Repair Shop) have proven meaningful annual demand in Europe. HCB has zero presence here.\\n\\n**2. Strategic Evaluation.** Conscious consumption and textile-longevity policy are turning garment repair into a paid, incremental occasion that raises Henkel's touch frequency per garment, an adjacency where Henkel has no asset and should not build hardware. The sensible bet is to attach Persil and Vernel as the care components of a wash-protect-repair lifecycle bundle alongside credible repair partners, adding presence at near-zero NPD cost. Positioning is full-garment-life stewardship, with Henkel owning the chemistry and partners owning the mending craft. A small but on-strategy extension of the longevity narrative rather than a category Henkel leads.",
        "id": "lhc.wearing.exp.clothing-repair-kits-and-devices",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Fashion lifecycle services (repair/resale)",
        "type": "service",
        "trendCodes": [
          "K-07"
        ],
        "driverNote": "K-07 Professional Salon Crossover extends to fashion",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-07 professional crossover extends to fashion: laundry subscription boxes, garment refreshment bundles, and repair-to-resale marketplaces are premium consumer services in UK and Germany. Service pool is recurring subscription revenue on top of SKU sales, not incremental product sales. C-04 conscious consumption drives willingness to pay a recurring fee for wardrobe-utility services.\\n\\n**2. Strategic Evaluation.** Repair, refresh and resale are bundling into recurring wardrobe-utility services that conscious consumers will subscribe to, with revenue sitting on top of SKU sales rather than inside them. The bet is to own wardrobe longevity as the service narrative, attaching Vernel refresh and care chemistry to subscription and resale partners so Henkel is the care layer of the circular-fashion stack without operating the marketplace. This differentiates from scent-led rivals on durability and stewardship. The move is partnership-led presence in a recurring-revenue model, not Henkel building the platform; value is foothold and frequency, modest but strategic.",
        "id": "lhc.wearing.exp.fashion-lifecycle-services-repair-resale",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Stain-guard pre-treatment services",
        "type": "service",
        "trendCodes": [
          "C-03",
          "K-07"
        ],
        "driverNote": "C-03 Premiumization + K-07 Professional services",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-07 professional crossover creates service channels: laundry services and dry-cleaners upsell stain-guard pre-treatment as professional expertise, not consumer DIY. C-03 premiumization supports a per-garment upcharge for guaranteed protection. Pool is service revenue on top of existing laundry economics. Sil's stain removal heritage gives HCB credibility as chemistry partner.\\n\\n**2. Strategic Evaluation.** Professional-to-consumer crossover lets laundries and cleaners upsell stain-guard pre-treatment as expertise, and premiumisation supports the upcharge; Sil's stain-removal heritage gives Henkel the right to be the chemistry behind it. The bet is to license and supply Sil enzyme science to professional laundry channels as the recommended pre-treatment, capturing service-attached volume rather than competing on consumer DIY. Henkel provides the validated chemistry and training; the operator provides the guarantee and credibility. A defensible high-tailwind position built on heritage IP, won by being the science partner the trade standardises on first.",
        "id": "lhc.wearing.exp.stain-guard-pre-treatment-services",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Garment-longevity care claims aligned to EU textile mandates",
        "type": "product",
        "trendCodes": [
          "G-12",
          "E-08"
        ],
        "driverNote": "G-12 EU circular-textile mandates + E-08 garment life extension — care products as longevity enablers",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-12 (+E-08): the EU Textile Strategy's garment-longevity requirements make 'clothes that last' a regulated objective, not just a consumer preference — and fabric care is the use-phase enabler (colour protection, fibre care, low-temperature washing all measurably extend garment life). The wearing stage gains a regulatory tailwind for longevity-positioned care claims.\n\n**2. Strategic Evaluation.** The EU Textile Strategy makes clothes-that-last a regulated objective, and use-phase care, colour protection, fibre care, low-temperature washing, is a measurable longevity enabler, turning a compliance burden for apparel into a claims platform for Henkel. The bet is to substantiate garment-life-extension claims for Persil and Perwoll to recognised evidence standards and co-market them with apparel brands now obliged to demonstrate durability. This is the rare regulation that funds a marketing message: Henkel's longevity chemistry becomes the proof point in someone else's mandate. Ceteris paribus, a low-headline but durable, defensible tailwind anchored to policy.",
        "id": "lhc.wearing.exp.garment-longevity-care-claims-aligned-to-eu-text",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Fast fashion disposable garments",
        "type": "product",
        "trendCodes": [
          "C-04",
          "G-06"
        ],
        "driverNote": "C-04 Conscious Consumption + G-06 Deforestation Reg",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 conscious consumption and G-06 deforestation regulation systematically defund the fast-fashion pool. Regulatory tariffs and retailer delisting compress the occasion. Pool shifts to second-hand, rental, and durable-premium segments where garments are worn 50+ times instead of 5. Laundry care frequency increases per garment, but total garment volumes decline — structural reallocation, not shrinkage.\\n\\n**2. Strategic Evaluation.** Conscious consumption and tightening regulation are defunding disposable fast fashion, reallocating wear toward fewer, longer-lived, more-cared-for garments, fewer items but more care events each. Henkel rides this by positioning Persil and Perwoll plus protection as a garment-life-extension system rather than commodity wash, capturing the rising care intensity per durable garment as total garment volumes fall. The posture is to follow value into the longevity segment, not defend disposable-linked volume. A reallocation to ride upmarket, consistent with the textile-longevity thesis, rather than a pool simply lost.",
        "id": "lhc.wearing.con.fast-fashion-disposable-garments",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Single-use stain wipes (plastic)",
        "type": "product",
        "trendCodes": [
          "G-04",
          "G-02"
        ],
        "driverNote": "G-04 PPWR + G-02 Microplastics regulation",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-04 PPWR and G-02 microplastics regulations create a delisting cliff for plastic stain wipes by 2027-28. Category reformulates, not shrinks. Retailers delist plastic without replacement unless branded spray alternative exists on shelf at listing-decision time. First-movers with credible spray substitutes capture migration. Competitors holding only plastic formats (Unilever) lose shelf space.\\n\\n**2. Strategic Evaluation.** Packaging and microplastics regulation create a delisting cliff for plastic stain wipes, and the category reformulates rather than disappears: shelf migrates to whoever has a credible non-plastic substitute ready at the retailer's reset. The redeploy bet is to have Sil spray-format pre-treatment, on bio-based chemistry, positioned to inherit that facing as wipes are removed. Note the factual correction for management: Vanish and Finish are retained Reckitt powerbrands, not private-equity-owned, so any first-mover thesis rests on Henkel's own readiness and green-chemistry credentials, not on a competitor being structurally slow. Regulation-driven substitution into an owned format.",
        "id": "lhc.wearing.con.single-use-stain-wipes-plastic",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Quick-fix synthetic patches",
        "type": "product",
        "trendCodes": [
          "G-05"
        ],
        "driverNote": "G-05 Green Claims Directive bans misleading claims",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-05 Green Claims Directive crackdown exposes \"quick-fix\" patch claims to regulatory challenge — temporary patches cannot claim permanent repair. Category contracts as false claims trigger retailer delisting. Only products with genuine durability claims survive. Indie repair brands (Patagonia, The Repair Shop) have science; FMCG patch brands do not.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement exposes temporary quick-fix patches that cannot honestly claim durable repair, contracting the pool toward genuine, substantiated repair. Henkel should not defend this format; the redeploy is to position Sil as the preparation chemistry, cleaning and conditioning garments ahead of legitimate professional or kit-based repair, supplying credible chemistry to credible menders. This keeps Henkel in the longevity value chain while sidestepping the false-claims regulatory minefield entirely. A clean harvest-and-exit: abandon the exposed format, redeploy the brand's role to where the claims are defensible and the chemistry is real.",
        "id": "lhc.wearing.con.quick-fix-synthetic-patches",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Chemical-heavy protective sprays",
        "type": "product",
        "trendCodes": [
          "G-01"
        ],
        "driverNote": "G-01 PFAS-based water repellents restricted",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-01 PFAS restriction terminates the Scotchgard-era protective spray era across EU. Fluorocarbon DWR chemistry vanishes from shelves as formulations cannot reformulate in time for 2026-27 compliance. Pool drains to whoever has a PFAS-free bio-based protection spray already validated and market-approved. Scotchgard's exit accelerates the shelf gap opening.\\n\\n**2. Strategic Evaluation.** PFAS restriction terminates the fluorocarbon protective-spray era across the EU, draining the pool toward whoever already has a validated PFAS-free alternative on shelf at compliance time. The redeploy bet is bio-based protective chemistry, durability proven over repeated washes, carried on Vernel's fabric-care equity so the switch reads as cleaner-and-safer rather than a downgrade. Readiness ahead of the delisting window is the whole game; the consumer signal is non-toxicity, which Henkel's freshness brand can credibly carry. This converts a regulatory contraction in legacy chemistry into one of the clearer green-chemistry openings in the wearing stage.",
        "id": "lhc.wearing.con.chemical-heavy-protective-sprays",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "between_washes",
    "label": "Between Washes",
    "benefiting": [
      {
        "name": "Fabric refresh sprays (concentrated)",
        "type": "product",
        "trendCodes": [
          "T-03",
          "C-06"
        ],
        "driverNote": "T-03 Concentrated Formats + C-06 Cost-of-Living",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 concentrated formats transform economics: 250ml bottle delivers 100+ applications vs. Febreze's dilute 400ml delivering 40 applications. Concentrated refresh is margin-compression for Febreze but margin-expansion for first-mover challenger. C-06 cost-of-living pressure makes per-application pricing a consumer decision factor. Pool is 8-10% CAGR (C-14); question is who captures growth margin.\\n\\n**2. Strategic Evaluation.** Concentrated chemistry rewrites refresh economics, more applications per bottle, which is margin compression for dilute incumbents but expansion for a challenger that leads with it. Within the structurally new between-wash occasion, the bet is to make Vernel the concentrate standard-bearer, winning on cost-per-application transparency that cost-of-living-conscious consumers now weigh, backed by Vernel's freshness heritage and in-wash distribution for cross-promotion. The strategic point is to define the concentrated refresh sub-category before the incumbent reformulates to match, owning the value-per-use frame. A high-conviction lever inside Henkel's biggest fabric-care white space.",
        "id": "lhc.between_washes.exp.fabric-refresh-sprays-concentrated",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "On-the-go freshener/anti-static mists",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated Formats + convenience trend",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 portable concentrates enable travel-size mists (75ml spray bottles) delivering 30+ applications — a new carry-along convenience occasion. Febreze has not entered portable; Batiste's dry shampoo success (C-15) proves format demand in hair. Laundry has zero portable competitor presence. Trial-size SKUs lock repeat purchase behavior.\\n\\n**2. Strategic Evaluation.** Portable concentrates open a carry-along wardrobe-emergency occasion, anti-static plus freshness, that no laundry incumbent currently occupies, while dry-shampoo's portable success in hair proves the format demand. The bet is to extend Vernel into a travel and on-the-go mist that builds a high-frequency, trial-led habit distinct from the at-home refresh bottle. Low formulation cost, meaningful repeat potential, and an uncontested portable niche make this a penetration play: first credible portable laundry-refresh entry secures the habit and the channel. Differentiated from the core range by occasion and format, not duplicated.",
        "id": "lhc.between_washes.exp.on-the-go-freshener-anti-static-mists",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Portable garment steaming devices",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation enables compact design",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 manufacturing automation compresses portable steamer design cycles: Philips, Rowenta, and Chinese appliance makers launch compact hand-held steamers at accessible price points for travel and touch-up. Every steamer requires fabric conditioning liquid to prevent residue and enhance finish. No branded fabric care chemistry is currently locked into this appliance category.\\n\\n**2. Strategic Evaluation.** Compact steamers are proliferating across appliance makers, and every steam touch-up benefits from conditioning chemistry that prevents residue and improves finish, a consumable layer no branded fabric-care player currently owns. Henkel has no right to win in device hardware, so the bet is a refill-and-consumable model: Vernel-branded conditioning liquid developed for portable steamers, captured through OEM partnership rather than building appliances. The device is the partner's profit; the recurring refill chemistry is Henkel's. A modest pool whose value is establishing the conditioning consumable as a standard accessory to an expanding device category.",
        "id": "lhc.between_washes.exp.portable-garment-steaming-devices",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart refreshing cabinets / steam closets",
        "type": "tech",
        "trendCodes": [
          "T-08",
          "T-01"
        ],
        "driverNote": "T-08 Connected Appliances + T-01 optimization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 connected appliances and T-01 AI optimization spawn smart closets with integrated steaming, humidity control, and fabric care delivery (Miele SmartCare Lab, Samsung AirDresser). Devices auto-dispense fabric care during garment cycles. Appliance makers currently partner with P&G and Unilever on default-chemistry agreements; HCB has no partnership locked.\\n\\n**2. Strategic Evaluation.** Smart refreshing cabinets and steam closets fold steaming, humidity control and fabric-care dispensing into one appliance, with chemistry dispensed during the cycle, and appliance makers default that chemistry to whoever partners first. Henkel should not build the cabinet; the bet is to be the default fabric-care fluid inside it via co-development with appliance partners, leveraging existing OEM relationships to set the chemistry standard before rivals lock it. Hardware is the partner's; the recurring care liquid is Henkel's. Whoever anchors the first credible partnership shapes the architectural default, so presence early matters more than the near-term pool size.",
        "id": "lhc.between_washes.exp.smart-refreshing-cabinets-steam-closets",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "UV garment sanitizers (portable)",
        "type": "tech",
        "trendCodes": [
          "T-18",
          "C-30"
        ],
        "driverNote": "T-18 Bathroom & laundry-room IoT + C-30 longevity home-hygiene demand",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Re-based June 2026: the original post-COVID-hygiene driver (C-12) was retired from the trend base in v3.1 as normalised. The durable demand vectors are T-18 (bathroom/laundry-room IoT — UV-C wands and sanitizing appliances from Philips, Larq entering the connected home stack) and C-30 (the longevity economy's home-hygiene dimension: health-span-motivated consumers investing in preventive home sanitation). These devices sanitize but do not freshen or condition — fabric-care chemistry remains a separate, complementary purchase.\\n\\n**2. Strategic Evaluation.** Portable UV sanitisers are entering the connected-laundry-room stack on durable longevity-and-home-hygiene demand, but they sanitise without freshening or conditioning, leaving fabric-care chemistry a separate, complementary purchase. The bet is to position Vernel as the care layer of the sanitised-garment routine, care for what the sanitiser cannot, through co-marketing and bundle placement alongside device makers rather than competing on hardware Henkel has no reason to own. Validating that the chemistry does not degrade under UV would let Henkel own the compatibility science. A small pool; the real value is a seat in the re-forming connected-home laundry routine.",
        "id": "lhc.between_washes.exp.uv-garment-sanitizers-portable",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Dry shampoo for clothes (spray)",
        "type": "product",
        "trendCodes": [
          "T-03",
          "C-06"
        ],
        "driverNote": "T-03 Concentrated Formats + C-06 Cost-Saving",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Batiste dry shampoo grows 7%+ CAGR in hair and carries 40%+ of texture/styling segment (C-15). This is the laundry equivalent: spray that refreshes garment texture and extends wear intervals without full laundering. T-03 concentrated format enables 100ml bottle delivering 50+ applications. C-06 cost-of-living pressure drives trial. Febreze has zero dry-refresh positioning.\\n\\n**2. Strategic Evaluation.** Dry shampoo's proven pull in hair points directly to a laundry analogue: a dry-refresh spray that restores garment texture and stretches wear intervals without a full wash, enabled by concentrated formats and pulled forward by cost-of-living trial. The bet is to translate the hair playbook into fabric, with Vernel's softening heritage underwriting safe, residue-free application on jeans and knitwear, owning the dry-refresh frame the incumbent has left open. This is texture-and-interval extension, a different job from scent refresh, so it widens the between-wash repertoire rather than duplicating the standard spray. A high-conviction format adjacency.",
        "id": "lhc.between_washes.exp.dry-shampoo-for-clothes-spray",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Odor-elimination enzyme sprays",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + T-01 enzyme optimization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 bio-based enzyme chemistry and T-01 AI-driven enzyme optimization compress lab-to-market cycles. Sil's stain-removal enzyme heritage gives HCB credible science narrative that P&G (Febreze masking-fragrance) and Reckitt (Air Wick, declining investment) cannot match. Enzyme-based odor elimination is objectively superior to chemical masking; C-04 conscious consumption favors transparency. Pool migrates toward science-backed chemistry.\\n\\n**2. Strategic Evaluation.** The decisive technological fork in between-wash care is odour elimination versus fragrance masking: bio-based enzyme chemistry digests odour molecules rather than covering them, and AI-assisted enzyme development shortens the path to market. This is Henkel's sharpest right-to-win in the stage, Sil's stain-removal enzyme heritage gives a credible elimination story masking-fragrance incumbents structurally cannot tell, and conscious-consumption taste rewards the transparency. The bet is to own elimination as a category claim, third-party-validated, aimed at performance-minded and athleisure users who distrust masking. Where rivals own covering up, Henkel can own actually removing, a genuinely differentiated chemistry position.",
        "id": "lhc.between_washes.exp.odor-elimination-enzyme-sprays",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Smart garment freshness alerts (app)",
        "type": "tech",
        "trendCodes": [
          "T-08",
          "T-07"
        ],
        "driverNote": "T-08 Connected Appliances + T-07 AI tracking",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 connected appliances and T-07 AI personalization enable Smartwash ecosystem notifications: \"Your jeans worn 3 times since last wash — freshen or launder by day 5.\" App becomes interface for Vernel refresh recommendations, serving as conversion funnel for between-wash spray purchases. Software + hardware lock-in creates moat that branded SKUs alone cannot. Pool is software-enabled recurring revenue.\\n\\n**2. Strategic Evaluation.** Connected appliances and AI personalisation enable freshness-timing intelligence, prompting when to refresh versus launder, that can route consumers toward between-wash refresh at the moment of need. The bet is a chemistry-plus-data layer: make Vernel the recommended refresh within connected-laundry experiences, converting timing guidance into a refresh habit, built on machine-agnostic data and chemistry rather than any device lock-in. The relevant Henkel detergent platforms work in any machine, so the proposition must stay open-ecosystem and software-light, not framed as OEM-exclusive. The durable asset is owning the refresh recommendation, not building a standalone app; a modest, software-enabled adjunct to the refresh pool.",
        "id": "lhc.between_washes.exp.smart-garment-freshness-alerts-app",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Branded fabric refresh spray range",
        "type": "product",
        "trendCodes": [
          "C-14"
        ],
        "driverNote": "C-14 Between-Wash Fabric Care (Market Gap score 0.82)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-14 between-wash fabric care scores 0.82 (highest white space, 8-10% CAGR). Febreze is a multi-billion brand globally; the European market is a sizeable pool and accelerating as outfit repeating becomes baseline. Henkel has zero position where P&G Febreze dominates and Reckitt Air Wick (divested, under-invested) is the only European challenger.\\n\\n**2. Strategic Evaluation.** Between-wash fabric care is the headline white space of the decade, an occasion becoming baseline as outfit-repeating normalises, where Henkel currently has no position and the European challenger field is thin. The structural bet is to establish a full branded Vernel refresh range that defines the category on freshness and, increasingly, elimination chemistry rather than masking, cross-merchandised with Persil as a complete garment-care system. Building the franchise and distribution before incumbents reframe or rivals respond is the whole opportunity. Ceteris paribus, this is among the highest-return new-pool entries in the LHC portfolio, the anchor the other refresh tiles extend from.",
        "id": "lhc.between_washes.exp.branded-fabric-refresh-spray-range",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Antibacterial garment hygiene sprays",
        "type": "product",
        "trendCodes": [
          "C-30",
          "T-02"
        ],
        "driverNote": "C-30 longevity home-hygiene demand + T-02 bio-based antimicrobial actives",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Re-based June 2026: the retired post-COVID driver (C-12) is replaced by the structural one — C-30, the longevity economy's home-hygiene dimension, where health-span-motivated households treat garment hygiene as preventive health rather than pandemic residue. T-02 bio-based antimicrobial actives (enzyme proteins, plant-derived systems) enable premium pricing with a clean-chemistry story; the pool is additive to refresh sprays — safety positioning on top of sensory freshness.\n\n**2. Strategic Evaluation.** Garment hygiene is shifting from pandemic residue to a durable, longevity-economy concern, treated as preventive home health, and bio-based antimicrobial actives let it carry a clean-chemistry story rather than synthetic-biocide baggage. The bet is a hygiene tier layered onto refresh, safety positioning on top of sensory freshness, built on substantiated bio-antimicrobial claims aligned with conscious-consumption expectations, aimed at health-minded households, families and fitness use. The gating constraint here is regulatory perimeter, not demand: the claim set must be validated against EU biocide rules early. An additive premium tier on the refresh pool, distinct from the core freshness proposition.",
        "id": "lhc.between_washes.exp.antibacterial-garment-hygiene-sprays",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Full wash cycle (over-washing declining)",
        "type": "service",
        "trendCodes": [
          "C-06",
          "E-02"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze + E-02 water scarcity",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-06 cost-of-living squeeze and E-02 water scarcity compress wash frequency: cash-constrained and environmentally conscious consumers reduce loads from 2-3 per week to 1-2. Between-wash products nominally expand intervals, but in tight budgets they substitute, not supplement. Pool contracts when between-wash spray adoption cannibalizes wash-occasion frequency faster than new occasions are created. Strategic risk, not inevitability.\\n\\n**2. Strategic Evaluation.** Affordability and water scarcity are compressing wash frequency, and the genuine risk is that in tight budgets between-wash refresh substitutes for washing rather than supplementing it, contracting both pools at once. The disciplined response is to frame refresh explicitly as a resource-saving complement, extend intervals and cut water and energy, positioning the wash as the periodic deep clean and refresh as the in-between, so Henkel captures the new occasion without accelerating its own detergent decline. Managing this is messaging and portfolio discipline, not a new product: ride the frequency shift deliberately so reallocation stays inside Henkel's pools rather than leaking value.",
        "id": "lhc.between_washes.con.full-wash-cycle-over-washing-declining",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Fabric de-wrinkling gadgets (niche)",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Smart steamers + garment tech displaces niche",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 smart steamers displace niche de-wrinkling gadgets by integrating function into broader appliances. Portable steamers (T-05 compact manufacturing) deliver equivalent function at lower price and higher versatility than single-use gadgets. Niche gadget pools contract as integration consolidates category. Not a demand decline — competitive concentration where generalist products outcompete specialists.\\n\\n**2. Strategic Evaluation.** Single-function de-wrinkling gadgets are being absorbed as steaming integrates into versatile portable and built-in appliances, a competitive concentration where generalist hardware outcompetes niche devices rather than a demand decline. Henkel has no reason to defend standalone gadget positioning; the redeploy is to attach Vernel as the recommended conditioning chemistry to the portable-steamer OEMs winning the consolidation, shifting Henkel from would-be gadget player to consumable supply partner with recurring refill economics. Niche gadget marketers cannot follow, lacking the appliance relationships. A clean pivot from a contracting device niche into the chemistry layer of the format that replaces it.",
        "id": "lhc.between_washes.con.fabric-de-wrinkling-gadgets-niche",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Heavy synthetic fabric refreshers",
        "type": "product",
        "trendCodes": [
          "C-04",
          "G-05"
        ],
        "driverNote": "C-04 Conscious Consumption + G-05 Green Claims",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 rejects heavy synthetic fragrance; G-05 penalizes vague \"natural\" claims. Heavy synthetic refreshers face credibility crisis as consumers distrust opaque blends. Pool contracts toward transparent, bio-based alternatives. Febreze's synthetic-fragrance model becomes a liability.\\n\\n**2. Strategic Evaluation.** Heavy synthetic refreshers are squeezed from both sides, conscious-consumption taste rejecting opaque blends and green-claims enforcement penalising vague natural assertions, contracting the pool toward transparent, substantiated chemistry. The redeploy is to lead Vernel refresh with light, transparent, bio-based formulation and an honestly communicated mechanism, enzymes digesting odour, natural scent rather than masking, with actives disclosed on-pack. This converts the contraction into a wedge: position cleanly against the synthetic-fragrance model and capture defecting volume in premium and health-conscious segments. The shift rewards exactly the elimination-and-transparency chemistry Henkel can substantiate, turning a declining format into share for a credible successor.",
        "id": "lhc.between_washes.con.heavy-synthetic-fabric-refreshers",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  }
];

export const HAIR_JOURNEY: JourneyStageDef[] = [
  {
    "id": "inspire",
    "label": "Inspire",
    "benefiting": [
      {
        "name": "Shade finders & AR try-on tools",
        "type": "tech",
        "trendCodes": [
          "T-07",
          "T-01"
        ],
        "driverNote": "T-07 AI Personalization + T-01 color simulation",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Shade discovery is migrating from the shelf to the device. T-07 (AI personalization) collapses the match-and-compare cycle into a single algorithmic recommendation; T-01 (AI formulation) enables formulators to simulate color outcomes with hair-type precision. Once a consumer trusts the camera, the shade choice leaves the shelf entirely and moves to whoever controls the diagnostic-to-product path — L'Oréal Modiface leads but its mass-market precision lags salon-grade accuracy.\\n\\n**2. Strategic Evaluation.** Shade discovery is migrating off the shelf into the camera this decade, and whoever owns the trusted match owns the consideration set before the consumer ever reaches retail. L'Oréal's Modiface sets the benchmark; HCB cannot out-spend it but can out-position it on accuracy where it has a genuine asset — Schwarzkopf Professional's salon colour-science and the Igora shade corpus. The bet is to own the diagnostic-to-shade path as a credibility play, not to ship another generalist AR mirror that competes on platform reach alone.",
        "id": "hair.inspire.exp.shade-finders-and-ar-try-on-tools",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Style inspiration apps & platforms",
        "type": "tech",
        "trendCodes": [
          "K-04",
          "T-07"
        ],
        "driverNote": "K-04 Social Commerce + T-07 AI Personalization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Discovery through curated styling is a new occasion — not color, but the creative look that inspires purchase. T-07 (AI personalization) lets platforms learn from user behavior, recommending not just products but moods and occasions. K-04 (social commerce) collapses inspiration-to-cart in a single tap, capturing the impulse moment before brand comparison starts. The pool here is incremental to core color and care — it funds aspirational styling habits.\\n\\n**2. Strategic Evaluation.** Styling inspiration is a distinct, expanding entry point — the aspirational look, not the shade — and the pool accrues to whoever sits at that mental-availability moment as social commerce collapses inspiration into purchase. HCB's right-to-win is got2b's youth and creator equity, not a proprietary destination app it would have to acquire users for against incumbent platforms. The durable bet is owning the styling occasion inside the platforms consumers already live in and converting that salience into finishing-product attach, rather than building a standalone walled garden.",
        "id": "hair.inspire.exp.style-inspiration-apps-and-platforms",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Creator & community platforms",
        "type": "service",
        "trendCodes": [
          "K-04"
        ],
        "driverNote": "K-04 Social Commerce + TikTok Shop trend",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Creators are the new hair consultants — 68% of Gen Z discovery starts with social, not search (T-09 inversions). K-04 (social commerce) routes influencer recommendations into direct checkout, meaning the profit pool fragments: brands pay creators directly, platforms take listing fees, and retail shelf placement becomes optional. The winner owns the creator-selection algorithm and data on what looks drive conversion.\\n\\n**2. Strategic Evaluation.** As creators displace search and salons as the first hair consultant, the pool fragments toward whoever owns the creator relationship and the data on which looks convert — a structural, decade-long shift in where category entry happens. HCB's wedge is got2b's authentic creator-native equity, deployed as always-on community rather than scattered paid placements. Competing on raw influencer spend against larger houses is a losing trade; the defensible bet is owning a credible creator ecosystem and the conversion data it generates, which compounds where a one-off media buy does not.",
        "id": "hair.inspire.exp.creator-and-community-platforms",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Trend-led inspiration collections",
        "type": "product",
        "trendCodes": [
          "C-03",
          "C-08"
        ],
        "driverNote": "C-03 Premiumization + C-08 Male Grooming",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Collections anchored to seasonal or cultural trends (Y2K revival, dark academia, coastal coquette) drive premiumization through narrative, not formula innovation. C-03 (premiumization) and C-08 (male grooming growth at 7.65% CAGR) are structural tailwinds. Each collection can command a 15-30% margin uplift over category baseline because the trend itself justifies the price — the consumer is buying the moment, not the SKU. Trend velocity in social is compressed to 60-90 day cycles.\\n\\n**2. Strategic Evaluation.** Trend-anchored collections monetise narrative rather than formula, and premiumisation plus male-grooming growth make this a structural margin pool through the decade — but the moat is speed and cultural read, not the SKU. Palette and got2b can own fast fashion-colour and styling drops where HCB's mass reach turns a trend into a habit faster than premium houses react. The capability bet is an industrialised trend-to-shelf cycle — sensing and translating culture at social velocity — which is what compounds; any single capsule is disposable by design.",
        "id": "hair.inspire.exp.trend-led-inspiration-collections",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Digital consultation (AI-matched looks)",
        "type": "service",
        "trendCodes": [
          "T-01",
          "T-07"
        ],
        "driverNote": "T-01 AI-Driven matching + T-07 Personalization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** When the customer uploads a photo, the AI returns not just a shade match but a complete look: color, finishing, styling sequence. T-01 and T-07 compress what was a 30-minute salon consultation into a 90-second app interaction. The diagnostic shifts from human to algorithm, and the prescription is immediate and specific. This is where brand choice gets locked in — whoever controls the look matching controls the replenishment pool downstream.\\n\\n**2. Strategic Evaluation.** Photo-to-full-look consultation moves the diagnostic from the salon chair to the device, and whoever owns that match owns the replenishment regimen downstream — the highest-value lock-in at the entry point. Schwarzkopf Professional's trichology and colour IP is the differentiator versus quiz-based DTC players that have no salon authority. The bet is to own the diagnostic-to-regimen path as a credibility-led capability feeding HCB's own brands, out-positioning L'Oréal's incumbent platform on professional trust rather than racing it on engineering scale.",
        "id": "hair.inspire.exp.digital-consultation-ai-matched-looks",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Influencer shade collaborations",
        "type": "product",
        "trendCodes": [
          "K-04",
          "C-03"
        ],
        "driverNote": "K-04 Social Commerce + C-03 Premiumization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Creator collab collections monetise parasocial trust: K-04 (social commerce) means the creator's audience is a ready-made buyer list, the creator is the media buy, and the product is the message. C-03 (premiumisation) lets a signature shade carry 40-50% margin uplift over the core range. First-mover collab anchors a creator to a brand and converts exclusivity (not formulation) into the moat.\\n\\n**2. Strategic Evaluation.** Creator collaborations convert parasocial trust into demand and let a signature shade carry premium for the length of the relationship — a real expansion pool as social commerce makes the creator the channel. The honest read is that exclusivity, not chemistry, is the moat, so the capability to identify and lock the right creators ahead of larger houses is the asset to build. Fashion-colour collabs belong to HCB's colour franchises; got2b's equity is styling and should not be stretched into dye chemistry where it does not transfer.",
        "id": "hair.inspire.exp.influencer-shade-collaborations",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "AI-generated personalized content at scale",
        "type": "tech",
        "trendCodes": [
          "T-10"
        ],
        "driverNote": "T-10 Gen AI Marketing Efficiency (40-60% cost reduction)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-10 (Gen AI marketing efficiency) enables 40-60% cost reduction in content production — localized ads, carousel variations, email sequences all generated by LLM in hours instead of weeks. Brands with AI-content infrastructure have a structural media advantage: lower cost-per-impression means deeper pockets for paid reach. The pool migrates from agencies (high-touch, slow) to in-house AI teams (fast, iterative).\\n\\n**2. Strategic Evaluation.** Generative content collapses the cost and cycle time of localised creative, handing a structural reach advantage to brands that build the capability in-house rather than rent it. The bet is a proprietary content engine for got2b and Schwarzkopf that compounds proprietary brand and conversion data into ever-sharper localised output — the moat is the data and the loop, not the model. This is a cost-to-serve and frequency play that helps close the reach gap to larger-spending incumbents; it is enabling infrastructure, not a standalone pool.",
        "id": "hair.inspire.exp.ai-generated-personalized-content-at-scale",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Shopee/TikTok-native beauty discovery formats (SEA)",
        "type": "service",
        "trendCodes": [
          "C-19"
        ],
        "driverNote": "C-19 SEA digital-first beauty — 600M consumers, highest e-commerce growth globally",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-19: Southeast Asia's 600M consumers discover beauty almost entirely inside Shopee, Lazada and TikTok Shop — the world's highest e-commerce growth rates with no offline discovery layer to disrupt. Inspiration, validation and checkout collapse into one in-app motion; brands without platform-native content operations are simply absent from the category entry point.\n\n**2. Strategic Evaluation.** In Southeast Asia discovery, validation and checkout happen almost entirely inside the platforms, with no offline layer to defend — a fast-growing pool where presence requires platform-native content and commerce operations as table stakes. This is a build-the-capability market: livestream and creator-affiliate economics learned here become the exportable playbook as the same model arrives in Europe. The bet is treating SEA as the capability foundry for platform-native commerce, with assortment and pack logic built to platform price points rather than ported retail ladders.",
        "id": "hair.inspire.exp.shopee-tiktok-native-beauty-discovery-formats-se",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Gen-Alpha 'first routine' starter lines & age-gated entry formats",
        "type": "product",
        "trendCodes": [
          "C-26"
        ],
        "driverNote": "C-26 Gen Alpha enters personal care 2026-2030 — first category entry points forming now",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-26: the oldest Gen Alpha cohort turns 14-16 in 2026-2030 — the years in which lifetime category entry points form. Their entry is screen-native (discovery via short video), parent-mediated on safety, and brand-forming: whoever owns the 'first routine' owns disproportionate lifetime mental availability. Sephora-kids controversy proved both the demand and the safety-positioning requirement.\n\n**2. Strategic Evaluation.** The oldest Gen Alpha cohort forms its lifetime category entry points this decade, and whoever owns the credible first routine earns disproportionate long-run mental availability — a small pool now, an outsized one later. HCB's distinct asset is Schwarzkopf's safety and dermatological heritage, which reassures the parent who gates the purchase while the proposition reaches the teen. The bet is a safe-by-design entry line as a deliberate entry-point land-grab; re-acquiring this cohort later costs far more than seeding credible salience now.",
        "id": "hair.inspire.exp.gen-alpha-first-routine-starter-lines-and-age-ga",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Live-commerce shoppable streams (Douyin model in EU)",
        "type": "service",
        "trendCodes": [
          "K-10"
        ],
        "driverNote": "K-10 Chinese live-commerce export — 10-12% of Chinese FMCG retail, now arriving via TikTok Shop EU",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-10: live-commerce took 10-12% of Chinese FMCG retail and is now exporting westward through TikTok Shop's EU rollout. For hair care — demonstration-led, transformation-visual — shoppable streams are a natively suited format: colour results, styling tutorials and instant checkout collapse the inspire-to-purchase funnel into minutes.\n\n**2. Strategic Evaluation.** Live commerce is exporting westward into a format hair is natively suited to — visible colour and styling transformation with instant checkout — and the pool concentrates fast around the early category hosts, so timing favours building capability while European competition is thin. HCB's wedge is Schwarzkopf colour-transformation content that proves results on camera. The bet is standing up streaming capability and storefronts now and re-using the SEA content economics as the template, rather than waiting for the format to mature and the host positions to be taken.",
        "id": "hair.inspire.exp.live-commerce-shoppable-streams-douyin-model-in-",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Print shade & style lookbooks",
        "type": "product",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 Digital AR replaces static print",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Physical lookbooks are margin-consuming artifacts in a T-07 (AI personalization) world. A printed shade guide requires reprinting every seasonal color drop and sits in retailer storage until sale; digital AR replaces static shade swatches with live color simulation. Print inventory risk has zero payoff in social-first discovery. Retailers are de-stocking print collateral in favor of QR-linked digital experiences.\\n\\n**2. Strategic Evaluation.** Print lookbooks are a declining, inventory-heavy format as live AR simulation replaces static swatches at the entry point — a clear harvest-and-redeploy case. The move is to wind these programmes down deliberately and shift the salience they once carried into the digital and creator surfaces where discovery now lives. The point is not the print saving itself but redeploying that spend upstream into AR and social presence so HCB holds the inspiration moment as the channel migrates, rather than defending a surface consumers have left.",
        "id": "hair.inspire.con.print-shade-and-style-lookbooks",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Occasion-based hair collections",
        "type": "product",
        "trendCodes": [
          "C-11"
        ],
        "driverNote": "C-11 Gen Z Dupe Culture seeks value",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Collections mapped to occasions (bridal, festival, work-appropriate) appealed to a browsing consumer; C-11 (Gen Z dupe culture) inverted this logic. Gen Z consumers research products by ingredient and price-per-use, not occasion narrative. They buy one shade for multiple uses. Occasion marketing demands inventory complexity (SKU proliferation) without lifting base attach rate — it is margin dilution disguised as innovation.\\n\\n**2. Strategic Evaluation.** Occasion-led collections suited a browsing shopper, but ingredient-literate, value-seeking Gen Z buys by efficacy and price-per-use across occasions, turning SKU proliferation into margin dilution dressed as innovation. This is a harvest move: consolidate low-velocity occasion editions into year-round core depth and reserve special editions for genuine trend moments. Redeploy the freed working capital and shelf into the trend-velocity and creator capabilities that actually win discovery now, defending share with minimal volume loss while recovering collection profitability.",
        "id": "hair.inspire.con.occasion-based-hair-collections",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Traditional salon consultations (walk-in)",
        "type": "service",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 AI + digital booking reduces appointments",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Walk-in salon chair time is being automated and pre-selected. T-07 (AI personalization) predicts the look before the appointment; digital booking reduces no-shows and chair-wait friction. Consumers increasingly validate their at-home choice in a salon rather than using the salon as a discovery point. The salon shifts from consultant to executor, compressing the margin-generating diagnostic moment.\\n\\n**2. Strategic Evaluation.** Walk-in consultation is being pre-empted as consumers arrive having already chosen at home, compressing the salon's margin-generating diagnostic moment — but for HCB this is a defend-and-upgrade case, not a pure loss. Schwarzkopf Professional can re-anchor the chair as a science-backed, billable diagnostic — scalp and porosity assessment — that justifies premium colour rather than a free pre-sell. The bet is owning the professional diagnostic standard so the salon stays a credibility moat for HCB even as at-home discovery commoditises the routine decision.",
        "id": "hair.inspire.con.traditional-salon-consultations-walk-in",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Basic brochure-based color guides",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI shade matching obsoletes static charts",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI shade simulation) makes static color-wheel charts obsolete overnight. A printed brochure cannot show how a shade looks on different hair types, skin tones, or lighting — algorithms can, in real time. Retailers are recycling brochures; QR-linked digital shade charts replace them. Print, distribution, and update costs exceed the consideration lift the format generates.\\n\\n**2. Strategic Evaluation.** Static colour charts are obsolete against AI shade simulation that shows a shade on real hair, skin and lighting — a fast-declining format. Cut the print and replace it with QR routes into a Schwarzkopf shade-finder, retraining store staff to hand consumers a screen. The saving is modest; the real prize is the posture signal to retail category captains that HCB is digital-native at the entry point while rivals still print, plus the first-party data the digital route returns. This is harvest-and-redeploy, not a battle to fight.",
        "id": "hair.inspire.con.basic-brochure-based-color-guides",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Search-dependent product discovery (SEO)",
        "type": "tech",
        "trendCodes": [
          "T-13"
        ],
        "driverNote": "T-13 Generative search (GEO) replaces traditional product discovery",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-13 (generative AI disrupts product discovery): 35% of US consumers now use AI for product discovery versus 13.6% traditional search. Google's CTR has declined as LLMs intercept queries before the SERP. Brands not cited in LLM outputs lose consideration before the shelf. SEO spend targeting keywords is a sinking investment — the question no longer reaches Google.\\n\\n**2. Strategic Evaluation.** Generative answer engines are intercepting product queries before the search results page, so keyword SEO is a sinking asset as the question stops reaching traditional search. The redeploy is to make HCB's colour and styling authority legible to AI discovery — structured, citable expertise the models surface natively — rather than bidding keywords. The defensible bet is owning credible, machine-readable category guidance at the new discovery layer; this is reallocating the discovery budget to where consideration now forms, before larger houses entrench their own presence there.",
        "id": "hair.inspire.con.search-dependent-product-discovery-seo",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Value-tier color kits (TikTok-native alternatives)",
        "type": "product",
        "trendCodes": [
          "K-04",
          "C-11"
        ],
        "driverNote": "K-04 Social Commerce + C-11 Gen Z Dupe Culture",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Ultra-cheap color kits proliferate via TikTok Shop and Shein direct-from-Guangzhou shipping. K-04 (social commerce) and C-11 (Gen Z dupe culture) collapse the category entry price below production-cost-plus-20%, which no branded volume can hold. Branded value-tier units do not expand into this gap — they cannibalise.\\n\\n**2. Strategic Evaluation.** Ultra-cheap direct-from-origin kits push the entry price below anything branded volume can hold, and a branded value tier cannibalises rather than expands into that gap — so the honest move is to concede the price floor. Anchor Palette on bond-protection and salon-like-result claims at affordable-premium, mirroring the defend-the-premium posture HCB runs in laundry. The strategic bet is holding the credible-result consumer with demonstrable efficacy, not chasing an unwinnable cost structure for a buyer Palette was never built to serve.",
        "id": "hair.inspire.con.value-tier-color-kits-tiktok-native-alternatives",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Western-brand colour & care lines in China retail (C-beauty preference)",
        "type": "product",
        "trendCodes": [
          "C-16"
        ],
        "driverNote": "C-16 C-beauty nationalism — domestic brands at 56% of China beauty value",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-16: domestic brands now take 56% of China beauty value on nationalism-inflected preference, livestream-native marketing and faster local innovation cycles. Western hair brands lose the inspiration moment to C-beauty players who own Douyin discovery end-to-end. Schwarzkopf China is comparatively small within Henkel, which caps absolute exposure but also strategic options.\n\n**2. Strategic Evaluation.** Domestic players own the China mass inspiration moment through nationalism-inflected preference and end-to-end live-commerce discovery, and that flank is not winnable head-on — so defend selectively and contain exposure. Hold the professional and salon position where German heritage retains pricing power, localise innovation through China-based co-development, and treat platform-native content as table stakes for whatever consumer presence remains. The larger strategic bet is pre-empting the same C-beauty model as it exports into Southeast Asia and eventually Europe, rather than over-investing to recapture the home market.",
        "id": "hair.inspire.con.western-brand-colour-and-care-lines-in-china-ret",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Organic brand discovery displaced by sponsored retail-media placements",
        "type": "service",
        "trendCodes": [
          "K-08"
        ],
        "driverNote": "K-08 retail media — sponsored placements colonise the beauty discovery surface",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-08 at the hair inspiration moment: beauty discovery on Amazon, Walmart and Sephora digital surfaces is increasingly sponsored-first — organic discovery (the moment indie and challenger brands historically won) is being colonised by paid placements. For incumbent brands the auction is a tax; for the inspiration stage itself it means the consumer's 'I found it myself' moment is increasingly manufactured.\n\n**2. Strategic Evaluation.** Retail-media auctions are colonising the on-platform discovery surface, taxing incumbents and manufacturing the consumer's self-discovery moment — a structural cost, not a winnable surface. HCB's counter is to own inspiration upstream so it arrives at the retail shelf pre-decided: creator content, salon credibility, and social-commerce salience. Paying the auction is unavoidable for defence, but winning it is not the strategy; the durable bet is building enough upstream mental availability that the sponsored surface confirms a choice already made rather than determining it.",
        "id": "hair.inspire.con.organic-brand-discovery-displaced-by-sponsored-r",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Post-acquisition indie brands armed with big-FMCG distribution",
        "type": "product",
        "trendCodes": [
          "X-12"
        ],
        "driverNote": "X-12 DTC/indie acquisition arms race — Rhode/e.l.f., Medik8 & Color Wow/L'Oréal, Dr Squatch/Unilever",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-12: the 2025-26 acquisition wave (Rhode to e.l.f. in a multi-hundred-million deal, Medik8 and Color Wow to L'Oréal, Dr Squatch to Unilever) re-arms indie brands with global distribution and supply chains while preserving their creator-native inspiration engines. The inspire stage fills with brands that have startup storytelling and incumbent logistics — the hardest competitive combination to counter.\\n\\n**2. Strategic Evaluation.** The acquisition wave is arming creator-native indie brands with global distribution while preserving their storytelling engines — the hardest combination to counter, and it crowds the inspiration stage through the decade. HCB needs an explicit thesis: either acquire selectively in defined white spaces such as textured hair or scalp longevity where organic build is slow, or commit to the build path and fund got2b and Schwarzkopf creator capability at genuine intensity. The non-strategy — neither buying nor matching the content engine — cedes the entry point by default.",
        "id": "hair.inspire.con.post-acquisition-indie-brands-armed-with-big-fmc",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "diagnose",
    "label": "Diagnose",
    "benefiting": [
      {
        "name": "Scalp & hair scanners (camera-based)",
        "type": "tech",
        "trendCodes": [
          "T-01",
          "T-04"
        ],
        "driverNote": "T-01 AI image analysis + T-04 Microbiome science",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Scalp imaging with AI interpretation is moving from dermatology clinics to consumer devices. T-01 (AI image analysis) reads not just surface condition but microbiome composition, sebum distribution, and inflammation markers. T-04 (microbiome-aware formulation) makes the diagnostic clinically actionable — the app prescribes products, not assumptions. This is the diagnostic moment where the category fight is decided upstream of the SKU.\\n\\n**2. Strategic Evaluation.** Scalp imaging with AI interpretation is moving from the clinic to the device, and this diagnostic moment decides the category upstream of the SKU — whoever reads the scalp prescribes the regimen. L'Oréal's K-SCAN is the incumbent to out-position; HCB's wedge is Schwarzkopf Professional's trichological IP and salon credibility. The bet is owning the diagnostic-to-regimen path as a professional-grade capability that feeds HCB's own care lines, not shipping consumer hardware to compete on device reach. The defensible asset is the trichology authority behind the read, not the camera.",
        "id": "hair.diagnose.exp.scalp-and-hair-scanners-camera-based",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "AI hair profiling (color, damage, texture)",
        "type": "tech",
        "trendCodes": [
          "T-01",
          "T-07"
        ],
        "driverNote": "T-01 AI-Driven analysis + T-07 Personalization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Algorithmic hair profiling from a single photo (color depth, damage index, texture classification, porosity score) enables precision formulation matching. T-01 and T-07 compress what was a manual assessment into a millisecond API call. C-03 (premiumization) and subscription lock-in rewards accuracy — consumers who get precise matches replenish faster. DTC brands (Prose, Function of Beauty) have proven the data moat works; L'Oréal's vast R&D budget is racing to replicate it.\\n\\n**2. Strategic Evaluation.** Single-photo profiling turns hair assessment into an instant, repeatable read, and accuracy compounds into replenishment loyalty as precise matches drive faster repurchase — a high-value diagnostic pool. DTC players proved the data moat; HCB's differentiator is wiring Schwarzkopf Professional's formulation science into a consumer profiling engine with salon-grade authority rivals cannot claim. The bet is owning the diagnostic-to-regimen relationship and the proprietary profile data it builds, out-positioning the incumbent platform on professional credibility rather than racing it on engineering headcount.",
        "id": "hair.diagnose.exp.ai-hair-profiling-color-damage-texture",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Porosity & damage diagnostic tests",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization (detailed diagnostics)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Porosity diagnostics (porosity spectrum, cuticle integrity, moisture-binding capacity) shift from salon backbar intuition to quantified consumer assessments. C-03 (premiumization) enables brands to charge a diagnostic fee for a test that justifies premium treatment bundles. The test becomes a gateway to a ritual — weekly treatments, seasonal masks, targeted serums all anchored to the diagnostic baseline.\\n\\n**2. Strategic Evaluation.** Quantified porosity and damage diagnostics move backbar intuition into a consumer ritual, where premiumisation lets the test anchor a recurring treatment regimen — the diagnostic is the gateway, the regimen is the pool. HCB's right-to-win is Schwarzkopf Professional's clinical credibility paired with Gliss's keratin-repair heritage, which makes a science-led tier between drugstore and salon believable. The bet is owning that diagnostic-to-regimen ritual as a professional-science proposition, building durable attach to repair products rather than selling a one-off test kit.",
        "id": "hair.diagnose.exp.porosity-and-damage-diagnostic-tests",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Dermatological & trichology assessments",
        "type": "service",
        "trendCodes": [
          "C-10"
        ],
        "driverNote": "C-10 Hair Loss Treatments + clinical validation",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Hair loss entering mainstream (C-10) makes dermatological credibility a profit-pool driver. DTC brands (Hims, Ro, Nioxin) have normalized tele-derm consultations at a clear per-assessment fee. Consumers are willing to pay for clinical validation of scalp conditions (alopecia, dermatitis, seborrheic keratosis) and oral/topical treatment protocols. The assessment prescribes the treatment — diagnostic moment locks in the brand.\\n\\n**2. Strategic Evaluation.** Hair loss entering the mainstream makes dermatological credibility a profit-pool driver, with tele-derm players normalising paid clinical assessment that prescribes — and thereby locks in — the treatment brand. Schwarzkopf Professional's trichology IP is a genuine right-to-win as the credible professional tier between specialist anti-thinning lines and mass anti-dandruff. The bet is owning the assessment-to-regimen path for scalp and thinning care through partnered or proprietary trichology assessment, monetising the IP as recurring care rather than positioning HCB as a clinical provider it is not.",
        "id": "hair.diagnose.exp.dermatological-and-trichology-assessments",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Hormonal & nutritional deficiency screening",
        "type": "service",
        "trendCodes": [
          "C-05",
          "C-10"
        ],
        "driverNote": "C-05 Silver Economy + C-10 Hair Loss Treatments",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Hair loss driven by GLP-1 medications (C-02) or nutritional deficiency creates a new diagnostic category. C-05 (Silver Economy) and C-10 (hair loss mainstream) expand the addressable pool beyond pattern baldness to post-pharmaceutical and age-related thinning. Consumers are willing to test (blood work, nutrient panels) and supplement if the outcome is measurable hair recovery. The supplement + topical protocol locks in higher lifetime value.\\n\\n**2. Strategic Evaluation.** Medication- and age-driven thinning opens a screening-led diagnostic beyond pattern baldness, where a measurable outcome justifies a supplement-plus-topical regimen and higher lifetime value — relevant as the silver economy and mainstream hair loss expand the pool. The honest read is that HCB's right-to-win is the topical scalp-care regimen anchored to Schwarzkopf trichology, not ingestibles or lab diagnostics it has no franchise in; Nutrafol sits with a larger rival. The bet is owning the topical regimen the screen prescribes, partnering for the diagnostic rather than building it.",
        "id": "hair.diagnose.exp.hormonal-and-nutritional-deficiency-screening",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "At-home scalp microbiome testing",
        "type": "tech",
        "trendCodes": [
          "T-04"
        ],
        "driverNote": "T-04 Microbiome Science (at-home kits)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-04 (microbiome-aware formulation) enables consumers to test their own scalp microbiome composition via swab-and-mail kits. The test prescribes formulations calibrated to that consumer's microbial ecosystem. Microbiome testing kits are growing 25%+ annually; consumers pay a premium for the test. The result is a high-margin diagnostic that justifies a recurring monthly care subscription.\\n\\n**2. Strategic Evaluation.** Microbiome-aware formulation makes at-home scalp testing actionable, prescribing care calibrated to the consumer's microbial profile — a growing diagnostic that anchors a recurring care regimen, and a genuine white space the incumbent's surface-only scan does not read. HCB's wedge is Schwarzkopf Professional's formulation science translated into microbiome-matched care. The bet is owning the diagnostic-to-regimen relationship through a partnered testing capability rather than building lab infrastructure; the defensible asset is the matched formulation and the regimen lock-in, not the assay itself.",
        "id": "hair.diagnose.exp.at-home-scalp-microbiome-testing",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "DNA-based hair type profiling",
        "type": "service",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-Driven genetic matching + premiumization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Genetic hair-type profiling (texture heritability, pigment composition, growth-cycle variation) offers precision targeting for ultra-premium positioning. T-01 (AI-driven formulation) makes the genetic data actionable — each consumer's genotype maps to a bespoke formulation. C-03 (premiumization) permits ultra-premium entry points for \"genetically matched\" hair care. The DNA result becomes a narrative anchor: personalization at the molecular level.\\n\\n**2. Strategic Evaluation.** Genetic profiling offers an ultra-premium personalisation narrative, mapping genotype to bespoke formulation as a science-led anchor for the highest price tiers — a real but narrow, slower-maturing pool this decade. HCB's right-to-win is Schwarzkopf Professional formulation science translated into a credible regimen, with genetics as the narrative rather than the deliverable, partnering for the assay rather than owning it. The honest bet is owning the resulting premium regimen subscription and treating DNA as a positioning layer; the differentiation lives in the formulation authority, not the genetic test.",
        "id": "hair.diagnose.exp.dna-based-hair-type-profiling",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Male-specific hair thinning pattern analyzers",
        "type": "tech",
        "trendCodes": [
          "C-08",
          "T-01"
        ],
        "driverNote": "C-08 Male Grooming Structural Growth + T-01 AI analysis",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-08 (male grooming as a multi-billion pool growing 7.65% CAGR) and C-10 (hair loss going mass) converge on male-specific diagnostics. Male-pattern baldness on the Norwood scale is highly predictable from photo data; an algorithm can stage the condition and forecast progression, then unlock early intervention (minoxidil, finasteride) and scalp protocols. Male consumers are systematically underserved by today's diagnostic tools.\\n\\n**2. Strategic Evaluation.** Male-pattern thinning is highly predictable from photo data, and structural male-grooming growth converging with mainstream hair loss makes a male-anchored diagnostic an underserved entry point that gates intervention and protocol. The honest constraint is that HCB's male hair assets are thin, so the right-to-win is Schwarzkopf trichology applied to a focused male proposition, with referral partnerships for the prescription layer it cannot own. The bet is capturing the male diagnostic moment as the gateway and owning the topical regimen attached to it, ahead of larger houses standing up rival tools.",
        "id": "hair.diagnose.exp.male-specific-hair-thinning-pattern-analyzers",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Post-medication hair health monitors",
        "type": "tech",
        "trendCodes": [
          "C-02",
          "T-07"
        ],
        "driverNote": "C-02 GLP-1 Drug hair side-effects + T-07 AI Personalization",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** GLP-1 weight-loss drugs (Ozempic, Wegovy, Mounjaro) cause hair shedding in 20-30% of users; C-02 (GLP-1 drugs reshape consumer spending) creates a new diagnostic occasion. Consumers on GLP-1 need early detection of hair loss to intervene. A monitoring app (photo-based hair density tracking, monthly telemetry) justifies a post-GLP-1 hair recovery protocol. The market is emerging now; first-mover establishes the baseline category.\\n\\n**2. Strategic Evaluation.** GLP-1 shedding creates a new, emerging diagnostic occasion where early detection unlocks a recovery regimen, and a first credible monitoring proposition can define the category baseline — a small but strategically early pool. HCB's right-to-win is Schwarzkopf trichology applied to a topical recovery regimen for medication-induced shedding, with referral partnerships into the prescribers it cannot replace. The bet is owning the monitoring-to-regimen relationship for this cohort as the category forms, monetising recurring care rather than overreaching into the pharmaceutical pathway itself.",
        "id": "hair.diagnose.exp.post-medication-hair-health-monitors",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Hair-longevity diagnostics & biomarker panels",
        "type": "service",
        "trendCodes": [
          "C-21"
        ],
        "driverNote": "C-21 Longevity medicine crossover — anti-aging market to $120B by 2030, science-led repositioning",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-21: the longevity economy (a multi-billion anti-aging pool by 2030) is repositioning hair concerns from cosmetic to biomarker-led — follicle density scans, hormonal panels, scalp-age scoring. The diagnostic moment becomes a medicalised entry point that prescribes multi-month regimens rather than single SKUs.\\n\\n**2. Strategic Evaluation.** The longevity crossover is repositioning hair from cosmetic concern to biomarker-led entry point — follicle and scalp-age scoring that prescribes multi-month regimens — a credibility-rich pool aligned to HCB's dermatological R&D heritage. The honest win condition is the regimen attach rate, not the scan; the scoring is the gateway, the consumable refill is the value. The bet is partnering with longevity and tele-derm players for the diagnostic and owning the prescribed regimen, rather than building standalone hardware HCB has no advantage in manufacturing or distributing.",
        "id": "hair.diagnose.exp.hair-longevity-diagnostics-and-biomarker-panels",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Tele-derm hair & scalp prescription platforms (Hims/Hers model)",
        "type": "service",
        "trendCodes": [
          "C-32"
        ],
        "driverNote": "C-32 beauty-as-medicine DTC — $2B+ run-rates in prescription hair/scalp treatment",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-32: tele-dermatology DTC platforms (Hims, Hers, Ro) have built multi-billion run-rates by medicalising hair concerns — prescription-grade diagnosis and treatment delivered by subscription, bypassing both retail shelf and salon chair. The diagnostic moment migrates to a telehealth intake form; the platform owns the regimen and the recurring revenue.\\n\\n**2. Strategic Evaluation.** Tele-derm DTC is migrating the diagnostic moment to a telehealth intake and capturing the recurring regimen, bypassing both shelf and salon — a structural shift HCB cannot lead as a provider. The right-to-win is becoming the platforms' credible cosmetic-adjacent layer: clinically substantiated non-prescription scalp care that sits in the default regimen alongside the prescription, where their basket-size gap is HCB's distribution opportunity. The bet is owning a place in the recommended protocol of leading platforms; being in the default regimen matters more than exclusivity.",
        "id": "hair.diagnose.exp.tele-derm-hair-and-scalp-prescription-platforms-",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Scalp analysis kits (basic / manual)",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI cameras obsolete basic kits",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Manual scalp assessment guides (charts, questionnaires) are replaced by T-01 (AI image analysis) that is faster, more accurate, and repeatable. A basic paper-based kit requires consumer interpretation and manual matching — AI does the interpretation. Consumers abandon manual kits when algorithmic alternatives offer instant results. The margin pool in basic analysis gets compressed to near-zero as automation commodifies the diagnostic.\\n\\n**2. Strategic Evaluation.** Manual scalp-assessment kits are being commoditised to near-zero margin as AI image analysis does the interpretation faster and more repeatably — a clear redeploy case, not a battle. Sunset paper-based assessment guides and concentrate the spend on the AI-diagnostic path where Schwarzkopf's professional credibility creates a moat. The strategic point is consolidating the diagnostic moment around a credibility-led capability HCB can own, redirecting the freed investment into the scanning-to-regimen relationship rather than maintaining a format automation has already obsoleted.",
        "id": "hair.diagnose.con.scalp-analysis-kits-basic-manual",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Generic hair type classification guides",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI personalization > generic guides",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Classification systems (straight, wavy, curly, coily; thin, normal, thick) were useful when consumers had to manually sort themselves into treatment categories. T-01 (AI personalization) makes self-classification obsolete — the algorithm reads the hair and assigns a phenotype more accurately than the consumer's guess. Generic guides are informational clutter; AI results are actionable. Consumers abandon guides for algorithms.\\n\\n**2. Strategic Evaluation.** Generic self-classification guides lose their purpose once an algorithm reads hair and assigns a phenotype more accurately than the consumer's guess — informational clutter against an actionable result. Remove them from pack and POS and route to HCB's AI profiler instead. The saving is trivial; the gain is funnelling the diagnostic moment into a proprietary, credibility-led tool that captures the profile and feeds the regimen. This is a redeploy toward owning the diagnostic-to-regimen path, not a format worth defending.",
        "id": "hair.diagnose.con.generic-hair-type-classification-guides",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Weather/environment tracking (low engagement)",
        "type": "tech",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 Personalization shifts from weather to microbiome",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Humidity-triggered product recommendations (\"Use this serum on rainy days\") had appeal in a static recommendation era. T-07 (AI personalization) shifts the baseline from external conditions (weather) to internal biology (scalp microbiome, hair porosity, hydration status). Environmental data is low-signal noise in a high-signal personalization system. Consumers ignore weather-based recommendations in favor of microbiome-match data.\\n\\n**2. Strategic Evaluation.** Weather-triggered recommendations are low-signal against personalisation built on the consumer's own biology — porosity, hydration, microbiome — so this feature is a redeploy, not a capability to sustain. Retire it and concentrate engineering and personalisation bandwidth on the biology-led diagnostics that actually drive engagement and regimen attach. The strategic logic is focusing scarce capability on the high-signal diagnostic moment HCB can own credibly, rather than spreading the personalisation engine across environmental noise that consumers ignore.",
        "id": "hair.diagnose.con.weather-environment-tracking-low-engagement",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "One-size-fits-all consultation models",
        "type": "service",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 AI Personalization demands custom diagnostics",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Generic \"all hair types\" messaging is incompatible with T-07 (AI personalization) and the premiumization consumer expectation. C-03 (premiumization) means consumers expect products formulated to their specific profile, not a one-size blitz. Brands that message to \"everyone\" signal they are undifferentiated commodities. The pool migrates to precision messaging and bespoke formulation.\\n\\n**2. Strategic Evaluation.** Generic all-hair-types messaging is incompatible with a personalisation-led, premiumising consumer and signals an undifferentiated commodity as the pool migrates to precision. Replace blanket copy with diagnostic-gated narratives tied to each consumer's profile across colour, porosity and condition. This is a redeploy of communication toward the bespoke positioning HCB's trichology and formulation credibility can substantiate, reinforcing the diagnostic-to-regimen path; the defensible asset is the credible personalised proposition, not the breadth of a one-size message.",
        "id": "hair.diagnose.con.one-size-fits-all-consultation-models",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "AI diagnostic tools facing EU AI-Act conformity gates",
        "type": "tech",
        "trendCodes": [
          "G-10"
        ],
        "driverNote": "G-10 EU AI Act fully applicable Aug 2026 — conformity costs for consumer-facing AI diagnostics",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-10: the EU AI Act is fully applicable from August 2026; consumer-facing AI diagnostics (scalp scanners, shade-matching, skin analysis) face transparency, data-governance and in some configurations conformity-assessment obligations. Compliance cost falls disproportionately on smaller diagnostic startups — and slows everyone's EU release cadence versus US/Asia.\n\n**2. Strategic Evaluation.** AI-Act conformity raises the cost and slows the EU cadence of consumer-facing diagnostics, falling hardest on smaller startups — which turns compliance into a moat once crossed rather than a pure drag. A conformant Schwarzkopf diagnostic carries a trust signal indie tools struggle to match, and salon deployment in a professional context eases some consumer-facing obligations. The bet is building conformity into every AI feature from the outset so HCB's credibility-led diagnostics clear the gate that thins the field; retrofitting after the rules bite is the expensive path.",
        "id": "hair.diagnose.con.ai-diagnostic-tools-facing-eu-ai-act-conformity-",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Competitor-owned diagnostic ecosystems set the category standard",
        "type": "tech",
        "trendCodes": [
          "X-07",
          "X-11"
        ],
        "driverNote": "X-07 L'Oréal tech-beauty platform (K-SCAN, Modiface) + X-11 L'Oréal-NVIDIA molecule discovery",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-07 + X-11: L'Oréal is industrialising the diagnostic moment — K-SCAN scalp analysis, Modiface AR, 725 patents in 2025 and an NVIDIA partnership for AI molecule discovery (a vast R&D budget). When the category's diagnostic standard is competitor-owned, every scan funnels regimen recommendations toward Kérastase and L'Oréal Pro — the diagnosis IS the distribution.\\n\\n**2. Strategic Evaluation.** When the diagnostic standard is competitor-owned, every scan funnels the regimen toward the owner's house brands — the diagnosis becomes the distribution, a structural headwind HCB cannot out-spend. The counter is to out-position: open diagnostics that recommend by need rather than house brand, offered as the trust alternative for independent salons wary of incumbent lock-in, plus focused AI-formulation bets where Schwarzkopf holds real data advantage — colour, where the Igora shade-formula corpus is a genuine asset. Concede the platform war; win named battles where the data right-to-win is HCB's.",
        "id": "hair.diagnose.con.competitor-owned-diagnostic-ecosystems-set-the-c",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "prepare",
    "label": "Prepare",
    "benefiting": [
      {
        "name": "Scalp protection & comfort systems",
        "type": "product",
        "trendCodes": [
          "T-02",
          "C-04"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + C-04 Conscious",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Pre-treatment scalp conditioning moves upmarket as consumers adopt multi-step routines ahead of color, heat, or styling. T-02 (bio-based chemistry) and C-04 (clean beauty) compress the gap between salon scalp-prep protocols and retail accessibility, forcing commodity comfort products to either upgrade or exit as consumers demand clinically-credible comfort over fragrance-led promises.\\n\\n**2. Strategic Evaluation.** The decade's move is scalp-as-skincare: comfort migrates from fragrance promise to substantiated barrier and sensitivity science (T-02 bio-based actives, C-04 cleanical credibility). HCB should treat this as a platform, not a SKU — codify a pre-treatment scalp-comfort technology under Schwarzkopf Professional trichology, with proof points (tolerance, soothing) the salon channel can stand behind. The defensible asset is clinical substantiation; commodity comfort, leaning on scent, has no durable position once the claim bar rises.",
        "id": "hair.prepare.exp.scalp-protection-and-comfort-systems",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Bond builders (pre-color treatment)",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-optimized bond science + premiumization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Bond-repair pre-treatments are the fastest-growing Hair premium sub-segment: Olaplex No. 0 created the category, K18 normalised premium peptide pricing, and T-01 + T-14 (AI-optimised peptide bioactives) now compress lab-to-shelf from five years to under two. The pool migrates from commodity pre-color rinses to clinical bond-preservation systems commanding 3-5x category margin.\\n\\n**2. Strategic Evaluation.** Bond science is the highest-conviction premium pool in prepare, and the right-to-win is formulation depth plus salon proof, not a price match. HCB should build a proprietary bond-repair platform anchored in Schwarzkopf Professional R&D and Gliss's keratin lineage, validated in-salon before mass rollout so the efficacy claim is earned, not asserted. Olaplex and K18 are independent and own mindshare; the durable counter is substantiated chemistry HCB controls and can extend across color and care, not a one-off challenger SKU.",
        "id": "hair.prepare.exp.bond-builders-pre-color-treatment",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Heat & UV protectants (advanced)",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + T-01 nano-formulations",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Advanced styling protectants combine T-02 (bio-based UV filters replacing restricted synthetics) with T-01 (AI-optimised polymer blends) to deliver thermal stability, durability, and a sensory premium cue. G-03 (cosmetics regulation tightens UV ingredient limits) forces a synthetic-to-bio transition that doubles as a margin uplift event for whichever brand owns the new claim first.\\n\\n**2. Strategic Evaluation.** Tightening UV-filter regulation (G-03) plus bio-based and AI-tuned polymer chemistry (T-02, T-01) turns reformulation into a claim-ownership moment: whoever holds substantiated thermal-and-UV protection on compliant chemistry first sets the new reference. HCB should build that protectant platform in Schwarzkopf Professional R&D and carry it where the heat-styling occasion lives — got2b for the youth styling consumer. The bet is owning a defensible, regulation-proof protection technology, not shipping another silicone spray into a commoditizing tier.",
        "id": "hair.prepare.exp.heat-and-uv-protectants-advanced",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Anti-humidity & anti-frizz primers",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based + T-01 climate-adaptive formulas",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Climate volatility (E-05) drives year-round humidity stress in Northern Europe, extending the frizz-control season. T-01 (moisture-adaptive polymers) enable primers that respond to ambient humidity rather than static coating. The profit pool migrates from occasional-use styling products toward year-round essential regimens.\\n\\n**2. Strategic Evaluation.** Persistent climate-driven humidity stress (E-05) turns frizz control from occasional to near-year-round, premiumizing the primer step. The innovation worth owning is humidity-responsive polymer chemistry (T-01) that adapts to ambient moisture rather than static coating — a genuine technology claim Schwarzkopf Professional can substantiate via its Bonacure moisture lineage. The bet is a defensible adaptive-primer platform with real performance proof; a me-too silicone primer wins nothing as the step formalizes.",
        "id": "hair.prepare.exp.anti-humidity-and-anti-frizz-primers",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Scalp detox & exfoliation scrubs",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care Category (new trend expansion)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care emerges as standalone category) redefines pre-treatment from hair conditioning to scalp health. Exfoliating scrubs move scalp prep from niche salon service to retail habit, paralleling the skincare trend (40%+ of skincare consumers now exfoliate weekly). Pool grows from zero to a sizeable EU segment as category awareness reaches mainstream.\\n\\n**2. Strategic Evaluation.** Scalp-care-as-standalone (C-07) imports the skincare exfoliation ritual into hair prep, opening a habit-forming entry pool. HCB's right-to-win is trichology credibility plus microbiome-aware actives (enzymatic, prebiotic) developed in Schwarzkopf Professional R&D, framed as a routine ritual rather than a clinical treatment to stay cosmetic. Build the scalp-prep formulation platform that can extend into barrier and detox claims; the salon-validated science is the moat, and a fragrance-led scrub without it is easily copied down to private label.",
        "id": "hair.prepare.exp.scalp-detox-and-exfoliation-scrubs",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Pre-treatment precision applicators (tech)",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation precision dosing",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (manufacturing automation) now allows precision-dispensing applicators that cut product waste 30-40% and remove the need for manual sectioning clips. Smart applicators (metered nozzles, color-lock tips) are migrating from premium-only to mid-market as injection-molded scale arrives, lifting consumer application success rates and the credibility of efficacy claims.\\n\\n**2. Strategic Evaluation.** A genuine but low-altitude tailwind: precision-dosing applicators (T-05 automation) lift at-home application success and, with it, the credibility of efficacy claims. The value is enabling, not standalone — pair the delivery format with HCB's premium prep and color systems so it reinforces a substantiated regimen rather than competing as hardware. Treat applicator design as a capability that protects the chemistry's performance claim; the durable margin sits in the formula, with the device as proof-of-use, not a profit pool in itself.",
        "id": "hair.prepare.exp.pre-treatment-precision-applicators-tech",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Pre-color pH adjustment products",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI color formulation (pH optimization)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI-formulated pH optimisation) and T-14 (peptide stability in target pH ranges) introduce an active pre-color step that stabilises hair pH before pigment deposition, improving color fastness and reducing damage. The category is moving from passive protective rinses to active chemistry, which justifies a dedicated SKU and margin pool rather than a free in-pack rinse.\\n\\n**2. Strategic Evaluation.** AI-formulated pH optimization and peptide stability (T-01, T-14) convert a passive pre-color rinse into an active chemistry step that measurably improves fastness and reduces damage — justifying a dedicated, substantiated SKU rather than a free in-pack. HCB should own this as a Schwarzkopf Professional system step, building the salon-to-retail proof that the prep meaningfully changes the color result. The bet is a defensible active-prep platform; the category is nascent, so the science and consumer education built now become the reference others copy into.",
        "id": "hair.prepare.exp.pre-color-ph-adjustment-products",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Scalp barrier repair serums",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care Category emergence",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care category emergence) accelerates demand for barrier-repair serums targeting scalp inflammation, sensitivity, and microbiome disruption. T-04 (microbiome-aware formulation) enables prebiotic and postbiotic serums that repair, not just soothe. Premium market for scalp serums is growing 15-20% CAGR; retail penetration is <5% in EU, white space is structural.\\n\\n**2. Strategic Evaluation.** Scalp-care emergence (C-07) plus microbiome-aware formulation (T-04) opens structural white space in barrier repair — prebiotic and postbiotic serums that restore rather than merely soothe. HCB's right-to-win is trichology substantiation from Schwarzkopf Professional, positioned for color-treated and heat-stressed scalps and kept at the cosmetic end of the claim spectrum. Build the barrier-science platform that can anchor a replenishment habit; the moat is clinical credibility, and an unsubstantiated soothing serum holds no defensible position as the category formalizes.",
        "id": "hair.prepare.exp.scalp-barrier-repair-serums",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "India affordable-premium sachets & small-pack regimens",
        "type": "product",
        "trendCodes": [
          "C-17"
        ],
        "driverNote": "C-17 India BPC $30B at 11% CAGR — fastest-growing top-10 market, sachet-led premium entry",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-17: India's BPC market is a large pool compounding at 11% — the fastest-growing top-10 market — and the entry mechanics are India-specific: affordable-premium positioning via sachets and small packs that put salon-quality formulas at street-retail price points. The wash/cleanse stage is where the volume sits; premiumisation happens within the sachet, not beyond it.\\n\\n**2. Strategic Evaluation.** India's structurally fast-growing BPC pool (C-17) premiumizes within the sachet, not beyond it — salon-quality formula at street-retail entry is the proposition mass players struggle to match. HCB's differentiator is Schwarzkopf's professional heritage translated into affordable-premium formats; the capability bet is formulation-for-format and distribution depth (general trade plus quick-commerce), where partner-led routes beat owned infrastructure on speed. India also hedges Asia-portfolio exposure to China softness (C-16). The durable asset is credible premium science delivered at the price India actually buys.",
        "id": "hair.prepare.exp.india-affordable-premium-sachets-and-small-pack-",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Curl & coil-specific cleansing systems (co-wash, low-poo)",
        "type": "product",
        "trendCodes": [
          "C-24"
        ],
        "driverNote": "C-24 textured hair mainstream — 65% of global population, portfolios designed for straight hair",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-24: 65% of the world's population has textured hair, yet mainstream portfolios are engineered for straight hair — the structural mismatch the DB flags as a designed-in white space. The wash stage is where textured routines diverge most (co-washing, sulfate-free, moisture-first), making it the entry point for credible texture-first ranges.\n\n**2. Strategic Evaluation.** Textured hair as mainstream (C-24) exposes a designed-in mismatch: most portfolios are engineered for straight hair, and the wash stage is where textured routines diverge most. This is a portfolio-architecture bet, not a variant — texture-inclusive formulation across Gliss and Schwarzkopf with genuine curl-pattern segmentation, built once and shared with the US Hispanic (C-18) and Africa (X-09) pools. Credibility here is earned in community, not claimed in advertising; authentic texture-formulation capability is the durable asset, and superficial extensions invite the Shea-Moisture-style backlash.",
        "id": "hair.prepare.exp.curl-and-coil-specific-cleansing-systems-co-wash",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Africa-first hair care ranges (textured-hair leadership at AfCFTA scale)",
        "type": "product",
        "trendCodes": [
          "X-09",
          "X-14"
        ],
        "driverNote": "X-09 Africa $200B FMCG frontier + X-14 AfCFTA tariff harmonisation 2026-28",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-09 + X-14: Africa's FMCG pool reaches a multi-hundred-billion scale by 2030 on 1.7B consumers, and AfCFTA's 2026-28 tariff harmonisation makes pan-African manufacturing scale economics viable for the first time. Hair is the beachhead category: textured-hair-first demand, strong local routines, and lighter PL pressure than Europe — but local champions and L'Oréal are moving on the same map.\\n\\n**2. Strategic Evaluation.** Africa's expanding FMCG frontier (X-09) and AfCFTA tariff harmonisation (X-14) make pan-African scale economics viable in the category where demand is structurally texture-first and private-label pressure is lighter. HCB should anchor on one textured-hair platform shared with C-24 (not a parallel stack), build regional manufacturing capability under rules-of-origin, and carry the India sachet architecture (C-17). The window is the harmonisation period itself: distribution and supply positions established now set the decade, and local champions plus L'Oréal are mapping the same ground.",
        "id": "hair.prepare.exp.africa-first-hair-care-ranges-textured-hair-lead",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Basic pre-color treatments (commoditized)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization displaces commodity category",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumisation) plus the upgrade into bond-repair and scalp-barrier science compress the mid-tier pre-color slot. Basic rinse-and-condition pre-treatments collapse on margin as consumer expectations shift toward clinical efficacy and sensory premium cues. The pool contracts 8-12% annually as SKU complexity consolidates upward into bond-and-prep systems.\\n\\n**2. Strategic Evaluation.** Premiumization (C-03) and the upgrade into bond and barrier science compress the basic rinse-and-condition tier from above while private label pressures below — a structurally contracting pool. Harvest, don't defend: rationalise commodity pre-treatment SKUs into a single functional step and redeploy the freed trade and innovation envelope into HCB's bond-repair and substantiated prep platforms. The margin belongs upstairs in defensible science; sustaining a tier the consumer is already exiting consumes resource the premium build needs.",
        "id": "hair.prepare.con.basic-pre-color-treatments-commoditized",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Chelation treatments (niche, low awareness)",
        "type": "service",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 Personalization requires new patient education",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Chelation (mineral/metal removal from hard water) is a niche, low-awareness category that requires patient education. T-07 (AI personalization) and connected-water diagnostics (T-08, smart home water treatment) make generic chelation obsolete: consumers will soon know exact water hardness and receive AI-recommended products, not shelf-browsed chelation treatments.\\n\\n**2. Strategic Evaluation.** Chelation is a low-awareness niche whose rationale erodes as connected-water diagnostics and personalization (T-07, T-08) make hard-water effects visible and route consumers to guided solutions rather than shelf-browsed mineral removers. Do not build a standalone chelation pool. Redeploy the underlying water-responsive formulation capability into adaptive products that adjust to local water conditions — the durable value migrates from a generic treatment to substantiated, condition-aware chemistry HCB can own across the regimen.",
        "id": "hair.prepare.con.chelation-treatments-niche-low-awareness",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Manual sectioning clips & tools",
        "type": "product",
        "trendCodes": [
          "T-05",
          "T-01"
        ],
        "driverNote": "T-05 Automation + T-01 AI guides precision",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (automation) and T-01 (AI-guided precision dispensing) make sectioning a software problem — virtual sectioning guides via app, plus precision-applicator bottles. Hardware tools are margin-light and CLV-low; the pool migrates from commodity clips to consumable applicators and software guidance, where SKU upsells live.\\n\\n**2. Strategic Evaluation.** Automation and AI-guided precision (T-05, T-01) turn sectioning into a software-and-delivery problem, leaving manual clips margin-light and strategically inert. Harvest the hardware: fold the sectioning function into HCB's digital application guidance and precision-applicator formats tied to its premium prep and color systems. The capability worth building is delivery that protects the chemistry's performance claim; the profit pool sits in the consumable and the formula, not the plastic, and SKU rationalisation also simplifies the range.",
        "id": "hair.prepare.con.manual-sectioning-clips-and-tools",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Generic heat protection sprays",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization demands advanced formulas",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) demand for advanced heat-protection formulas (nano-polymers, climate-adaptive coating) displaces generic silicone sprays. Basic thermal protection is commoditized and pushed to private label; branded margin pool contracts 15-20% as got2b and Schwarzkopf upgrade to advanced formulas and abandon the commodity segment.\\n\\n**2. Strategic Evaluation.** Premiumization (C-03) pushes basic thermal protection toward private label while branded value concentrates in advanced, substantiated formats. Harvest-and-redeploy: consolidate commodity heat-spray depth and migrate the occasion into HCB's advanced protectant platform (bio-based, AI-tuned chemistry per T-01/T-02) carried by got2b's styling equity. The bet is profitability through substantiated elevation, not commodity volume; holding undifferentiated heat sprays defends a tier the brand should be leading the consumer out of.",
        "id": "hair.prepare.con.generic-heat-protection-sprays",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "UV-filter-dependent protectants (restricted ingredients)",
        "type": "product",
        "trendCodes": [
          "G-03"
        ],
        "driverNote": "G-03 Cosmetics Regulation VII/VIII (SCCS restrictions)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-03 (cosmetics regulation tightening) restricts synthetic UV filters (benzophenone, octinoxate) and mandates broader SCCS safety testing windows, forcing reformulation. Current UV-dependent protectants lose regulatory approval 2027-2028; brands without bio-based UV alternatives face a sudden-death delisting. Pool migrates to biobased UV chemistries; products dependent on restricted synthetics exit.\\n\\n**2. Strategic Evaluation.** Tightening cosmetics regulation (G-03) puts restricted synthetic UV filters on a path to delisting, making reformulation a survival requirement rather than an option. Audit exposed Schwarzkopf Professional and Syoss formulations and convert to compliant bio-based and mineral UV chemistry (T-02) ahead of the deadlines. Handled with R&D agility, the forced transition becomes a claim-ownership opportunity — the same move that defends the shelf can establish HCB's compliant-protection technology as the new reference while slower competitors face disruption.",
        "id": "hair.prepare.con.uv-filter-dependent-protectants-restricted-ingre",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "remedy",
    "label": "Remedy",
    "benefiting": [
      {
        "name": "Hair loss & thinning growth serums",
        "type": "product",
        "trendCodes": [
          "C-10",
          "C-05"
        ],
        "driverNote": "C-10 Hair Loss Treatments (core trend) + C-05 Silver",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-10 (hair loss enters consumer mainstream) is a structural category shift — tele-derm platforms (Hims, Hers, Ro) have built multi-billion run-rates in prescription hair-loss treatments (finasteride, minoxidil). Consumer mainstream acceptance means topical serums and supplements now carry clinical credibility. Henkel's white space is the salon-to-retail bridge: clinical credibility at mass pricing, between the premium niche (Nioxin) and commodity (Head & Shoulders).\\n\\n**2. Strategic Evaluation.** Hair loss entering the mainstream (C-10) plus an aging population (C-05) is a structural shift, and tele-derm has normalised clinical credibility for topicals. HCB's white space is the salon-to-retail bridge between niche specialists and commodity scalp shampoo — a substantiated growth-support serum (peptide, caffeine actives) anchored in Schwarzkopf Professional trichology, kept at the cosmetic end to avoid drug-claim risk. The durable asset is clinical substantiation HCB owns; Nutrafol sits with Unilever, so the contest is credibility and channel, not catching one competitor.",
        "id": "hair.remedy.exp.hair-loss-and-thinning-growth-serums",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Scalp care & barrier repair products",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care Category (emerging category)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care emerges as standalone category) expands the profit pool from hair care into scalp health — distinct from dandruff treatment. Barrier repair, microbiome balance (T-04), and prebiotic/postbiotic formulations create a new sub-category growing 18%+ CAGR. Pool is moving from zero to a sizeable EU segment as consumer awareness accelerates via social media education.\\n\\n**2. Strategic Evaluation.** Scalp-care-as-standalone (C-07), distinct from dandruff treatment, opens a fast-forming pool around barrier repair and microbiome balance (T-04). HCB should build a substantiated scalp-health platform from Schwarzkopf Professional credibility — prebiotic and barrier actives positioned above commodity anti-dandruff and shielded below by Schauma's value tier. The bet is owning the scalp-science claim across a regimen; the moat is trichology substantiation, and the category should be claimed before prestige players extend down into it.",
        "id": "hair.remedy.exp.scalp-care-and-barrier-repair-products",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Regenerative scalp devices (LED, microcurrent)",
        "type": "tech",
        "trendCodes": [
          "T-05",
          "T-04"
        ],
        "driverNote": "T-05 Manufacturing Automation + T-04 Microbiome",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (manufacturing automation) enables precision-manufactured scalp-stimulation devices (LED, microcurrent, vibration) at consumer price points. Salon devices carry steep price tags; home versions now ship at accessible price points via T-05 miniaturization. Pool grows as devices become replenishment-paired with serums and treatments, creating multi-year customer lock-in.\\n\\n**2. Strategic Evaluation.** Miniaturization (T-05) and microbiome science (T-04) bring home scalp-stimulation devices to consumer price points, pairing them with serum replenishment for multi-year engagement. HCB lacks device infrastructure, so the honest route is white-label or OEM partnership, with HCB owning the substantiated serum regimen the device supports rather than the hardware margin. Treat the device as a proof-of-efficacy companion to a Schwarzkopf-substantiated treatment platform; this is a low-altitude, optionality play that should follow the serum science, not lead it.",
        "id": "hair.remedy.exp.regenerative-scalp-devices-led-microcurrent",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Anti-dandruff & sensitive scalp remedies",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care Category (medical positioning)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care category emergence) reframes anti-dandruff from a commodity functional category into a clinical scalp health category. T-04 (microbiome-aware formulation) enables zinc pyrithione and ketoconazole replacements with prebiotic/postbiotic actives that address root causes, not just symptoms. Margin pool expands as \"sensitive scalp remedy\" becomes a distinct, premium-priced product line.\\n\\n**2. Strategic Evaluation.** Scalp-care emergence (C-07) reframes anti-dandruff from commodity function toward clinical scalp health, and microbiome-aware actives (T-04) enable root-cause rather than symptom positioning. HCB should build a substantiated sensitive-scalp platform from Schwarzkopf Professional credibility, sitting above commodity dandruff shampoo and defended below by Schauma's value tier. The bet is owning the largest scalp-care white space with cosmetic-end clinical claims; substantiation is the moat, with the value tier as the trade-down shield against both private label and price competition.",
        "id": "hair.remedy.exp.anti-dandruff-and-sensitive-scalp-remedies",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Dermatological consultation services",
        "type": "service",
        "trendCodes": [
          "C-10"
        ],
        "driverNote": "C-10 Hair Loss Treatments + clinical approach",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-10 (hair loss mainstream) and tele-derm DTC disruption (C-32, Hims/Hers/Ro at multi-billion run-rate) normalize direct consumer access to dermatological diagnosis. Henkel can anchor retail consultation services to drive product prescription: in-store scalp diagnostics tied to Schwarzkopf Professional trichology IP create a recurring consultation-to-purchase loop that competitors cannot replicate.\\n\\n**2. Strategic Evaluation.** Tele-derm DTC (C-10, C-32) normalises direct consumer access to scalp diagnosis, and a retail consultation layer can convert that intent into a diagnosis-to-regimen loop. HCB's edge is Schwarzkopf Professional trichology IP translated into in-store scalp diagnostics and microbiome-aware education (T-04) that recommend a substantiated product regimen. The durable asset is the proprietary diagnostic-plus-substantiation capability competitors cannot easily replicate; build it as a service that pulls through the clinical product platform, keeping guidance cosmetic and referring genuine medical need onward.",
        "id": "hair.remedy.exp.dermatological-consultation-services",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Low-level light therapy (LLLT) scalp tools",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing + clinical efficacy",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (manufacturing automation) and clinical validation of LLLT (red/near-infrared light) for hair growth enable consumer LLLT devices at scale. Salon LLLT sessions carry a clear per-visit fee; home LLLT caps sit at an accessible price with 2-3 year expected value, creating device-plus-serum bundled revenue. Pool grows from zero to a meaningful EU segment as devices become mainstream replenishment drivers.\\n\\n**2. Strategic Evaluation.** Manufacturing scale (T-05) and accumulating clinical validation bring LLLT scalp devices to consumer reach, bundled with serum replenishment. As with other hardware, HCB should partner or white-label the device and own the substantiated serum regimen it pairs with, anchored in Schwarzkopf Professional credibility and kept to defensible cosmetic claims. This is a low-altitude optionality bet that should ride the trichology-serum platform; the durable value is the substantiated treatment system, not winning a device-specs race against prestige entrants.",
        "id": "hair.remedy.exp.low-level-light-therapy-lllt-scalp-tools",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Prebiotic & probiotic scalp treatments",
        "type": "product",
        "trendCodes": [
          "T-04"
        ],
        "driverNote": "T-04 Microbiome Science (new category)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-04 (microbiome-aware formulation) enables prebiotic and postbiotic scalp treatments that preserve or restore scalp microbiome balance instead of killing microbes. Pool migrates from anti-microbial commodity (Head & Shoulders, zinc pyrithione) to precision microbiome science commanding 2-3x margin. Growth rate 18-22% CAGR as category awareness builds via social media education.\\n\\n**2. Strategic Evaluation.** Microbiome-aware formulation (T-04) shifts scalp treatment from anti-microbial commodity toward precision actives that preserve rather than strip the microbiome — a premiumizing, science-led pool. HCB's right-to-win is genuine prebiotic and postbiotic formulation substantiated by Schwarzkopf Professional R&D, positioned on professional credibility against both prestige and DTC players (Vegamour is independent DTC, not an HCB asset). The bet is a defensible microbiome platform with real evidence; a low-altitude but durable claim where rigorous substantiation, not marketing, is the moat.",
        "id": "hair.remedy.exp.prebiotic-and-probiotic-scalp-treatments",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Nutritional supplementation programs",
        "type": "product",
        "trendCodes": [
          "C-05",
          "C-10"
        ],
        "driverNote": "C-05 Silver Economy + C-10 Hair Loss holistic",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-05 (silver economy) and C-10 (hair loss mainstream) drive demand for hair-health supplement protocols. C-23 (wellness-to-beauty convergence) normalizes topical-plus-oral regimens: biotin, collagen, and marine proteins paired with serum/treatment as holistic hair-health systems. Pool grows as supplements become category-defining, not niche add-ons, scaling 15%+ CAGR.\\n\\n**2. Strategic Evaluation.** Silver-economy demand and mainstream hair loss (C-05, C-10), plus wellness-to-beauty convergence (C-23), normalise topical-plus-oral regimens. HCB has no supplement infrastructure, so the honest route is partner or white-label, not buying a brand on invented economics — pair a Schwarzkopf-substantiated topical with a partner ingestible as one regimen. Nutrafol sits with Unilever as category proof, not a template to copy financially. The durable asset is HCB's substantiated topical anchor; the supplement attaches to it, and the capability bet is regimen design, not nutraceutical manufacturing.",
        "id": "hair.remedy.exp.nutritional-supplementation-programs",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "US Hispanic-consumer hair care ranges & bilingual merchandising",
        "type": "product",
        "trendCodes": [
          "C-18"
        ],
        "driverNote": "C-18 Hispanic/Latino consumers drive US category growth — Henkel US portfolio under-indexed",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-18: Hispanic consumers are the demographic engine of US hair-category growth — higher spend per capita on care and styling, distinct texture and routine needs, and brand loyalty patterns that reward early movers. Henkel US (Schwarzkopf, got2b) has minimal Hispanic-specific range or merchandising today; the growth accrues to whoever shows up designed-for rather than translated-to.\n\n**2. Strategic Evaluation.** Hispanic consumers are a structural US category growth engine (C-18) with distinct texture and routine needs, and HCB is under-indexed today. The bet is a designed-for range — texture-inclusive care, authentic merchandising, credible community partnerships — not a marketing overlay on existing SKUs, with got2b's organic Hispanic styling following as the bridgehead. Build on the shared C-24 textured-hair platform to avoid two parallel texture stacks. The durable asset is authentic designed-for credibility; growth accrues to whoever shows up built-for rather than translated-to.",
        "id": "hair.remedy.exp.us-hispanic-consumer-hair-care-ranges-and-biling",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Longevity-positioned scalp & hair actives (NAD+, senolytic-inspired)",
        "type": "product",
        "trendCodes": [
          "C-21",
          "T-14"
        ],
        "driverNote": "C-21 longevity crossover + T-14 peptide/bioactive science entering consumer formulation",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-21 + T-14: longevity medicine's ingredient stack (NAD+ precursors, GHK-Cu peptides, senolytic-inspired actives) is crossing into consumer hair care with lab-to-shelf timelines compressed to 18-24 months. The pool premiumises: science-substantiated 'hair longevity' commands skincare-level price points in the treatment stage.\n\n**2. Strategic Evaluation.** Longevity medicine's ingredient stack (C-21, T-14: NAD+ precursors, GHK-Cu peptides) is crossing into hair care, premiumizing the treatment stage toward skincare-level positioning. The gating asset is clinical substantiation, and Schwarzkopf Professional R&D can credibly produce it where mass-market longevity-washing cannot. Position firmly at the cosmetic end to avoid quasi-pharma classification (G-03), and price against premium skincare serums. This is a low-altitude but strategically important bet: building the longevity-actives substantiation platform now establishes a defensible claim before the science becomes commonplace.",
        "id": "hair.remedy.exp.longevity-positioned-scalp-and-hair-actives-nad-",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Ingestible + topical combined hair regimens (Nutrafol model)",
        "type": "product",
        "trendCodes": [
          "C-23"
        ],
        "driverNote": "C-23 wellness-to-beauty convergence — supplement + topical regimens, Unilever/Nutrafol proof",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-23: Nutrafol (Unilever) proved that oral supplement + topical regimens command pharmacy-level loyalty and premium monthly subscription economics in hair wellness. The pool is additive — ingestibles attach to, rather than replace, topical care — and it medicalises the remedy stage.\\n\\n**2. Strategic Evaluation.** Wellness-to-beauty convergence (C-23) makes oral-plus-topical regimens an additive, loyalty-building pool that medicalises the remedy stage. HCB has no supplement infrastructure, so the capture route is partnership or white-space licensing — a Schwarzkopf-substantiated topical paired with a partner ingestible, sold as one regimen (Nutrafol sits with Unilever as proof of concept, not an acquisition template). Treat as an option play contingent on the C-21 longevity positioning landing first, since it serves the same consumer and claim architecture; the durable anchor remains HCB's substantiated topical.",
        "id": "hair.remedy.exp.ingestible-topical-combined-hair-regimens-nutraf",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Peptide & bioactive repair lines (GHK-Cu, NAD+ precursors)",
        "type": "product",
        "trendCodes": [
          "T-14"
        ],
        "driverNote": "T-14 peptide hair science — $2-3B emerging segment, 15%+ CAGR, 18-24mo lab-to-shelf",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-14: peptide-based hair care is a multi-billion emerging segment growing 15%+, with AI-compressed lab-to-shelf timelines (18-24 months) letting actives cross from longevity medicine into consumer formulation while the science is still news. Back-loaded peak (2033) and low confidence in the DB reflect that consumer-concentration efficacy evidence is still accumulating.\\n\\n**2. Strategic Evaluation.** Peptide and bioactive hair science (T-14) is an emerging, back-loaded pool where consumer-concentration efficacy evidence is still accumulating. HCB should enter through Schwarzkopf Professional first — salon-channel substantiation builds the evidence base and pricing reference before mass rollout, and keeps positioning at the cosmetic end (G-03). Pair with C-21 longevity framing and resist out-claiming the data, which is the fastest route to a substantiation problem. The durable asset is a clinically-backed peptide platform HCB controls; patient, evidence-led entry is the right-to-win, not first-to-shout.",
        "id": "hair.remedy.exp.peptide-and-bioactive-repair-lines-ghk-cu-nad-pr",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "K-beauty scalp serums & glass-hair treatment imports",
        "type": "product",
        "trendCodes": [
          "X-08"
        ],
        "driverNote": "X-08 K-beauty wave — EU market $2.7B, Amorepacific-led, treatment-stage entry",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-08: the K-beauty export wave has reached EU hair care (a multi-billion pool, 6.4% CAGR, Amorepacific leading) and it enters through the treatment stage — scalp serums, glass-hair masks, multi-step regimens with skincare-grade ingredient stories. It expands the remedy pool (consumers add steps) while resetting expectations for texture, packaging and ingredient transparency.\\n\\n**2. Strategic Evaluation.** The K-beauty export wave (X-08) enters through the treatment stage with skincare-grade ingredient stories, expanding the remedy pool while resetting consumer expectations on texture and transparency. HCB should treat this as demand to ride, not only a competitor to block — credible K-inspired textures and actives under Gliss and Schwarzkopf reach the K-curious mainstream that won't buy import brands. Defend pharmacy and drugstore shelves where import distribution is thinnest; in e-commerce the contest is content velocity. The durable bet is fast, substantiated absorption of the trend into HCB's owned platforms.",
        "id": "hair.remedy.exp.k-beauty-scalp-serums-and-glass-hair-treatment-i",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Generic dandruff shampoo (commoditized)",
        "type": "product",
        "trendCodes": [
          "C-03",
          "C-07"
        ],
        "driverNote": "C-03 Premiumization + C-07 Scalp Care specialization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) and C-07 (scalp care specialization) collapse the commodity dandruff-shampoo category. Generic zinc pyrithione and ketoconazole formulas face simultaneous pressure: upmarket migration toward prebiotic/barrier science, and downmarket pressure from private label. Pool contracts 12-15% annually as consumers either upgrade to clinical or downgrade to PL.\\n\\n**2. Strategic Evaluation.** Premiumization and scalp-care specialization (C-03, C-07) squeeze commodity dandruff shampoo from both ends — upgrade toward prebiotic and barrier science above, private label below. Defend selectively and redeploy: rationalise Schauma's anti-dandruff range and reposition it as the value gateway and trade-down shield, with a diagnostic tie-in that routes upgrade intent to HCB's substantiated scalp-care platform. The durable margin migrates to clinical scalp science; the commodity tier's role is to hold the value consumer and feed the premium build, not to absorb investment defending share.",
        "id": "hair.remedy.con.generic-dandruff-shampoo-commoditized",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Water softening devices for hair",
        "type": "tech",
        "trendCodes": [
          "T-08"
        ],
        "driverNote": "T-08 Connected home water treatment integrated",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-08 (connected appliances & smart home) integrates water-treatment diagnostics into washing machines and showerheads (Bosch, Miele partnerships). Standalone water-softening devices for hair become obsolete as consumers receive real-time water hardness alerts and AI-recommended formulation adjustments via app. Hardware market collapses; software and precision formulation pools expand.\\n\\n**2. Strategic Evaluation.** Connected appliances (T-08) embed water-treatment diagnostics into machines and showerheads, making standalone hair water-softeners structurally obsolete as consumers get real-time hardness data and guided product pairing. Do not invest in the hardware. The capability worth building is water-aware formulation and recommendation — substantiated products that adjust to detected conditions, surfaced through appliance ecosystems where relevant. The durable value sits in HCB's chemistry and the data-driven recommendation layer, not in a device the smart home is absorbing.",
        "id": "hair.remedy.con.water-softening-devices-for-hair",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Life-phase condition-based programs",
        "type": "service",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 AI Personalization > generic life-phase segments",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 (AI personalization at scale) and T-01 (AI-driven formulation) make static life-phase segments (teen, mature, aging) obsolete. Consumers expect dynamic, real-time personalization based on hair condition, microbiome status, and environmental factors — not age cohorts. Programs relying on demographic segmentation lose share to algorithm-driven customization; pool contracts for static segmentation, expands for dynamic.\\n\\n**2. Strategic Evaluation.** AI personalization (T-07) and AI-driven formulation (T-01) erode static life-phase segmentation as consumers expect recommendations keyed to real-time hair and scalp condition, not age cohorts. Harvest-and-redeploy: retire demographic-segmented lines and build a condition-diagnostic recommendation capability that routes consumers to the substantiated SKU, consolidating fragmented ranges behind one engine. The durable asset is the diagnostic-to-product layer tied to HCB's clinical platforms; static segmentation becomes a liability, while the personalization capability becomes the connective tissue across the remedy portfolio.",
        "id": "hair.remedy.con.life-phase-condition-based-programs",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Synthetic scalp cooling treatments",
        "type": "product",
        "trendCodes": [
          "T-02"
        ],
        "driverNote": "T-02 Bio-Based Chemistry replaces synthetics",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 (bio-based chemistry transition) and consumer preference for botanical actives make synthetic cooling agents (menthol derivatives, WS-3 replacements) subject to reformulation pressure. Bio-based cooling (spearmint, peppermint, eucalyptus) deliver equivalent sensory but demand premium positioning. Synthetic-only products lose margin as reformulation cost exceeds sales potential.\\n\\n**2. Strategic Evaluation.** Bio-based chemistry transition and botanical preference (T-02) put synthetic cooling agents under reformulation pressure, where conversion cost can exceed the value of slow-moving SKUs. Audit exposed cooling formulations and convert only where the cooling sensation reinforces a substantiated scalp-care claim; elsewhere harvest and migrate consumers to HCB's upgraded premium tier. The principle is not to carry undifferentiated SKUs through a reformulation transition — redeploy the effort into bio-based actives that strengthen the defensible scalp-science platform rather than preserving a sensory commodity.",
        "id": "hair.remedy.con.synthetic-scalp-cooling-treatments",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Mass-market anti-hair-loss treatments (indie pressure)",
        "type": "product",
        "trendCodes": [
          "X-04"
        ],
        "driverNote": "X-04 DTC & Indie Brand Disruption (K18, Olaplex, Virtue)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-04 (DTC & indie brand disruption) — Olaplex, K18, Virtue, Nutrafol — have captured the fastest-growing hair-loss sub-segment through social credibility and premium positioning. Mass-market anti-hair-loss products (P&G, unbranded generics) face contraction as consumers trade up to indie brands with stronger digital presence and clinical proof. Pool contracts 8-10% annually as indie pressure widens.\\n\\n**2. Strategic Evaluation.** Indie and DTC momentum (X-04) captures the fastest-growing hair-loss sub-segment on social credibility and premium positioning, contracting undifferentiated mass products. HCB's only structural defense is trichological substantiation: a Schwarzkopf Professional growth-support serum positioned on genuine clinical credibility and salon heritage rather than a price or specs race (Olaplex and K18 are independent; Nutrafol sits with Unilever). Defend by elevating into substantiated science kept at the cosmetic end, not by deepening commodity SKUs — the durable position is credibility the indies cannot manufacture quickly.",
        "id": "hair.remedy.con.mass-market-anti-hair-loss-treatments-indie-pres",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "OTC retail hair-loss products (prescription bypass)",
        "type": "product",
        "trendCodes": [
          "C-32"
        ],
        "driverNote": "C-32 tele-derm DTC routes hair-loss demand around the retail shelf",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-32 contraction side: as tele-derm platforms route hair-loss sufferers directly to prescription regimens, OTC retail hair-loss products lose their highest-intent customers — the segment most willing to pay premium prices exits the shelf channel entirely. Retail retains only the prevention-curious and price-constrained.\n\n**2. Strategic Evaluation.** Tele-derm (C-32) routes the highest-intent hair-loss sufferers to prescription regimens, draining OTC retail of the consumers most willing to pay premium and leaving the prevention-curious and price-constrained. Do not over-invest in efficacy-claim OTC SKUs that prescription now dominates. Reposition retail toward maintenance-between-prescriptions and cosmetic densifying — the instant-appearance claim that prescription cannot make — anchored in Schwarzkopf credibility. The defensible retail pool is appearance and adjunct care, not cure; harvest the efficacy-positioned line and redeploy into the complementary cosmetic role.",
        "id": "hair.remedy.con.otc-retail-hair-loss-products-prescription-bypas",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "transform",
    "label": "Transform",
    "benefiting": [
      {
        "name": "Permanent & demi-permanent color (advanced)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization Color Care (core trend)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Premium permanent and demi-permanent color is the structural beneficiary of C-03 (premiumisation) — consumers upgrade to salon-grade efficacy at retail price points. The European at-home color pool tilts toward formulations with bond protection, condition-in-color, and ingredient transparency at a premium price, away from budget alternatives. K-07 (salon-retail crossover, a multi-billion pool at 63% B2C) is the structural pull.\\n\\n**2. Strategic Evaluation.** This is HCB's leading hair profit pool and where premiumisation concentrates value this decade, so it must be defended at the high end, not in the middle. The bet is to keep Creme Supreme the European reference for salon-grade efficacy by codifying Schwarzkopf colour science and bond-preservation into a visible, substantiated claim, with Syoss and Palette laddered beneath it. Right-to-win rests on professional colour heritage — Igora/BlondMe authority crossing into retail — owning the demi-permanent upgrade path as the on-ramp into permanent colour.",
        "id": "hair.transform.exp.permanent-and-demi-permanent-color-advanced",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Balayage, highlight & brow tints",
        "type": "product",
        "trendCodes": [
          "C-03",
          "K-07"
        ],
        "driverNote": "C-03 Premiumization + K-07 Professional Salon",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Creative color (balayage, highlights, tonal brows) sits at the intersection of salon premium (K-07 salon crossover, a multi-billion pool at 63% B2C) and premiumization (C-03). Consumers are willing to pay a clear premium for at-home balayage and brow color systems that previously required pricier salon appointments. The pool expands when retail captures the salon occasion without compromising quality perception.\\n\\n**2. Strategic Evaluation.** Creative colour sits where salon premium and at-home premiumisation overlap, and the pool grows as retail credibly captures occasions that once required a salon visit. The bet is to own dimensional, multi-tone application as a system — Schwarzkopf colour science plus LIVE's fashion-shade equity — engineered so a non-professional achieves a salon-looking result. Precision applicators and shade-matching are a capability gap PRISM cannot assume HCB holds; license or partner deliberately rather than build from scratch. Salon-to-retail crossover is the durable moat, not promotion.",
        "id": "hair.transform.exp.balayage-highlight-and-brow-tints",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Bond repair & strengthen treatments",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-Driven bond chemistry + premiumization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Bond-repair chemistry (GHK-Cu peptides, amino acid complexes) moved from salon back-bar additive to mass-consumer premium category in 18 months. T-01 (AI-driven formulation) and T-14 (peptide bioactives) compress R&D cycles, enabling rapid category-following for brands with credible science. Gliss owns the keratin heritage; the pool expands when science-backed bond claims land at accessible premium price points, capturing the Olaplex-K18 premiumization wave without indie pricing.\\n\\n**2. Strategic Evaluation.** Bond repair has crossed from salon back-bar into a structural mass-premium pool, and AI-compressed formulation lets credible challengers follow fast — a pool to enter on science, not price. Olaplex and K18 are independent leaders HCB does not own; Gliss competes with them, and its keratin lineage plus clinical substantiation is the asset to weaponise. The bet is to make Gliss the trusted, broadly distributed bond-repair name in Europe, with clinically grounded claims rather than indie mystique, owning the strengthen step of the colour journey.",
        "id": "hair.transform.exp.bond-repair-and-strengthen-treatments",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Texture changers (perms, relaxers, keratin)",
        "type": "product",
        "trendCodes": [
          "T-02"
        ],
        "driverNote": "T-02 Bio-Based Chemistry (safer formulas)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Texture-changing chemistry is shifting away from damage-heavy formulations toward T-02 (bio-based actives) — keratin treatments, enzyme-based relaxers, and microbiome-safe (T-04) systems. The pool expands as safety perception improves and global textured-hair consumers (C-24 — 65% of the world has curly/coily hair) move from salon-only into retail at premium price points, a segment HCB is structurally absent from.\\n\\n**2. Strategic Evaluation.** Texture-changing chemistry is migrating from damage-heavy systems toward bio-based, gentler formulations, and the larger prize is the global textured-hair consumer moving from salon-only into premium retail — a space where HCB is structurally under-present. The bet is to build deliberately on Schwarzkopf professional colour-and-treatment science, anchoring a credible texture proposition on safer chemistry rather than chasing US-led naturals incumbents on their terms. Treat this as a multi-year capability build for a genuinely under-served pool, not a quick line extension. Ceteris paribus, absence is the real risk here.",
        "id": "hair.transform.exp.texture-changers-perms-relaxers-keratin",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Salon coloration & blending services",
        "type": "service",
        "trendCodes": [
          "K-07",
          "C-03"
        ],
        "driverNote": "K-07 Professional Salon Crossover (premium) + C-03",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Salon color blending and custom toning services command salon-level per-appointment prices; K-07 (professional-retail crossover) enables brands to capture service economics via retail product bundles — e.g., a salon appointment followed by a month of at-home toner + protectant purchases. The pool expands when retail-side SKUs are engineered to extend salon results between appointments, creating a subscription-like replenishment dynamic.\\n\\n**2. Strategic Evaluation.** Salon colour and custom toning is where the highest colour value is created, and crossover lets that economics extend into retail replenishment rather than stay trapped in the chair. Schwarzkopf Professional (Igora, BlondMe) already owns the blending authority; the bet is to convert that authority into a take-home continuation system so the salon result is maintained with branded retail product between visits. Own the bridge from professional service to at-home maintenance — that linkage, grounded in real professional credibility, is the defensible position, not a standalone promotion.",
        "id": "hair.transform.exp.salon-coloration-and-blending-services",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Color application tools (precision devices)",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation + precision dosing",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (automation) and precision electronics enable color-application tools with dosing accuracy, heat-assist, and visual feedback — moving from commodity brushes to premium semi-automated systems. Consumers pay for accuracy; brands monetise the tool as the high-margin accessory while protecting the chemistry's claim of professional efficacy.\\n\\n**2. Strategic Evaluation.** Precision application is a low-but-real tailwind: a high-margin accessory that protects the chemistry's professional-efficacy claim by making the result more reliable at home. HCB has formulation scale but not applicator hardware, so the honest path is to license or partner for the device and let Schwarzkopf colour remain the hero, with the tool as enabler rather than the bet. Treat it as a deliberate, contained capability addition that reinforces colour superiority — not a hardware business HCB needs to own outright, and not a priority over the colour and bond pools.",
        "id": "hair.transform.exp.color-application-tools-precision-devices",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Brow, lash & hair growth serums",
        "type": "product",
        "trendCodes": [
          "C-10"
        ],
        "driverNote": "C-10 Hair Loss Treatments extends to brows/lashes",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-10 (hair loss treatments entering mainstream) extends into brow and lash care — a white space where consumers previously had no branded consumer options. Peptide serums, biotin, and microbiome-aware formulas (T-14, T-04) enable clinical-grade hair-growth positioning at mass-retail accessibility. The pool expands at accessible premium price points as Gen Z and millennial consumers buy growth serums as a routine category, not a remedial one.\\n\\n**2. Strategic Evaluation.** Growth serums extending into brow and lash are a genuine white space as hair-loss treatment normalises into routine rather than remedy, but it is a low tailwind and adjacent to HCB's core colour and bond pools. The credible foundation is Schwarzkopf professional trichology science paired with got2b's youth reach as the distribution vehicle. The bet, if pursued, is a substantiated peptide-led proposition built on real science rather than category-following — a deliberate adjacency to test, not a claim of incumbency, kept proportionate to its modest pool size.",
        "id": "hair.transform.exp.brow-lash-and-hair-growth-serums",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Digital color matching & consultation",
        "type": "service",
        "trendCodes": [
          "T-01",
          "T-07"
        ],
        "driverNote": "T-01 AI + T-07 Personalization for shade match",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI-driven formulation) and T-07 (personalization at scale) compress what was a 30-minute salon consultation into a 2-minute app diagnostic — skin tone analysis, existing color history, damage assessment, and shade recommendation. The pool expands as digital diagnosis moves upmarket: a premium fee for app-based consultation vs. free box-color guidance. Brands that control the diagnosis control the SKU prescription.\\n\\n**2. Strategic Evaluation.** Whoever owns the colour diagnosis owns the SKU prescription, so digital shade-matching is strategically larger than its tooling suggests — it routes consumers into the colour and maintenance pools HCB wants to defend. Schwarzkopf holds the colour-science credibility but not the diagnostic-app capability, and L'Oréal's AR shade tools are the incumbent benchmark. The honest move is to partner for or acquire the matching layer and wrap it in Schwarzkopf authority, used to drive recommendation into Creme Supreme and the lock-and-finish protocol — capability sourced deliberately, science owned.",
        "id": "hair.transform.exp.digital-color-matching-and-consultation",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Professional-grade at-home color systems",
        "type": "product",
        "trendCodes": [
          "K-07"
        ],
        "driverNote": "K-07 Professional Salon Crossover ($23.4B market, 63% B2C)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-07 (salon-retail crossover, a multi-billion pool at 63% B2C) opens a structural seam: salon colorists now sell take-home systems for touch-ups, blending, and monthly maintenance, blurring the salon-vs-retail line. The pool expands when at-home is positioned as a 'salon extension' rather than a 'budget alternative' — pro-grade price points signal credibility while staying retail-accessible.\\n\\n**2. Strategic Evaluation.** Crossover opens a structural seam: at-home positioned as a salon extension rather than a budget alternative, which is exactly the framing that defends premium colour against trade-down. Schwarzkopf Professional (Igora, BlondMe) supplies the authority and the consumer ladder (Creme Supreme, Syoss, Palette) supplies reach; the bet is to unify them into one pro-grade system spanning salon and retail. DTC subscription challengers own the replenishment habit today — own the credibility of pro-grade-at-home and build replenishment deliberately on top of it, rather than competing on price.",
        "id": "hair.transform.exp.professional-grade-at-home-color-systems",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "LatAm salon-inspired premium colour lines",
        "type": "product",
        "trendCodes": [
          "C-20"
        ],
        "driverNote": "C-20 Brazil/Mexico premiumisation — Brazil #4 beauty market globally",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-20: Brazil is the world's #4 beauty market with a pronounced premiumisation trend in colour and treatments; Mexico adds nearshoring-driven income growth. Salon culture is strong and aspirational — at-home colour that credibly references salon technique premiumises rather than commoditises.\n\n**2. Strategic Evaluation.** LatAm premiumisation in a strong, aspirational salon culture is a real but modest tailwind where at-home colour that credibly references salon technique premiumises rather than commoditises. Schwarzkopf's professional equity can anchor a salon-inspired consumer tier above Palette, leaning on Igora authority as the proof point. Treat this as deliberate extension of the crossover model into a structurally attractive market, watching the competitive premium ladder that sets the reference, rather than a generic geographic rollout — and proportionate to its low pool weight, ceteris paribus.",
        "id": "hair.transform.exp.latam-salon-inspired-premium-colour-lines",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Temporary color (declining vs. permanent)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization drives permanent investment",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumisation) and C-04 (conscious consumption) squeeze temporary color from both sides. Consumers who want expression migrate to demi-permanent for longevity; eco-conscious buyers reject single-use gimmick formats. The pool shrinks as fashion color is cannibalised by demi-permanent from above and private-label basics from below.\\n\\n**2. Strategic Evaluation.** Temporary colour is squeezed from both sides — expression-seekers migrate to demi-permanent for longevity, value buyers to private label — so this is a clean harvest-and-redeploy, not a category to rescue. LIVE is the right vehicle to channel that migration toward longer-wear colour, capturing the consumer as they trade up rather than defending single-use formats. Redeploy the freed envelope into the demi-permanent on-ramp into permanent colour; keep got2b out of colour, since it is a styling brand and that equity does not transfer.",
        "id": "hair.transform.con.temporary-color-declining-vs-permanent",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Basic shampoos & cleansers (frequent use decline)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization shifts to treatments",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) is reframing shampoo from a commodity to a specialty category. Consumers are extending wash intervals (wearing outfits 2-3x, increasing textile longevity per C-29 and E-08), reducing shampoo frequency, and when they do wash, buying treatment-focused products instead of basic cleanse-and-go formulas. The pool contracts as frequency declines and consumers trade frequency for quality per wash.\\n\\n**2. Strategic Evaluation.** Premiumisation and falling wash frequency are reframing basic cleansing from staple to commodity, with P&G and L'Oréal dominant — so harvest the basic tier for margin rather than defend volume. The redeploy is into treatment-led propositions positioned as quality-per-wash, capturing wallet without depending on frequency. Schauma is the cash engine to run efficiently; Syoss and Schwarzkopf treatments are where freed investment should go. The strategic point is to move value up the routine toward the colour, bond and finishing pools HCB can credibly own, ceteris paribus.",
        "id": "hair.transform.con.basic-shampoos-and-cleansers-frequent-use-declin",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Gray blending (niche positioning)",
        "type": "product",
        "trendCodes": [
          "C-05"
        ],
        "driverNote": "C-05 Silver Economy prefers full color/coverage",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-05 (silver economy and aging population) suggests gray-care growth, but in practice consumers prefer full gray coverage (permanent color) or embracing gray authentically — both of which move away from \"blending\" as a category. Gray blending occupies a shrinking middle: too visible for comfort, too expensive for trial. Color coverage and authentic gray messaging both outcompete the blending niche.\\n\\n**2. Strategic Evaluation.** Despite an ageing population, demand splits between full coverage and authentic grey — both bypassing blending — leaving this niche structurally squeezed rather than growing. The clean move is to retire blending as a distinct positioning and fold its benefit into mainstream permanent colour, where Palette already plays for coverage. Simplify the portfolio rather than invest behind a shrinking middle. This is a harvest-and-consolidate call that frees focus for the premium colour pool, not a flip into a declining sub-segment.",
        "id": "hair.transform.con.gray-blending-niche-positioning",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Synthetic wigs & hair systems (stigma)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization prefers authentic color",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) and authentic-beauty cultural shift (moving away from hair-extension stigma toward textured-hair acceptance) are shrinking the wig market. Consumers who want transformation now buy color, who want volume buy treatments, who want length buy extensions as a service (salon-applied, premium-positioned). Synthetic wigs remain stigmatized as \"cover-ups\" vs. authentic expressions of identity.\\n\\n**2. Strategic Evaluation.** HCB has no meaningful position here and the pool is shrinking as transformation demand routes into colour, treatment and salon-applied extensions, so this is a monitor-only entry, not an entry to build. The relevant read is the adjacency: growing textured-hair acceptance and authentic-identity messaging open room for treatments that enhance natural hair, which is a Schwarzkopf-credible space. Hold no ambition in synthetic systems; watch the cultural shift only for where it redirects value into formulated products HCB can actually own.",
        "id": "hair.transform.con.synthetic-wigs-and-hair-systems-stigma",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Budget color boxes (home-use)",
        "type": "product",
        "trendCodes": [
          "C-11",
          "C-03"
        ],
        "driverNote": "C-11 Gen Z Dupe Culture but C-03 premiumization wins",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-11 (Gen Z dupe culture) initially reads as budget-color demand, but C-03 (premiumisation) wins the structural battle. Gen Z seeks cheap good products, not cheap products full stop — they read INCI lists and skip damage-heavy budget boxes. Private label at 42% EU6 value share is the actual budget destination; branded budget boxes are squeezed from above (premiumisation) and below (PL).\\n\\n**2. Strategic Evaluation.** Gen Z dupe culture reads as budget demand but resolves the other way — they want cheap-good, not cheap, and read ingredient lists — so private label, not branded budget boxes, is the real value destination. Concede the ultra-budget tier cleanly and stop funding sub-scale economics that lose before media. Anchor Palette at the affordable-premium hinge with credible clean-ingredient positioning, with Keratin Color at the same hinge in the US. This is disciplined exit-the-bottom to protect the premiumising colour pool, never a defence of commodity boxes.",
        "id": "hair.transform.con.budget-color-boxes-home-use",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Mid-price permanent color (squeezed middle)",
        "type": "product",
        "trendCodes": [
          "C-01",
          "C-06",
          "X-13"
        ],
        "driverNote": "C-01 Private Label + C-06 Cost-of-Living + X-13 Retailer vertical integration",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** The mid-price branded color tier is being eaten from both ends: C-01 and C-06 push value-conscious buyers into private label (42% EU6 value share); C-03 (premiumisation) pulls wallet-available consumers toward Schwarzkopf Creme Supreme and indie brands at the premium end. X-13 (retailer vertical integration) hardens the squeeze. The mid is no longer a price-tier — it is the retailer's funding line for own-label investment.\\n\\n**2. Strategic Evaluation.** The mid-price tier is being eaten from both ends — private label and cost-of-living pressure from below, premiumisation from above — and hardened by retailer integration, so it is now the funding line for own-label, not a growth line. Stop defending it as such: strip SKU complexity from the mid ranges and redeploy the trade-and-media envelope into Creme Supreme premiumisation and Palette's affordable-premium hinge in high-growth markets. In a structural mid contraction, the winner is whoever exits cleanly first while the rivals bleed velocity.",
        "id": "hair.transform.con.mid-price-permanent-color-squeezed-middle",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Standard salon-quality retail products",
        "type": "product",
        "trendCodes": [
          "X-02",
          "X-03"
        ],
        "driverNote": "X-02 Unilever B&W massive investment + X-03 P&G Superiority",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-02 (Unilever Beauty & Wellbeing pivot to a multi-billion scale with massive Hair investment) and X-03 (P&G superiority framework) are redoubling R&D and media on salon-quality positioning. Generic 'salon-quality' claims at retail are now table stakes, not differentiators. The pool contracts as claims proliferate; only brands with measurable clinical evidence — Olaplex, K18, and credentialised manufacturer-IP brands — command the premium shelf.\\n\\n**2. Strategic Evaluation.** As Unilever and P&G pour R&D and media into salon-quality claims, generic 'salon-quality' becomes table stakes and only measurable, credentialled proof commands the premium shelf — so the defence is substantiation, not louder claiming. The bet is to convert Schwarzkopf professional colour-and-bond science into consumer-visible evidence behind Creme Supreme and Syoss, paired with credible third-party seals. Without visible proof the rivals' superiority advertising hardens unchecked; with it, HCB's professional heritage becomes a defensible reason-to-believe rather than an unbacked assertion.",
        "id": "hair.transform.con.standard-salon-quality-retail-products",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Import & indie colour SKUs lacking MoCRA compliance infrastructure",
        "type": "product",
        "trendCodes": [
          "G-13"
        ],
        "driverNote": "G-13 MoCRA + US state cosmetics regulation — compliance cliff for facility registration, safety substantiation and fragrance disclosure",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-13: MoCRA plus state-level regimes (CA Prop 65 listings, state fragrance-disclosure laws) impose facility registration, safety substantiation and ingredient-disclosure obligations that hit colour chemistry hardest — and hit hardest the import and indie brands without US regulatory infrastructure. Their forced exits and reformulation delays free US shelf and search positions in colour and treatment.\n\n**2. Strategic Evaluation.** Tightening US cosmetics regulation hits colour chemistry hardest and falls heaviest on import and indie SKUs without compliance infrastructure — a compliance-as-moat moment HCB can fund as routine while sub-scale rivals cannot. The play is defensive-into-offensive: ensure the Schwarzkopf US colour portfolio is fully conformant, then lean distribution into the shelf and search positions that open as non-compliant SKUs delist. It is among the cheapest share gains available in US hair, but time-bound to the enforcement ramp, so capture is a window, not a standing advantage.",
        "id": "hair.transform.con.import-indie-colour-skus-lacking-mocra-compliance",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "lock_finish",
    "label": "Lock & Finish",
    "benefiting": [
      {
        "name": "pH balance & neutralization systems",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI-optimized pH science + color lock",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Color-treated hair requires post-color pH restoration to lock the cuticle and extend fade resistance. T-01 (AI optimisation) lets formulators engineer pH-stabilising systems as standalone SKUs rather than free in-pack rinses. The pool expands as pH balance separates from conditioning at a standalone premium — adding a transaction step to every color event and lifting average basket without cannibalising existing SKUs.\\n\\n**2. Strategic Evaluation.** Post-colour pH restoration is the cleanest expression of owning colour longevity — it adds a substantiated, separately monetised step to every colour event rather than cannibalising existing SKUs. Schwarzkopf Professional holds the pH science; the consumer ladder lacks a branded neutralisation step, which is the gap to fill. The bet is to make a Schwarzkopf colour-lock pH step the default companion to Creme Supreme, Syoss and Keratin Color, educating that pH lock equals longer colour life — converting professional credibility into the downstream maintenance pool, ceteris paribus.",
        "id": "hair.lock_finish.exp.ph-balance-and-neutralization-systems",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "After-color bond protection / cuticle sealing",
        "type": "product",
        "trendCodes": [
          "T-01",
          "C-03"
        ],
        "driverNote": "T-01 AI bond preservation + C-03 premiumization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI bond preservation) and T-14 (peptide bioactives) enable post-color serums that actively protect color molecules and re-seal cuticles, moving past passive moisturising. The pool expands when consumers learn that color longevity is a four-step protocol (shampoo → condition → pH balance → bond seal), each step monetised separately — basket size lifts from one bottle to the full multi-step protocol.\\n\\n**2. Strategic Evaluation.** After-colour bond protection turns colour longevity into a multi-step protocol, lifting basket as consumers learn that protecting colour molecules and resealing the cuticle is a distinct, valuable step. Gliss owns post-treatment positioning at mass and Schwarzkopf owns the colour science — the bet is to pair them, making a Gliss colour-seal proposition the protection layer that completes the Schwarzkopf colour event. Ground it in real bond and cuticle science rather than vague protect claims; this is the downstream monetisation of colour superiority, owned through credibility, not bundling alone.",
        "id": "hair.lock_finish.exp.after-color-bond-protection-cuticle-sealing",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Color stabilizers & color-lock serums",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI color chemistry + extended fade resistance",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI color chemistry) lets formulators bind and stabilise color pigments inside the cortex — a step beyond conditioning, with measurable fade-resistance claims (5+ wash durability) at a clear premium. The pool expands as the consumer mental model shifts from 'color that fades naturally' to 'color I actively maintain', lifting both purchase frequency and basket size around each color event.\\n\\n**2. Strategic Evaluation.** Colour-lock is existential for Schwarzkopf because it is the downstream monetisation of colour superiority — it shifts the consumer model from colour that fades to colour actively maintained, lifting frequency and basket around every colour event. The bet is to own the maintenance step with a substantiated Schwarzkopf colour-shield proposition as the required follow-on to Creme Supreme, with Gliss as the accessible tier beneath. Win the maintenance mental model before rivals harden their own protocol messaging; the asset is proven fade-resistance grounded in Schwarzkopf colour science, not claim volume.",
        "id": "hair.lock_finish.exp.color-stabilizers-and-color-lock-serums",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Premium hair perfumes & scent finishing",
        "type": "product",
        "trendCodes": [
          "C-09",
          "T-17"
        ],
        "driverNote": "C-09 Fragrance Premiumization + T-17 Neurocosmetics & sensory-science",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-09 (fragrance premiumization) and T-17 (neurocosmetics and sensory-science) are elevating hair perfume from a commodity gimmick to a functional, neuro-backed finishing category. Consumers now pay a clear premium for scents engineered for specific cognitive/emotional outcomes (focus, calm, social confidence). The pool expands as scent finishing is repositioned from \"just smells nice\" to \"measurable sensory and psychological benefit.\" Indie premium brands (Moroccanoil, Oribe) dominate; mass brands are absent.\\n\\n**2. Strategic Evaluation.** Sensory premiumisation is lifting hair scent from gimmick to a functional finishing category, but it is a low tailwind adjacent to HCB's colour core and currently owned by indie premium players. Taft and got2b have distribution but no fragrance-finishing equity, so the honest path — if pursued — is to source sensory and fragrance capability through partnership rather than overclaim ownership of it. Treat this as a deliberate, contained adjacency riding got2b's youth reach, kept proportionate to a modest pool and never ahead of the colour-longevity bets.",
        "id": "hair.lock_finish.exp.premium-hair-perfumes-and-scent-finishing",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Post-color stabilization services",
        "type": "service",
        "trendCodes": [
          "K-07"
        ],
        "driverNote": "K-07 Professional Salon Crossover (premium service)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-07 (salon-retail crossover) lets salons sell post-appointment stabilisation services (pH-balance rinses, bonding treatments, color-lock serums applied in-salon) at a clear service premium, with retail take-home products completing the protocol. The pool expands when salon and retail coordinate: salon service → retail continuation → subscription replenishment becomes a service-to-commerce revenue stream.\\n\\n**2. Strategic Evaluation.** Crossover lets salons monetise post-colour stabilisation in-chair while retail completes the protocol at home — a service-to-commerce bridge that extends colour longevity value into replenishment. Schwarzkopf Professional (Igora) owns the salon relationship and Creme Supreme owns the premium retail tier; the bet is to connect them so an in-salon stabilisation step routes deliberately into branded take-home maintenance. Own that professional-to-retail handoff, grounded in real salon credibility, as the durable position — a medium tailwind that reinforces the broader colour-longevity ownership thesis.",
        "id": "hair.lock_finish.exp.post-color-stabilization-services",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Color-protective oil treatments",
        "type": "product",
        "trendCodes": [
          "T-02",
          "C-03"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + C-03 Premiumization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-02 (bio-based chemistry) replaces petrochemical silicones with plant-derived oils that condition and color-protect simultaneously, a positioning that is both functional and conscious-consumption credible. The pool expands as oils enter the routine as a 5-minute pre-wash treatment at an accessible premium; bio-based positioning sustains a 20-30% premium over silicone equivalents.\\n\\n**2. Strategic Evaluation.** Bio-based oils that condition and protect colour at once are both functional and conscious-consumption credible, expanding as a premium routine step rather than a commodity. Gliss carries the oil heritage and Schwarzkopf the colour science — the bet is to pair them into a colour-protect oil substantiated on genuine plant-derived sourcing, positioned as a salon-style pre-treatment in the maintenance protocol. The right-to-win is real ingredient substantiation plus colour-longevity credibility, not generic naturals claiming; this strengthens HCB's ownership of the lock-and-finish pool around its colour franchise.",
        "id": "hair.lock_finish.exp.color-protective-oil-treatments",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Ionic sealing hair tools",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing enables precision sealing",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (manufacturing automation) enables precision production of ionic-sealing tools (ionic hairbrushes, combs with micro-current sealing) at consumer-accessible price points. The pool expands as consumers combine post-color product (serum, oil) with mechanical sealing tools, increasing basket and repeat purchase frequency. Tools also command recurring blade/brush replacement revenue.\\n\\n**2. Strategic Evaluation.** Ionic sealing tools are a low tailwind ecosystem adjacency — mechanical sealing paired with colour-lock product — where HCB has no hardware capability and established tool brands lead. The honest path is to license or partner for the device and let it serve the colour-seal serum rather than become a hardware business HCB needs to own. Keep it deliberately contained: a complement that reinforces colour-longevity ownership for coloured hair, not a priority bet, and never an assumed in-house competence. Proportionate to a modest pool, ceteris paribus.",
        "id": "hair.lock_finish.exp.ionic-sealing-hair-tools",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Texture-first styling & definition lines",
        "type": "product",
        "trendCodes": [
          "C-24"
        ],
        "driverNote": "C-24 textured hair — definition, frizz and hold needs unserved by straight-hair styling stacks",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-24 at the styling stage: curl definition, frizz control and flexible hold for textured hair are chronically under-served by styling ranges built around straight-hair aesthetics. Styling is got2b's franchise — the brand's youth equity gives Henkel a faster route into texture-first styling than care-led competitors.\n\n**2. Strategic Evaluation.** Curl definition, frizz control and flexible hold for textured hair are chronically under-served by styling ranges built around straight-hair aesthetics, making this a credible entry point even as a low tailwind. Styling is got2b's franchise, and its youth equity plus styling's lighter substantiation burden make it HCB's fastest honest route into the textured-hair demand space — co-developed with textured-hair expertise rather than retrofitted. The strategic value is that it builds permission and credibility for a larger care-stage texture play later, not just incremental styling volume.",
        "id": "hair.lock_finish.exp.texture-first-styling-and-definition-lines",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Basic hold & fix products (commoditized)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization eliminates low-end category",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) is eliminating the basic hold tier. Consumers who want strong hold are willing to pay a premium for performance formulas (waxes, pastes with texture) that deliver lasting hold + style without crunch. Commodity gels and sprays at budget prices are squeezed: too weak to justify purchase, too unsophisticated for premiumization consumers. The pool contracts as the basic tier collapses into private label and the viable margin moves upmarket.\\n\\n**2. Strategic Evaluation.** Premiumisation is collapsing the basic-hold tier from both ends — too weak to justify purchase, too unsophisticated for premium consumers — pushing commodity gels and sprays into private label. The disciplined move is to harvest and exit the bottom: retire basic-hold SKUs and concentrate got2b on premium texture formats for youth and Taft on a clear premium finishing position. Move margin and focus upmarket rather than defending a vanishing commodity tier. This is clean exit-and-concentrate within styling, freeing attention for the colour and finishing pools, never a flip to defend basics.",
        "id": "hair.lock_finish.con.basic-hold-and-fix-products-commoditized",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Shine-only products (low differentiation)",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI formulation > commodity shine boost",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI formulation) has made simple shine boosters obsolete. Brands now position finishers with compound benefits: shine + color lock, shine + bond protection, shine + neurocosmetic fragrance. Consumers no longer pay for shine-only products when a small step up gets them shine + functional benefit. The pool contracts as single-benefit finishers lose viability to multi-benefit premiumized alternatives.\\n\\n**2. Strategic Evaluation.** AI-enabled multi-benefit finishing has made single-benefit shine boosters redundant — consumers will not pay for shine alone when a small step up buys shine plus a functional benefit. Harvest and rationalise: retire shine-only SKUs and fold shine into compound finishers, ideally shine paired with colour-seal so the benefit reinforces the colour-longevity franchise. Clean up the portfolio and redirect the space toward functional finishing where HCB's colour science earns the claim. This is disciplined consolidation, not a defence of an undifferentiated commodity, ceteris paribus.",
        "id": "hair.lock_finish.con.shine-only-products-low-differentiation",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Conventional plastic hair accessories",
        "type": "product",
        "trendCodes": [
          "C-04",
          "G-04"
        ],
        "driverNote": "C-04 Conscious Consumption + G-04 PPWR plastic",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-04 (conscious consumption) and G-04 (PPWR packaging waste regulation mandating recycled content and reduction by 2030) are eliminating single-use plastic accessories. Consumers and regulation jointly squeeze plastic clips, combs, and hair ties out of branded listings. The pool contracts as plastic accessories migrate to private label (if at all) and eco-conscious consumers switch to reusable metal and biodegradable options.\\n\\n**2. Strategic Evaluation.** Conscious consumption and packaging-waste regulation are jointly squeezing single-use plastic accessories out of branded listings — a low headwind in a category where HCB holds little position. The pragmatic call is to deprioritise: where Schwarzkopf or got2b carry accessories, transition to recycled and durable materials to stay compliant, but make no growth bet on a structurally declining, off-strategy space. Concentrate investment on formulated products where HCB has proprietary colour and bond advantage. Treat this as compliant tidy-up and exit, not a defence of plastic accessories.",
        "id": "hair.lock_finish.con.conventional-plastic-hair-accessories",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Cheap fragrance finishing sprays",
        "type": "product",
        "trendCodes": [
          "C-09"
        ],
        "driverNote": "C-09 Fragrance Premiumization (budget brands decline)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-09 (fragrance premiumization) is bifurcating the finishing-spray market: premium neurocosmetic fragrances (with sensory and emotional claims) are expanding, while cheap fragrances are collapsing. Budget fragrance finishing offers no differentiation vs. body spray; premium fragrance finishing commands margin and loyalty. The pool contracts in the budget tier and expands in the premium tier.\\n\\n**2. Strategic Evaluation.** Fragrance premiumisation is bifurcating finishing sprays — premium sensory propositions expand while cheap fragrance, undifferentiated from body spray, collapses. The move is to harvest the budget tier and, if HCB plays at all, consolidate into a single elevated finishing proposition through got2b's youth reach, with sensory and fragrance capability sourced through partnership rather than overclaimed. Exit the commodity end cleanly and concentrate any investment at the premium hinge. This is disciplined consolidation toward where margin lives, kept proportionate to a modest pool, never a defence of cheap sprays.",
        "id": "hair.lock_finish.con.cheap-fragrance-finishing-sprays",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Unsubstantiated \"natural\" finishing products",
        "type": "product",
        "trendCodes": [
          "G-05"
        ],
        "driverNote": "G-05 Green Claims Directive (Sept 2026 enforcement)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** G-05 (Green Claims Directive, enforceable Sept 2026) is eliminating unsubstantiated \"natural\" and \"eco\" claims from finishing products. Brands making generic \"plant-derived\" or \"natural hold\" claims without measurable proof will be de-listed or face regulatory fines. The pool contracts as brands with unsubstantiated claims exit, and only brands with third-party certified proof (NATRUE, Ecocert, dermatological testing) retain listings.\\n\\n**2. Strategic Evaluation.** Green-claims enforcement is stripping unsubstantiated 'natural' and 'eco' language from finishing products, delisting soft claims that lack proof — a compliance-driven headwind that HCB should turn defensive-into-offensive. Audit got2b and Taft finishing claims and either back genuine naturalness with third-party certification or pivot to clinically grounded functional claims, dropping unbacked language entirely. As under-substantiated rivals exit, credible substantiation becomes the entry ticket and a relative advantage for a player that can fund proof. The thesis is substantiate-or-pivot-and-capture, not defend vague claiming.",
        "id": "hair.lock_finish.con.unsubstantiated-natural-finishing-products",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Mass styling & body-care tiers under ultra-fast-fashion price floor",
        "type": "product",
        "trendCodes": [
          "C-33",
          "X-05"
        ],
        "driverNote": "C-33 Shein/Temu beauty price-floor collapse + X-05 Chinese brand EU entry",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-06",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-33 + X-05: Shein, Temu and Pinduoduo-owned beauty lines are importing the ultra-fast-fashion model into mass hair and body care — direct-from-factory price points that reset the consumer's reference price for styling and body SKUs. Combined with early Chinese brand entry into EU (<2% today but tariff-redirected export pressure building), the mass tier's price floor is collapsing from below.\n\n**2. Strategic Evaluation.** Factory-direct ultra-fast-fashion beauty is resetting the consumer's reference price for mass styling and body SKUs, and HCB's value tiers cannot win a price war against that economics — so concede the absolute floor and defend the 'cheapest brand I trust' position instead. The durable defence is efficacy substantiation, safety-and-compliance trust as a moat, and speed-to-trend through got2b and Taft. Hold the trusted-value line, do not chase the floor down, and watch for the inflection where platforms add compliant private label at scale. Harvest-and-hold, not a price-led defence.",
        "id": "hair.lock_finish.con.mass-styling-and-body-care-tiers-under-ultra-fas",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "maintain_optimize",
    "label": "Maintain & Optimize",
    "benefiting": [
      {
        "name": "Color protection systems (UV, heat, pollution)",
        "type": "product",
        "trendCodes": [
          "T-02",
          "T-01"
        ],
        "driverNote": "T-02 Bio-Based Chemistry + T-01 nano-protection",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** UV and heat damage rise structurally as hairdryer and styling-tool use grows on the back of remote-work flexibility and social consumption. T-01 (AI formulation) and T-02 (bio-based UV / heat-shield chemistry) bring clinical-grade protection into mass SKUs. Consumers now pay 2-3x for clinically-proven color-hold benefits — the category nicety has become a non-negotiable maintenance step.\\n\\n**2. Strategic Evaluation.** As heat-styling and environmental exposure normalise, protection migrates from optional finisher to a credentialed maintenance layer, and the pool tilts to whoever owns the efficacy claim. Bio-based and AI-accelerated chemistry (T-02/T-01) let HCB carry clinical-grade UV, heat and pollution defence down into mass tiers. The right-to-win is Schwarzkopf Professional trichology and Gliss treatment lineage: build a substantiated colour-protection platform anchored in proven actives rather than a marketing claim, so the science, not the price, defends the position over the decade.",
        "id": "hair.maintain_optimize.exp.color-protection-systems-uv-heat-pollution",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Climate-adaptive protection shields",
        "type": "product",
        "trendCodes": [
          "T-02",
          "E-05"
        ],
        "driverNote": "T-02 Bio-Based + E-05 Climate Pest Shifts concern",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** Extreme weather volatility (E-05: climate-driven pest, allergen, and humidity shifts) reshapes Hair care as a seasonal adaptation problem, not a static routine. Consumers in high-humidity zones, pollen-heavy regions, and heat-stress climates purchase category-specific formulas; regional variants increase SKU count and allow pricing variation. T-02 (bio-based) ingredients enable region-by-region microdosing of actives, turning what was a global formula into a local prescription.\\n\\n**2. Strategic Evaluation.** Climate volatility reframes maintenance as a regional adaptation problem rather than one global formula, opening a durable platform around humidity, heat and allergen defence (E-05). Bio-based actives (T-02) make local tuning of a shared protection base economically viable. HCB's right-to-win is design-once-tune-locally chemistry built on Schwarzkopf Professional and Gliss protection science, with its IMEA footprint as the proving ground for climate-specific variants. The bet is a modular protection architecture competitors running centralised formulation cannot localise quickly.",
        "id": "hair.maintain_optimize.exp.climate-adaptive-protection-shields",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Anti-frizz & smoothing sprays (advanced)",
        "type": "product",
        "trendCodes": [
          "T-01",
          "C-03"
        ],
        "driverNote": "T-01 AI humidity resistance + C-03 Premiumization",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) accelerates frizz-control into a distinct ritual tier with a premium entry price vs. commodity baseline. T-01 (AI humidity-resistance modeling) encodes climate-specific, hair-type-specific formulation into spray bottles; consumers see \"humidity-adaptive polymer matrix\" on shelf and perceive clinical pedigree absent from incumbents. Switching cost is behavioral: daily use in styling routine locks replenishment.\\n\\n**2. Strategic Evaluation.** Premiumisation is pulling frizz and smoothing control out of commodity and into a credentialed, daily-use ritual where repeat behaviour locks replenishment (C-03/T-01). The platform bet is humidity- and texture-adaptive polymer technology that performs visibly better than incumbents, delivered through got2b's styling-occasion equity for younger users and Taft for classic hold. Right-to-win sits in HCB's styling franchise plus AI-tuned formulation; own the efficacy story and the daily habit rather than chasing a fragmented set of climate-coded line extensions.",
        "id": "hair.maintain_optimize.exp.anti-frizz-and-smoothing-sprays-advanced",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Scalp stimulation & regeneration devices",
        "type": "tech",
        "trendCodes": [
          "T-05",
          "T-04"
        ],
        "driverNote": "T-05 Manufacturing + T-04 Microbiome science",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (manufacturing automation) enables at-home scalp-massage and microvibration devices to reach an accessible entry price; T-04 (microbiome-aware formulation) pairs hardware with microbiome-safe serums. Category entry (Dyson Airstrait crossover, beauty tech) is pre-purchase moment; brands that anchor the device → serum bundling capture recurring serum revenue, not just one-time hardware margin.\\n\\n**2. Strategic Evaluation.** Scalp-as-skincare is creating a device-plus-regimen space, but the durable margin is in the regenerative serum the hardware drives, not the appliance itself. HCB has scalp and trichology science via Schwarzkopf Professional but no consumer device franchise; the deliberate move is to partner or license a credible appliance OEM and own the microbiome-aware serum chemistry (T-04) that the device exists to deliver. Treat the hardware as a low-margin entry point and concentrate the bet on recurring, efficacy-led scalp formulation.",
        "id": "hair.maintain_optimize.exp.scalp-stimulation-and-regeneration-devices",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Biological support (ingestibles, supplements)",
        "type": "product",
        "trendCodes": [
          "C-10",
          "C-05"
        ],
        "driverNote": "C-10 Hair Loss Treatments + C-05 Silver Economy",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-10 (hair loss treatments) and C-05 (silver economy: aging population) unlock consumer appetite for ingestible hair-health protocols. Henkel's oral biotin, collagen, peptide supplements marry with topical treatments; the ingestible market (a multi-billion EU pool, 12% CAGR) is structurally margin-accretive because DTC subscription (K-06) capture rate is 4x higher than topical SKUs. Unilever (Nutrafol) already owns the beachhead; HCB entry is now-or-never acquisition or organic launch.\\n\\n**2. Strategic Evaluation.** An ageing population and the mainstreaming of thinning concerns are pulling hair health inward to ingestibles, a structurally adjacent pool where HCB has no asset today (C-10/C-05). The honest path is build, license or partner into a credible nutraceutical capability and bridge it with Schwarzkopf Professional's thinning and scalp credibility rather than improvising a supplement line. The platform bet is a connected topical-plus-ingestible regimen; the risk is entering a regulated, claims-sensitive category without the clinical substantiation incumbents already hold.",
        "id": "hair.maintain_optimize.exp.biological-support-ingestibles-supplements",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Condition tracking & smart reminders (app)",
        "type": "tech",
        "trendCodes": [
          "T-07"
        ],
        "driverNote": "T-07 AI Personalization + smart scheduling",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 (AI personalization) embeds hair-condition diagnostics into a branded mobile app: photo-to-scalp-health scoring, product-rotation reminders, replenishment automation. App becomes discovery layer where Henkel owns the diagnostic moment before competitor recommendations land. Switching friction rises because the app holds three years of consumer history; churn drops 20-30% vs. non-app cohorts.\\n\\n**2. Strategic Evaluation.** AI personalisation (T-07) makes hair and scalp diagnostics a plausible discovery and adherence layer that compounds as it accumulates a consumer's history. The strategic value is the diagnostic moment and the resulting regimen data, not an app as an end in itself; software is undifferentiated unless it routes into genuinely better Schwarzkopf-backed recommendations and reformulation insight. Build deliberately as a diagnostic and engagement capability that strengthens the product portfolio, accepting that standalone tools without clinical credibility are easily replicated by platform players.",
        "id": "hair.maintain_optimize.exp.condition-tracking-and-smart-reminders-app",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Subscription / programmatic care services",
        "type": "service",
        "trendCodes": [
          "K-06",
          "C-03"
        ],
        "driverNote": "K-06 Subscription Lock-in + C-03 Premiumization",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-06 (subscription lock-in) applied to Hair care bundles multiplies basket size 3-4x: monthly shampoo + weekly mask + bi-weekly treatment + leave-in serum + color-touch-up spray. Consumers commit to a four-step routine, increasing replenishment frequency and LTV. DTC subscription (Prose, Function of Beauty) captures 40% margins; Henkel retail-direct subscription achieves 55% margins, no middleman. Market signals show 8%+ CAGR in Hair subscription categories.\\n\\n**2. Strategic Evaluation.** Multi-step regimens turn occasional purchase into committed routines, and subscription is the mechanism that captures replenishment and lifts engagement (K-06/C-03). The defensible asset is the regimen logic and the Schwarzkopf and Gliss efficacy behind it, not the billing model; a generic owned-DTC subscription is not, by itself, a strategy. The bet is to make programmatic care the natural way consumers run a credentialed routine, using salon-channel credibility to anchor higher tiers, while keeping the relative-shift discipline that PRISM reports.",
        "id": "hair.maintain_optimize.exp.subscription-programmatic-care-services",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Weekly intensive treatment protocols",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization (multi-step routines)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) shifts mindset from \"treatment is occasional\" to \"treatment is weekly essential.\" Gliss Kur heritage credibility + Schwarzkopf Professional's bond-repair science converge on a four-step weekly ritual: pre-treatment + mask + serum + leave-in rinse. Each step is a premium add-on; the consumer pays a full weekly regimen instead of a single shampoo. Routine bundling increases portfolio spend per consumer 8-10x without price-per-unit increase.\\n\\n**2. Strategic Evaluation.** Premiumisation is normalising treatment from occasional rescue to a weekly essential, expanding share-of-routine for whoever credentials the ritual (C-03). HCB's right-to-win is the convergence of Gliss treatment heritage and Schwarzkopf Professional bond-repair science into a coherent multi-step weekly system that performs at near-prestige efficacy. The platform bet is owning the credible at-home protocol against independent bond-repair players, anchored in demonstrable repair science rather than bundle economics, so the routine becomes the habitual default this decade.",
        "id": "hair.maintain_optimize.exp.weekly-intensive-treatment-protocols",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Personalized rinse cycle optimization",
        "type": "tech",
        "trendCodes": [
          "T-07",
          "T-08"
        ],
        "driverNote": "T-07 AI + T-08 Connected home water systems",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-07 (AI personalization) + T-08 (connected appliances) allow formulators to recommend water-temperature and rinse-timing protocols based on hair texture, treatment history, and water hardness. App sends \"cold-rinse lock\" notifications; consumers perceive treatment efficacy increase. This is psychological lock-in: the app prescribes the use, not just the product. Enables Henkel to sell to consumers' shampoo + app bundle, creating sticky moat.\\n\\n**2. Strategic Evaluation.** Connected-bathroom and personalisation signals (T-07/T-08) point to data-guided usage protocols, but this is a thin, low-conviction lens and there is no Henkel shower or rinse platform to build on. The realistic role for HCB is chemistry that performs across real-world water and temperature conditions, participating in connected-bathroom IoT through formulation partnerships rather than asserting an owned device ecosystem. Treat usage-protocol guidance as a modest adherence feature attached to credentialed products, not a standalone software-licensing bet.",
        "id": "hair.maintain_optimize.exp.personalized-rinse-cycle-optimization",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Emerging-market hair care regimens (IMEA)",
        "type": "product",
        "trendCodes": [
          "X-06",
          "X-14"
        ],
        "driverNote": "X-06 IMEA growth 12.1% organic + X-14 AfCFTA unlocks African intra-trade scale",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** X-06 (IMEA growth: 12.1% organic vs. 0.9% group average) + X-14 (AfCFTA unlocks pan-African intra-trade at 2026-28 tariff harmonization) make India, Middle East, and Africa a structural growth frontier. Local consumer routines (coconut oil-based deep conditioning in India, shea butter protocols in West Africa) are category-native, not imported. Henkel IMEA portfolio strength (Schwarzkopf Pro distribution, acquired hair brands in Nigeria/Ghana) is undercapitalized vs. L'Oréal's Garnier India play.\\n\\n**2. Strategic Evaluation.** IMEA growth divergence and pan-African trade integration make these markets a structural frontier where local rituals are category-native, not imported (X-06/X-14). HCB's right-to-win is converting Schwarzkopf salon credibility into culturally grounded at-home regimens built around indigenous ingredients and routines, supported by an existing distribution footprint. The platform bet is a locally-authored regimen architecture that travels across the region as tariffs harmonise, defending against centralised global players who treat these markets as an afterthought rather than a design starting point.",
        "id": "hair.maintain_optimize.exp.emerging-market-hair-care-regimens-imea",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Tone & fade protection (anti-yellowing)",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI color stability integrated in core formulas",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI color stability) collapses what was category white space — after-color tone protection — into core formula. Consumers now expect color-lock benefits embedded in baseline shampoos rather than purchased separately. Single-purpose anti-yellowing products (purple shampoos, toning masks) lose shelf value as bundled benefits migrate into routine SKUs; the standalone margin pool contracts 15-20%.\\n\\n**2. Strategic Evaluation.** AI-stabilised colour chemistry (T-01) is absorbing standalone tone and anti-yellowing benefits into baseline shampoos, collapsing the single-purpose pool as the benefit becomes table-stakes. The harvest-and-redeploy move is to migrate colour-stability science into core Schwarzkopf and Syoss ranges and let purple shampoos and toning masks consolidate rather than be defended. Redirect the freed shelf and innovation capacity toward premium routine and scalp platforms where credentialed efficacy still commands a position; this is a managed migration, not a reversible decline.",
        "id": "hair.maintain_optimize.con.tone-and-fade-protection-anti-yellowing",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Fragrance refresh boosters (undifferentiated)",
        "type": "product",
        "trendCodes": [
          "C-09"
        ],
        "driverNote": "C-09 Fragrance Premiumization demands uniqueness",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-09 (fragrance premiumization) demands sensory differentiation that commodity hair boosters lack. Generic \"fresh coconut\" or \"tropical breeze\" fragrances do not command price premium; consumers seek neuro-functional or artisanal scents (T-19: neuro-scents with measured cognitive benefits, or niche fragrance house partnerships like Moroccanoil). Undifferentiated booster spend collapses as switching cost approaches zero.\\n\\n**2. Strategic Evaluation.** Sensory premiumisation rewards distinctive scent design and punishes interchangeable boosters, where switching cost is effectively nil (C-09). Generic fragrance refreshers should be consolidated and harvested, not expanded. Where HCB chooses to play, it should be through a smaller set of genuinely distinctive, branded sensory signatures tied to its hair franchises rather than commodity SKU proliferation. The discipline is fewer, more ownable scent expressions and reallocation of effort toward efficacy-led platforms; do not defend an undifferentiated booster shelf against trading-down.",
        "id": "hair.maintain_optimize.con.fragrance-refresh-boosters-undifferentiated",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      },
      {
        "name": "Deodorizing mists for hair (niche)",
        "type": "product",
        "trendCodes": [
          "C-06"
        ],
        "driverNote": "C-06 Cost-of-Living Squeeze pressures accessory buys",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-06 (cost-of-living squeeze) pressures accessory purchases that exist outside the core routine. Deodorizing mists are nice-to-have, not essential. Consumers in discretionary-spending decline default to dry shampoo (dual benefit: volume + odor control) rather than purchasing separate mist SKU. Category profit pool contracts 8-12% annually as functionality consolidates into adjacent SKUs.\\n\\n**2. Strategic Evaluation.** The cost-of-living squeeze compresses spend on accessory items that sit outside the core routine, and odour control is migrating into dual-benefit dry shampoo (C-06). Standalone deodorising mists should be harvested and their function folded into got2b and Taft dry-shampoo formulations, simplifying the range. This is portfolio hygiene, not a contested battleground: redeploy the freed complexity and shelf toward higher-conviction treatment and scalp platforms rather than sustaining a niche format whose benefit is already being absorbed elsewhere.",
        "id": "hair.maintain_optimize.con.deodorizing-mists-for-hair-niche",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "One-time treatments (low engagement)",
        "type": "product",
        "trendCodes": [
          "K-06"
        ],
        "driverNote": "K-06 Subscription models displace single-use",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-06 (subscription models) and multi-step routine architecture (Entries 7, 8) displace one-time treatments as purchase occasion. Consumers adopt weekly masking as habit; single-use sachets or one-off intensive treatments no longer compete for shelf or mental space. Engagement metrics show 3-5x higher repurchase on subscribed four-step protocols vs. occasional one-time deep conditioning.\\n\\n**2. Strategic Evaluation.** As weekly regimens and subscription habits take hold, one-off treatments lose their occasion and their repeat economics (K-06). The redeploy is to migrate single-use formats into the credentialed routine architecture, retaining only trial sizes as an on-ramp into habitual use. Concentrate Gliss and Schwarzkopf treatment investment where repeat behaviour compounds; manage the low-engagement tail down deliberately rather than defending it, recognising that occasional purchase no longer builds the kind of replenishment the routine platforms generate.",
        "id": "hair.maintain_optimize.con.one-time-treatments-low-engagement",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Online-listed care products (retail media tax)",
        "type": "product",
        "trendCodes": [
          "T-06"
        ],
        "driverNote": "T-06 Retail Media Networks ($184B, 39% FMCG ad spend)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-06 (retail media networks: a multi-hundred-billion pool by 2027, 39% FMCG ad spend) extracts margin on top of traditional trade spend. For Amazon, Carrefour, Tesco listings, brands pay 8-12% of net revenue to secure visibility. This is a new tax on e-commerce margin; products with low organic search appeal pay the highest. Margin pool contracts 200-300 bps as pay-to-play costs rise faster than price increases.\\n\\n**2. Strategic Evaluation.** Retail media networks levy a structural visibility tax on commodity e-commerce listings, eroding margin fastest on products with weak organic pull (T-06). The defensive response is to build genuine brand salience and search demand around Schwarzkopf and Gliss so listings are pulled rather than purely paid for, and to shift mix toward owned salience where the economics are better. This is a harvest-and-reposition play: reduce dependence on pay-to-play visibility for undifferentiated SKUs rather than out-bidding deeper-pocketed competitors on the platforms.",
        "id": "hair.maintain_optimize.con.online-listed-care-products-retail-media-tax",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "E-commerce replenishment margins (pay-to-play)",
        "type": "service",
        "trendCodes": [
          "K-02",
          "K-06"
        ],
        "driverNote": "K-02 E-Commerce Profit Pool Maturation + K-06 Subscription",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-02 (e-commerce profit pool maturation) + K-06 (subscription models) compress margins on transactional e-commerce buys as Amazon Subscribe & Save captures 40%+ of replenishment volume. Once Amazon controls the replenishment decision, brand negotiation power collapses; Amazon takes 35%+ of gross margin (fulfillment + warehouse fees + marketplace tax). Only subscription brands at Henkel DTC preserve margin.\\n\\n**2. Strategic Evaluation.** E-commerce maturation and marketplace replenishment programmes compress margin and transfer the repurchase decision away from the brand (K-02/K-06). The structural defence is to make the brand and its regimen the reason for replenishment, so demand survives the channel, and to favour owned and direct relationships where margin and consumer data are retained. Treat this as harvest-and-redeploy: protect the credentialed routine franchises that consumers actively choose, and reduce reliance on transactional marketplace volume whose terms only worsen over the decade.",
        "id": "hair.maintain_optimize.con.e-commerce-replenishment-margins-pay-to-play",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      }
    ]
  },
  {
    "id": "refresh_between",
    "label": "Refresh / In-Between",
    "benefiting": [
      {
        "name": "Dry shampoo (volume & convenience)",
        "type": "product",
        "trendCodes": [
          "C-15"
        ],
        "driverNote": "C-15 Hair Styling Between Washes (7%+ CAGR, Batiste $1B+)",
        "intensity": 3,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-15 (between-wash styling, 7%+ CAGR) with Batiste at a multi-billion global share positions dry shampoo as the fastest-growing Hair sub-segment. Usage occasions expand beyond \"emergency refresh\" to routine styling step (second-day volume boost, texture base for styling). Consumers purchase 1.5-2x more per year; basket value per user increases meaningfully.\\n\\n**2. Strategic Evaluation.** Between-wash styling is a structurally growing occasion, with dry shampoo shifting from emergency refresh to a routine styling and texturising step (C-15). HCB's right-to-win is got2b's social-native styling equity plus Taft's hold credibility, extended through format innovation that reduces waste and improves portability and the styling result. The platform bet is owning the European challenger position with genuinely better delivery and texture performance against the category leader, treating dry shampoo as a styling franchise rather than a single utility SKU.",
        "id": "hair.refresh_between.exp.dry-shampoo-volume-and-convenience",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Root retouch sprays (instant color refresh)",
        "type": "product",
        "trendCodes": [
          "T-03",
          "C-06"
        ],
        "driverNote": "T-03 Concentrated Formats + C-06 Cost saving",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (concentrated spray formats) plus C-06 (cost-conscious consumers stretching salon visits) creates the 'stretch-color' occasion: at-home root retouch between salon appointments at a fraction of the salon cost. L'Oréal Magic Retouch is the affordable incumbent leading a multi-billion root-retouch pool. Format innovation (oil-free, fine-mist, precision applicator) drives shade proliferation and SKU expansion.\\n\\n**2. Strategic Evaluation.** Concentrated formats and salon-stretching behaviour create a durable stretch-colour occasion between appointments (T-03/C-06). The defensible move for HCB is precision delivery and credible shade-matching grounded in Schwarzkopf Professional colour science, leapfrogging incumbents on applicator and finish quality rather than competing on coverage alone. The platform bet is colour-refresh as an owned innovation space anchored in professional colour credibility; AI shade guidance is a supporting capability, not the strategy. This tile is the precision-spray, salon-stretch play.",
        "id": "hair.refresh_between.exp.root-retouch-sprays-instant-color-refresh",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Color correction & neutralization products",
        "type": "product",
        "trendCodes": [
          "T-01"
        ],
        "driverNote": "T-01 AI color correction formulas + on-demand",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-01 (AI color correction) and on-demand customisation enable shade-specific correctors (anti-brassiness, ash-boost, warm-tone neutralisers) personalised to a consumer's current color level and undertone. Olaplex and indie brands pioneered the space at a premium price; mainstream mass has no equivalent. Portfolio depth (4-6 SKUs per market) lifts category share without cannibalising the core color box.\\n\\n**2. Strategic Evaluation.** On-demand correction (anti-brassiness, ash and warm-tone neutralisers) is a still-open mass space pioneered at prestige by independents (T-01). HCB's right-to-win is Schwarzkopf Professional colour-correction science translated into a structured, undertone-specific mass range, earning colorist endorsement before scaling. Distinct from root retouch, this tile is the tone-correction platform: portfolio depth that lifts colour share without cannibalising the core colour box, with personalised shade guidance as an enabler rather than the central bet.",
        "id": "hair.refresh_between.exp.color-correction-and-neutralization-products",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Leave-in & overnight treatments (intensive)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization (multi-step routines)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) + C-05 (silver economy aging population: 50+ spending) drive demand for intensive overnight and extended-wear treatments. Consumers wear treatment 8-12 hours (overnight + next day), increasing active-ingredient efficacy perceived vs. rinse-off format. Olaplex No. 8 and K18 Leave-In Mask capture a sizeable premium tier; mass premium tier (Gliss, Syoss) is underpenetrated.\\n\\n**2. Strategic Evaluation.** Premiumisation and an ageing consumer base lift demand for extended-wear, leave-in and overnight intensives where longer contact time reads as higher efficacy (C-03). The mass-premium tier is under-penetrated relative to the prestige bond-repair players. HCB's right-to-win is Gliss treatment lineage plus Schwarzkopf Professional bond-repair science delivering credible claim parity in accessible formats. The platform bet is owning the overnight and extended-wear repair occasion with demonstrable efficacy, not a price-positioned imitation; distinct from the weekly in-bathroom protocol, this is the leave-on franchise.",
        "id": "hair.refresh_between.exp.leave-in-and-overnight-treatments-intensive",
        "poolImpact": {
          "grade": "High",
          "direction": "tailwind"
        }
      },
      {
        "name": "Scalp care & balance mists",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care Category (new category growth)",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care emerges as standalone category) fragments from \"anti-dandruff\" into distinct therapy categories: balance (sebum regulation), stimulation (circulation), detoxification (pollution removal), and calm (inflammation). Mist format (T-03: concentrated spray) enables daily use without washing; consumer adoption of multi-step scalp ritual mirrors multi-step body skincare (toner + essence + serum stack). Scalp care sub-segment is fastest-growing hair category at 18% CAGR.\\n\\n**2. Strategic Evaluation.** Scalp care is fragmenting from anti-dandruff into a skincare-style discipline of balance, stimulation, detox and calm, and mist formats enable daily, no-rinse use (C-07/T-03). HCB's right-to-win is Schwarzkopf Professional trichology framed in deliberate skincare language, positioning the scalp as the ritual surface. The platform bet is owning scalp-as-skincare as a daily mist regimen against incumbents anchored in single-benefit anti-dandruff; this lightweight daily-mist tile sits beneath the deeper weekly protocol and should be differentiated as the everyday entry layer.",
        "id": "hair.refresh_between.exp.scalp-care-and-balance-mists",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Portable styling tools (cordless)",
        "type": "tech",
        "trendCodes": [
          "T-05"
        ],
        "driverNote": "T-05 Manufacturing Automation enables portability",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-05 (manufacturing automation) enables production of cordless heated styling tools (mini hair straighteners, hot combs, curling wands) at accessible mass retail price points. Consumer travel occasions and on-the-go styling expand from salon-only (pricier professional tools) to DIY luxury. Bundled with leave-in treatments, this materially expands the styling-occasion addressable market in Europe.\\n\\n**2. Strategic Evaluation.** Manufacturing advances are democratising cordless heated styling tools, expanding on-the-go styling beyond professional price points (T-05). HCB has styling formulation equity but no device franchise, so the deliberate route is licensing or partnering with a credible appliance maker and pairing the tool with got2b, Taft and Gliss styling and care products. Treat the hardware as a complement that drives the consumable, not a margin engine in itself; the bet is extending the styling franchise into the tool-enabled occasion through partnership rather than owned manufacturing.",
        "id": "hair.refresh_between.exp.portable-styling-tools-cordless",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Quick salon express refresh services",
        "type": "service",
        "trendCodes": [
          "K-04",
          "K-07"
        ],
        "driverNote": "K-04 Social Commerce + K-07 Professional crossover",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** K-04 (social commerce) + K-07 (professional salon crossover) enable sub-30-minute in-salon refresh services (root retouch, gloss, treatment) positioned as \"express\" tier. Batiste and indie brands own dry-shampoo occasion; Schwarzkopf Professional owns salon refresh credibility. Hybrid model (salon + product bundle retail) increases salon foot traffic and drives take-home replenishment.\\n\\n**2. Strategic Evaluation.** Salon-to-consumer crossover and social discovery are opening a fast in-salon refresh occasion that pairs naturally with take-home replenishment (K-04/K-07). HCB's distinctive asset is the Schwarzkopf Professional salon relationship, particularly with independents that owned-salon competitors leave unengaged. The platform bet is using professional credibility to anchor an express-refresh format that drives both salon engagement and credentialed at-home repurchase, knitting the professional and consumer journeys together rather than treating the service as a standalone revenue line.",
        "id": "hair.refresh_between.exp.quick-salon-express-refresh-services",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "At-home color touch-up sprays",
        "type": "product",
        "trendCodes": [
          "T-03",
          "T-07"
        ],
        "driverNote": "T-03 Concentrated Formats + T-07 AI personalized shades",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (concentrated spray formats) and T-07 (AI-personalised shades) converge on a 'makeup for hair' format: spray-on color that washes out in one shampoo, repurchased weekly. L'Oréal Magic Retouch dominates today, but the format is nascent globally — projected to reach a sizeable pool by 2030 as awareness expands beyond gray coverage into between-wash style.\\n\\n**2. Strategic Evaluation.** Wash-out spray colour is a nascent, globally under-developed format expanding from grey coverage into between-wash styling expression (T-03/T-07). HCB's right-to-win is Schwarzkopf colour credibility applied to a makeup-for-hair occasion, positioned as a routine style step rather than emergency coverage. Distinct from precision root retouch, this tile is the temporary, frequently-repurchased style-colour play; the platform bet is shaping the occasion early through credible shade design and styling-led positioning, with social discovery as the route to awareness rather than the core asset.",
        "id": "hair.refresh_between.exp.at-home-color-touch-up-sprays",
        "poolImpact": {
          "grade": "Low",
          "direction": "tailwind"
        }
      },
      {
        "name": "Scalp wellness weekly protocols",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care Category emergence",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care category emergence) + C-05 (silver economy: 50+ anti-thinning concern) create demand for multi-step weekly scalp protocols that parallel body skincare regimens. Exfoliate + stimulate + nourish + restore = a premium weekly spend (a meaningful monthly outlay). Schwarzkopf Professional's trichology credibility enables premium positioning that mass incumbents (P&G Head & Shoulders, L'Oréal Serioxyl) cannot justify.\\n\\n**2. Strategic Evaluation.** Scalp-as-skincare combined with ageing-driven thinning concern supports a deeper weekly, multi-step scalp regimen paralleling structured facial routines (C-07/C-05). HCB's right-to-win is Schwarzkopf Professional trichology framing a credible exfoliate-stimulate-nourish-restore protocol that single-benefit incumbents cannot justify. Differentiated from the daily balance mist, this is the committed weekly scalp ritual aimed especially at the mature consumer; the platform bet is owning the high-engagement scalp regimen with demonstrable trichological substantiation rather than a fragmented set of unconnected scalp SKUs.",
        "id": "hair.refresh_between.exp.scalp-wellness-weekly-protocols",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      },
      {
        "name": "Male dry styling & texture sprays",
        "type": "product",
        "trendCodes": [
          "C-08",
          "C-15"
        ],
        "driverNote": "C-08 Male Grooming + C-15 Hair Styling Between Washes",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-08 (male grooming: a multi-billion European market, 7.65% CAGR) + C-15 (between-wash styling, 7%+ CAGR) create structural expansion in male texture and styling products. Male consumers adopt multi-step grooming less than female cohort; texture sprays are low-friction entry (spray, not apply, no styling tool required). got2b and Taft both have male positioning; portfolio investment is capital-efficient vs. new-brand launch.\\n\\n**2. Strategic Evaluation.** Male grooming is a structurally expanding pool, and low-friction texture and dry-styling sprays are an effective entry for men who resist multi-step routines (C-08/C-15). HCB's right-to-win is got2b's youth styling equity alongside Taft's barbershop heritage, a capital-efficient franchise extension rather than a new brand. The platform bet is owning male styling as a structural growth lane through credible, occasion-led texture products and barbershop-channel credibility; treat male grooming as a durable demographic shift to build into, not a tactical line addition.",
        "id": "hair.refresh_between.exp.male-dry-styling-and-texture-sprays",
        "poolImpact": {
          "grade": "Med",
          "direction": "tailwind"
        }
      }
    ],
    "negativelyImpacted": [
      {
        "name": "Glosses (limited repeat purchase)",
        "type": "product",
        "trendCodes": [
          "C-03"
        ],
        "driverNote": "C-03 Premiumization shifts to permanent investment",
        "intensity": 2,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-03 (premiumization) shifts consumer investment from temporary gloss to permanent or semi-permanent color: glosses are now perceived as temporary expedient, not a value proposition. Low repeat-purchase frequency (1-2x annually vs. 6-12x for shampoo) makes gloss SKUs economically challenging to support with shelf space. Portfolio rationalization favors high-velocity items.\\n\\n**2. Strategic Evaluation.** Premiumisation is steering consumers from temporary gloss toward semi-permanent and permanent colour with better repeat economics, leaving low-frequency gloss SKUs hard to justify (C-03). The redeploy is to channel formulation effort into conditioning semi-permanent colour under Schwarzkopf with higher repurchase, while gloss recedes into promotional and gifting roles. This is category maturation and harvest, not a contested fight: reallocate the freed shelf and development capacity toward the treatment and colour-refresh platforms that carry durable repeat behaviour this decade.",
        "id": "hair.refresh_between.con.glosses-limited-repeat-purchase",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "Garment steaming for hair (novelty)",
        "type": "tech",
        "trendCodes": [
          "C-06"
        ],
        "driverNote": "C-06 Cost squeeze + low engagement trend",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-06 (cost-of-living squeeze) pressures novelty add-ons with low engagement and high complexity. Hair steaming (DIY garment steamer for hair conditioning) is niche behavior, adopted by <2% of consumers; no brand has successfully monetized format. Perceived as gimmick; repurchase is non-existent after trial disappointment.\\n\\n**2. Strategic Evaluation.** Cost pressure penalises high-complexity novelties with negligible adoption, and DIY hair steaming has never demonstrated repeatable consumer pull (C-06). HCB holds no equity here and there is no right-to-win to defend; the disciplined move is to decline the bet and redirect development toward proven sprays, masks and serums tied to Schwarzkopf and Gliss. This is straightforward portfolio rationalisation, not a managed decline of an existing position: concentrate capability on formats with demonstrated velocity rather than chasing a gimmick occasion.",
        "id": "hair.refresh_between.con.garment-steaming-for-hair-novelty",
        "poolImpact": {
          "grade": "High",
          "direction": "headwind"
        }
      },
      {
        "name": "On-the-go freshener sprays (generic)",
        "type": "product",
        "trendCodes": [
          "C-07"
        ],
        "driverNote": "C-07 Scalp Care replaces generic \"freshener\" category",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** C-07 (scalp care category) reframes generic \"freshener\" sprays as specifically purpose-driven scalp-care tools (balance, stimulation, calm), not undifferentiated \"refresh.\" Consumers perceive generic fresheners as low-value fragrance spray, not therapeutic product. Margin collapse as category evolves from fragrance-led to efficacy-led positioning.\\n\\n**2. Strategic Evaluation.** The emergence of scalp care reframes generic fresheners as low-value fragrance sprays, eroding their position as consumers shift toward efficacy-led benefits (C-07). The redeploy is to consolidate undifferentiated fresheners into purpose-driven Schwarzkopf scalp mists with a credible wellness benefit, retiring the fragrance-only narrative. This is a migration from fragrance-led to efficacy-led positioning, harvesting a commoditising format into the scalp-as-skincare platform rather than defending generic refresh claims that no longer command consumer value.",
        "id": "hair.refresh_between.con.on-the-go-freshener-sprays-generic",
        "poolImpact": {
          "grade": "Med",
          "direction": "headwind"
        }
      },
      {
        "name": "Temporary touch-up chalks",
        "type": "product",
        "trendCodes": [
          "T-03"
        ],
        "driverNote": "T-03 Concentrated spray formats displace chalks",
        "intensity": 1,
        "provenance": {
          "author": "strategist",
          "date": "2026-04",
          "grade": "estimate"
        },
        "analysis": "**1. Summary.** T-03 (concentrated spray formats) displace chalks as the between-wash color-refresh vehicle: sprays are faster (no fingers-to-chalk application), no residue on fingers or clothing, and deliver more uniform coverage. Chalk market shrinks as spray adoption accelerates. Younger cohorts (Gen Z, K-04 social-native) adopt spray-first behavior; chalk is legacy incumbent with declining frequency.\\n\\n**2. Strategic Evaluation.** Concentrated spray formats are displacing chalks as the between-wash colour-refresh vehicle, with younger cohorts adopting spray-first behaviour and chalk frequency in structural decline (T-03). The redeploy is to migrate users toward HCB's spray-based colour-refresh range and concentrate development on finer-mist, faster-drying delivery. This is a managed exit of a legacy format, not a battleground: harvest the declining chalk position and reallocate manufacturing and innovation capacity to the higher-velocity spray colour-refresh platform that owns the occasion going forward.",
        "id": "hair.refresh_between.con.temporary-touch-up-chalks",
        "poolImpact": {
          "grade": "Low",
          "direction": "headwind"
        }
      }
    ]
  }
];

export const LHC_CTX: Record<string, StageContext> = {
  "Sorting": {
    "henkelBrands": "Persil (ecosystem anchor for AI garment care advisory), Vernel (fabric protection guidance)",
    "competitors": "P&G has no standalone AI sorting play. Samsung SmartThings integrates with Tide pods for auto-cycle selection. LG ThinQ partners with Procter brands on connected wash.",
    "opportunity": "A Persil-branded AI garment care advisor that scans fabrics and recommends the optimal Persil/Vernel product turns sorting from a chore into a digital brand lock-in moment — whoever owns the diagnostic captures the downstream purchase decision."
  },
  "Pre-Treating": {
    "henkelBrands": "Sil (dedicated stain removal specialist — Henkel's under-leveraged gem in this stage), Persil (stain removal pre-treat sprays and power formulas)",
    "competitors": "Vanish (Reckitt — retained as a core powerbrand in the 2025 Essential Home divestiture and still the global #1 fabric-treatment franchise, so expect continued investment, not PE decay). OxiClean (Church & Dwight, US-focused). P&G has no standalone stain brand. Retailer own-brands (Aldi Tandil, dm Denkmit) now field premium-tier stain removers at 30-50% price discounts.",
    "opportunity": "Sil is a natural innovation platform for bio-enzymatic stain science. The contestable opening is not Vanish (which Reckitt kept and defends) but the Advent-owned Essential Home adjacencies — Calgon, Woolite, Cillit Bang (X-01) — where PE ownership typically cuts marketing and R&D within 12-18 months: target Woolite's fabric-care shelf with Perwoll and press retailer negotiations in the overlap categories. Position Sil + Persil as an integrated pre-treat-to-wash system that builds basket size and out-credentials private label one-product solutions."
  },
  "Loading": {
    "henkelBrands": "Persil Discs (4-in-1 capsule with integrated dosing technology), Persil (dosing innovation across pods, gel, and powder formats)",
    "competitors": "P&G Ariel Pods (market leader in unit-dose format globally). Unilever OMO dual-chamber capsules. Samsung and LG auto-dose systems increasingly favor branded cartridge partnerships.",
    "opportunity": "Henkel's appliance OEM partnerships (Miele, Bosch, Samsung) for auto-dosing cartridges create a Nespresso-like hardware lock-in. Persil-branded auto-dose refills that slot into connected machines build recurring revenue and structural switching costs that no competitor currently matches in Europe."
  },
  "Add Products": {
    "henkelBrands": "Persil (Discs, Power Caps, gel, powder — Henkel's largest LHC franchise and core profit pool), Vernel (fabric softener, scent beads), Weißer Riese (value tier Germany/Austria), Spee (economy Germany), all and Purex (US mainstream and value)",
    "competitors": "P&G Ariel/Tide (global #1 laundry by revenue). Unilever OMO and Persil UK. Church & Dwight (OxiClean, Arm & Hammer). Private label at 42% EU6 value share — the highest level ever recorded by Circana.",
    "opportunity": "This is the core profit pool stage for Henkel LHC. Defend Persil premium via demonstrable superiority in concentrated formats and bio-chemistry. Use Weißer Riese and Spee as strategic value-tier shields preventing consumer trade-down to private label. Persil Discs 4-in-1 is the format innovation weapon — it combines detergent, softener, stain removal, and freshness in one capsule, rendering separate product purchases obsolete."
  },
  "Select Wash Settings": {
    "henkelBrands": "Persil (smart home ecosystem partner with wash-program APIs), Henkel connected laundry platform (auto-dosing integration with major washer OEMs)",
    "competitors": "P&G Tide/Ariel has partnered with Samsung SmartThings and LG ThinQ for connected wash recommendations. Unilever is exploring connected refill models for OMO in select markets.",
    "opportunity": "When the washing machine itself recommends Persil at the cycle-selection moment, that is invisible-to-consumer, structural-for-manufacturer brand lock-in. Henkel's existing OEM relationships are the foundation for owning this moment at scale before competitors lock in exclusive partnerships."
  },
  "Washing Cycle": {
    "henkelBrands": "Persil (cold-wash optimized formulas, Persil Green Power eco-range), Vernel (in-wash softening and scent). Auto-dosing cartridge refill model for connected machines.",
    "competitors": "P&G Ariel claims cold-water efficacy leadership (Turn To 30 campaign, heavy media spend). Unilever OMO targets cold-wash with enzyme technology in Europe. Both investing aggressively.",
    "opportunity": "Cold-wash optimization is Persil's next performance battleground. Persil Green Power (bio-formulation effective at 20°C) directly addresses E-07 energy cost pressure — European consumers pay 2-3x US energy prices. Winning the cold-wash efficacy claim captures the fastest-growing detergent sub-segment while aligning with sustainability positioning."
  },
  "Unloading": {
    "henkelBrands": "Vernel (freshness, anti-static, and scent care — core franchise), Persil (clean laundry freshness halo that extends beyond the wash cycle)",
    "competitors": "P&G Lenor/Downy Unstoppables (market creator and leader in scented laundry, established the scent-bead sub-category). Unilever Comfort (traditional softener positioning).",
    "opportunity": "Vernel needs a differentiated answer to Lenor Unstoppables that emphasizes bio-based, conscious freshness over synthetic fragrance overload — aligning with C-04 Conscious Consumption while competing in the fastest-growing fabric care sub-category. Vernel's European heritage and natural ingredient positioning is a credible platform for this."
  },
  "Drying": {
    "henkelBrands": "Vernel (dryer scent products and tumble dryer sheet potential), US: Snuggle (established dryer sheet expertise that could transfer to Europe). Persil (garment care ecosystem).",
    "competitors": "P&G Bounce (dominant US dryer sheets brand). Unilever Comfort tumble dryer sheets (limited European presence). The European dryer sheet market is still nascent compared to the US — an early-mover advantage is available.",
    "opportunity": "Heat-pump dryers are replacing vented dryers across Europe, creating an entirely new product moment. Vernel-branded scent pods or dryer sheets optimized for heat-pump temperatures represent a white-space entry with minimal competitive intensity in Europe. Henkel can transfer Snuggle's US dryer expertise to European Vernel."
  },
  "Ironing": {
    "henkelBrands": "Vernel (anti-wrinkle spray extension leveraging fabric care credibility), Persil (garment lifecycle system positioning)",
    "competitors": "No major FMCG player dominates post-wash ironing chemical products. Category is fragmented across appliance brands (Philips, Rowenta steamers) and niche spray brands. This fragmentation signals opportunity for a trusted FMCG brand.",
    "opportunity": "White space for Henkel. A spray-and-wear anti-wrinkle product under Vernel (leveraging its fabric care credibility) or Persil (leveraging its laundry authority) could create a new branded sub-category in a currently unbranded space. Low competitive intensity makes this an ideal low-risk test-and-learn market entry."
  },
  "Folding & Storing": {
    "henkelBrands": "Vernel (closet freshness and garment protection potential — natural brand extension), bio-based fabric care innovation pipeline",
    "competitors": "SC Johnson (Raid moth protection, regional). Reckitt legacy products. The category is highly fragmented with no FMCG leader — no one has built a branded position in closet garment care.",
    "opportunity": "Extending Vernel into closet care (scent sachets, bio-based moth protection, cedar alternatives) leverages existing fabric care brand equity at minimal incremental cost. Low-investment category extension with premium pricing potential and zero cannibalization risk to existing Vernel products."
  },
  "Taking Out of Closet": {
    "henkelBrands": "Vernel (fabric refresh is a natural extension of its freshness and scent positioning — from in-wash to all-day care), Persil (clean confidence halo)",
    "competitors": "P&G Febreze ($1B+ global revenue, dominant in fabric and room refresh — created and owns this category). No strong European-origin challenger brand exists in fabric refresh.",
    "opportunity": "Henkel has no Febreze competitor — this is a strategic gap in a €500M+ and growing European sub-category. A Vernel-branded fabric refresh spray extends the freshness positioning from in-wash softener to between-wash garment care, creating a new consumer moment for the brand without cannibalizing the core softener business."
  },
  "Wearing": {
    "henkelBrands": "Vernel (garment protection and textile life extension), Persil (stain guard pre-treatment, clean confidence)",
    "competitors": "Scotchgard (3M — retreating from consumer market). P&G Febreze on-the-go. DWR spray brands are mostly outdoor/niche with no mass-market FMCG positioning.",
    "opportunity": "Garment protection and life extension directly aligns with E-08 Textile Longevity regulation (EU Circular Textiles Strategy). Position Persil + Vernel as a complete garment lifecycle system — wash, protect, refresh, extend — increasing consumer touchpoints from one (the wash) to four, multiplying revenue per consumer by 3-4x."
  },
  "Between Washes": {
    "henkelBrands": "Vernel (strongest brand platform for between-wash fabric care — freshness equity transfers directly), Persil (halo from wash performance carries into between-wash confidence)",
    "competitors": "P&G Febreze ($1B+ global, category creator and dominant player — effectively owns between-wash fabric care). Reckitt Air Wick (now Advent-owned post-divestiture, declining brand investment). No strong European fabric refresh challenger.",
    "opportunity": "Between-wash fabric care is PRISM's highest-scoring white space (C-14 at 0.82 score, 8-10% CAGR). Henkel has zero current position in a segment that P&G built into a billion-dollar franchise. A Vernel-branded fabric refresh spray range is the single highest-ROI new product opportunity in the entire LHC portfolio — with Reckitt's exit under PE ownership further weakening the only potential European competitor."
  }
};

export const HAIR_CTX: Record<string, StageContext> = {
  "Inspire": {
    "henkelBrands": "Schwarzkopf (master brand with 90%+ aided recall in Europe), got2b (youth and social-first positioning), Palette and Live (color-specific inspiration), Syoss (professional credibility at accessible price)",
    "competitors": "L'Oréal Modiface (AR try-on market leader — established first-mover advantage in digital shade matching). P&G Pantene (influencer partnerships, heavy social spend). Unilever Dove (body-positivity content dominance). Indie brands like Olaplex and K18 dominate organic social.",
    "opportunity": "Schwarzkopf Professional's salon credibility can power an AR shade-finder and hair advisor that rivals Modiface with professional-grade color precision that L'Oréal's mass-market tool cannot match. got2b should own TikTok-native trend content — its youth positioning is perfectly aligned with the social commerce moment where product discovery is shifting from search to creator recommendation."
  },
  "Diagnose": {
    "henkelBrands": "Schwarzkopf Professional (salon-grade diagnostic credibility — trichological heritage), Syoss (accessible professional analysis), Schwarzkopf consumer (brand trust for diagnostic tools)",
    "competitors": "L'Oréal Technology Incubator (AI skin and hair diagnostics, multi-year R&D investment). P&G Head & Shoulders (scalp health messaging). DTC brands like Prose and Function of Beauty (quiz-based personalization, strong data moats).",
    "opportunity": "Schwarzkopf Professional's trichological IP is an undermonetized asset. An AI hair diagnostic tool (camera-based scalp and strand analysis) branded to Schwarzkopf Professional bridges the salon-to-retail gap and captures the diagnostic moment before purchase — in beauty, whoever diagnoses the problem prescribes the solution."
  },
  "Prepare": {
    "henkelBrands": "Gliss (bond builder and treatment specialist — Gliss Kur heritage of keratin-based repair), Schwarzkopf (scalp protection pre-treatment), Syoss (pre-treatment at accessible professional price point)",
    "competitors": "Olaplex No. 0 (bond-builder pioneer, created the category). K18 (peptide-based pre-treatment, viral growth). L'Oréal Série Expert (salon pre-treatment, professional channel). Premium pre-treatment is the fastest-growing Hair sub-segment by growth rate.",
    "opportunity": "Gliss has natural credibility in bond repair — it pioneered the liquid keratin positioning in European mass retail. Upgrading Gliss into a clinical-grade bond builder range (Olaplex-equivalent efficacy at mass-market accessibility) captures the premiumization wave without requiring indie-brand pricing. The Gliss brand carries both scientific credibility and mass-market distribution."
  },
  "Remedy": {
    "henkelBrands": "Schwarzkopf (scalp care authority via Professional channel heritage), Syoss (treatment-focused affordable care range), Schauma (anti-dandruff entry tier for volume play and light-buyer recruitment)",
    "competitors": "P&G Head & Shoulders (anti-dandruff global #1 by far). L'Oréal Serioxyl and Kérastase (hair loss premium tier). Unilever Clear (anti-dandruff leader in Asia). DTC disruption: Nioxin (established clinical), Vegamour, Nutrafol (new entrants with strong social presence).",
    "opportunity": "Hair loss entering the consumer mainstream (C-10) is a structural category shift. Henkel can bridge salon-to-retail via Schwarzkopf Professional's trichological credibility — something no competitor except L'Oréal can claim. A Schwarzkopf-branded scalp care and anti-thinning range (serum + shampoo + supplement protocol) fills the white space between clinical niche (Nioxin, $50+ price point) and commodity (Head & Shoulders, $6 price point)."
  },
  "Transform": {
    "henkelBrands": "Schwarzkopf (Palette, Color Expert, Keratin Color, Perfect Mousse — Europe's #1 at-home color brand by value share), Live (fashion and semi-permanent color for creative expression), Syoss Color (affordable professional color), got2b (color sprays and creative temporary color)",
    "competitors": "L'Oréal Excellence/Préférence (premium color, heavy ad investment) and Garnier Nutrisse (mainstream). Clairol (US market). Wella (salon dominance). Private label gaining in value color tier. DTC: Madison Reed, eSalon (subscription color, personalization).",
    "opportunity": "Color IS Schwarzkopf — this is Henkel's #1 Hair profit pool and must be defended as an existential priority. Innovation in bond-protecting color (evolving Keratin Color technology), professional-grade at-home color systems leveraging K-07 salon crossover ($23.4B market, 63% B2C), and format innovation (precision applicators, reduced damage formulas) protects the premium core against L'Oréal from above and private label from below."
  },
  "Lock & Finish": {
    "henkelBrands": "got2b (styling and finishing — gels, sprays, waxes, pastes, glue), Taft (Europe's leading hairspray brand, strong market share in Germany/CEE), Schwarzkopf (color-lock finishing, Osis+ from Professional channel)",
    "competitors": "L'Oréal Elnett (premium hairspray icon, strong emotional brand equity). Unilever TRESemmé (salon-accessible styling). Indie and prestige brands (Moroccanoil, Oribe, R+Co capturing premiumization). Styling as a category is globally under-invested relative to its margin potential.",
    "opportunity": "got2b + Taft combined gives Henkel the strongest styling portfolio in Europe. The premiumization of finishing products — from commodity hold to color-lock, bond-seal, and fragrance-finishing — is an upgrade path that increases revenue per unit without requiring new shelf facings. Osis+ salon expertise can transfer innovation credibility to the got2b and Taft consumer lines."
  },
  "Maintain & Optimize": {
    "henkelBrands": "Gliss (treatment and repair specialist — weekly masks, serums, oils), Schwarzkopf (care systems and routines), Syoss (professional-grade maintenance at accessible price), Schauma (everyday value care for light-buyer recruitment)",
    "competitors": "P&G Pantene (daily care #1 globally, massive media investment). Unilever Dove and TRESemmé (mainstream care). L'Oréal Elvive/Elsève (treatment positioning). Indie disruption: Olaplex No. 3-7 maintenance range, K18 mask (viral social proof).",
    "opportunity": "Gliss can own the \"treatment protocol\" space — weekly intensive repair systems at mass-market price points. Multi-step care routines (shampoo → mask → serum → leave-in protectant) increase basket size 3-4x versus a single shampoo purchase. This is exactly the premiumization vector: more products per consumer, not just higher price per product."
  },
  "Refresh / In-Between": {
    "henkelBrands": "got2b (dry shampoo and texture sprays for youth segment), Taft (quick restyle and refresh for classic consumers), Schauma (value dry shampoo entry), Schwarzkopf (root retouch sprays for color maintenance between salon visits)",
    "competitors": "Batiste (dominant dry shampoo at 40%+ global share, strong brand moat). L'Oréal Magic Retouch (root retouch market leader). P&G Pantene dry shampoo. Unilever Dove dry shampoo (value tier).",
    "opportunity": "Between-wash styling (C-15) is the fastest-growing Hair sub-segment at 7%+ CAGR with Batiste alone at $1B+. got2b is perfectly positioned for the youth styling-convenience occasion. Taft for the classic quick-restyle moment. Schwarzkopf root retouch competes directly with L'Oréal Magic Retouch. Portfolio breadth across price tiers and consumer segments is a structural advantage no single competitor can match."
  }
};
