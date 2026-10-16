/**
 * Consumer Journey content: the shape of the tiles of each journey stage and
 * of the stage contexts.
 *
 * The content itself is not in the bundle. It lives in
 * data/content/consumer_journey.json (the hand-authored source), which the
 * API serves to a signed-in user with a role (GET /api/v1/journey): the tiles
 * from the newest version an admin saved, else the base content, and the
 * stage contexts, which are not editable. This module holds the types only;
 * the API's own copy of the shape is prism/journey.py, and the two are tested
 * against each other.
 *
 * Every tile is authored by the strategist and carries its provenance: the
 * month of its last revision and an evidence grade: 'verified' (sourced hard
 * data), 'estimate' (a Fermi or consulting estimate) or 'hypothesis' (needs
 * validation).
 *
 * A tile cites the modelled drivers behind it by display code in driverCodes
 * (data/driverCodeMap.ts); driverNote is the short rationale shown with them.
 * A tile may cite none, and its read is then the strategist's own. The
 * Strategist Read (analysis) is authored text: nothing here feeds the
 * simulation.
 */

/** 'lhc' is the Laundry journey (the Home Care journey is not built yet), 'hair' the Hair journey. */
export type JourneyKey = 'lhc' | 'hair';
export type TileType = 'product' | 'tech' | 'service';
export type ProvenanceGrade = 'verified' | 'estimate' | 'hypothesis';

export interface TileProvenance {
  /** Month of the last revision, YYYY-MM. */
  date: string;
  grade: ProvenanceGrade;
}

export type PoolImpactGrade = 'Low' | 'Med' | 'High';

/** How strongly a tile moves the profit pool; its side gives the direction. */
export interface PoolImpactInfo {
  /** An authored grade, judged from the modelled drivers the tile cites and
   *  the tile's intensity; a tile without a modelled driver is Low. */
  grade: PoolImpactGrade;
}

export interface JourneyTile {
  id: string;
  name: string;
  type: TileType;
  /** Display codes of the modelled drivers behind the tile (data/driverCodeMap.ts). */
  driverCodes: string[];
  /** Short rationale shown with the codes ("T-01 AI and automation productivity"). */
  driverNote: string;
  /** Impact intensity on this product type at this stage: 1 mild · 2 moderate · 3 strong. */
  intensity: 1 | 2 | 3;
  provenance: TileProvenance;
  /** Profit-pool impact grade (see PoolImpactInfo); a tile added in the editor has none. */
  poolImpact?: PoolImpactInfo;
  /** The Strategist Read: authored analysis (Summary, Strategic Evaluation), not simulation output. */
  analysis: string | null;
}

/** One stage of a journey: the tiles that gain (tailwind) and the tiles under pressure (headwind). */
export interface JourneyStageDef {
  id: string;
  label: string;
  benefiting: JourneyTile[];
  negativelyImpacted: JourneyTile[];
}

/** The tile map an admin edits and the API stores as one version. */
export interface JourneyContent {
  lhc: JourneyStageDef[];
  hair: JourneyStageDef[];
}

/** A stage's authored context: the brands, the competitors and the opportunity at that moment. */
export interface StageContext {
  henkelBrands: string;
  competitors: string;
  opportunity: string;
}

/** The stage contexts of both journeys, keyed by journey and then by stage id, as the API serves them. */
export type JourneyContexts = Record<JourneyKey, Record<string, StageContext>>;
