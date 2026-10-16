/**
 * What the Consumer Journey's parts share: the force colours, the tile types
 * and grades as chips and tints, the state types of the board and the
 * editor, the month an edit stamps, a tile's display name, the ordering of
 * tiles within a stage and a stage's width, the words for intensity, and the
 * drivers a tile cites, resolved to the live drivers.
 */
import type {
  JourneyKey, JourneyStageDef, JourneyTile, TileType, PoolImpactGrade, ProvenanceGrade,
} from '@/data/consumerJourney';
import { DRIVER_CODE_MAP, type DriverCodeInfo } from '@/data/driverCodeMap';
import type { Driver, ForceName } from '@/types';
import { S, EXPANSION_RGB, CONTRACTION_RGB } from '@/lib/theme';
import { FORCE_COLORS } from '@/lib/format';
import type { ChipKind } from '@/components/dashboard/Chip';

/** Force chips use the one force palette of lib/format, so a force has the same colour on every tab. */
export const forceColor = (force: string): string => FORCE_COLORS[force as ForceName] ?? S.primary;

export const TYPE_STYLES: Record<TileType, { label: string; bg: string; fg: string }> = {
  product: { label: 'Product', bg: S.primaryContainer, fg: S.onPrimaryContainer },
  tech: { label: 'Tech', bg: S.surfaceHigh, fg: S.primaryDim },
  service: { label: 'Service', bg: S.surfaceContainer, fg: S.onSurfaceVariant },
};

/** Evidence grade as a shared Chip. 'hypothesis' has no Chip kind of its own and renders neutral; its label carries the meaning. */
export const GRADE_CHIP: Record<ProvenanceGrade, { kind: ChipKind; label: string }> = {
  verified: { kind: 'reported', label: 'Verified' },
  estimate: { kind: 'estimate', label: 'Estimate' },
  hypothesis: { kind: 'neutral', label: 'Hypothesis' },
};

/** The month an edit stamps on a tile, YYYY-MM, read when it is saved. */
export const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A tile's month, stored as YYYY-MM, as the page reads it: "Sep 2026". Anything else is shown as stored. */
export const formatMonth = (yyyyMm: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return yyyyMm;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : yyyyMm;
};

/** The side of a stage a tile sits on: tailwind (benefiting) or headwind (negativelyImpacted). */
export type Side = 'benefiting' | 'negativelyImpacted';

export interface SelectedTile {
  tile: JourneyTile;
  stageId: string;
  stageLabel: string;
  side: Side;
}

/** The fields the admin editor changes. */
export interface TileEdits {
  name: string;
  intensity: 1 | 2 | 3;
  driverNote: string;
  driverCodes: string[];
  analysis: string;
}

/** `uncertain`: the save got no answer and may have been stored; the saved
 *  version must be loaded before the next save. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'forbidden' | 'conflict' | 'uncertain';

/** Where the content on screen came from: the stored version, the bundled copy
 *  (nothing stored yet), or the bundled copy because the stored one could not
 *  be loaded. Saving is possible only once the answer is known. */
export type ContentOrigin = 'loading' | 'stored' | 'bundled' | 'unavailable';

/** A cited driver: its code-map entry and, once the drivers have loaded, the live row. */
export interface CitedDriver {
  code: string;
  info: DriverCodeInfo;
  live: Driver | undefined;
}

/** A tile's name without a trailing parenthetical; the full name stays in the content and in the tooltip. */
export const displayTileName = (name: string): string => name.replace(/\s*\([^()]*\)\s*$/, '').trim();

/** The trailing parenthetical the pill drops ("eco-formats" of "Detergent sheets & pods (eco-formats)"), for the dialog's subtitle. */
export const tileNameSubtitle = (name: string): string | null => {
  const m = /\(([^()]*)\)\s*$/.exec(name);
  const inner = m?.[1]?.trim();
  return inner ? inner : null;
};

/** The side of a tile in words, for its accessible name and the dialog. */
export const sideWord = (side: Side): 'tailwind' | 'headwind' => (side === 'benefiting' ? 'tailwind' : 'headwind');

/** The pool-impact grade in words; a tile added in the editor has no grade yet. */
export const impactWords = (grade?: PoolImpactGrade): string =>
  grade === 'High' ? 'high impact' : grade === 'Med' ? 'medium impact' : grade === 'Low' ? 'low impact' : 'impact not graded';

/** Pool-impact grade to tile tint: High is notably dark, Low much lighter; `up` picks green (tailwind) or red (headwind). */
export const gradeTint = (up: boolean, grade?: PoolImpactGrade): string => {
  const a = grade === 'High' ? 0.36 : grade === 'Med' ? 0.17 : 0.06;
  return `rgba(${up ? EXPANSION_RGB : CONTRACTION_RGB},${a})`;
};

/** Pool-impact grade to the opacity of the tile's accent bar (High solid, Low faint). */
export const gradeBarOpacity = (grade?: PoolImpactGrade): number =>
  grade === 'High' ? 1 : grade === 'Med' ? 0.6 : 0.3;

/**
 * Display order on a stage side: pool-impact grade first (the tint, darkest on
 * top), then intensity; ties keep the content order. Sorts a copy, so the
 * saved content keeps its own order.
 */
const GRADE_RANK: Record<PoolImpactGrade, number> = { High: 3, Med: 2, Low: 1 };
const impactRank = (t: JourneyTile): number => (t.poolImpact ? GRADE_RANK[t.poolImpact.grade] : 0);
export const sortTilesForDisplay = (tiles: JourneyTile[]): JourneyTile[] =>
  [...tiles].sort((a, b) => (impactRank(b) - impactRank(a)) || (b.intensity - a.intensity));

/**
 * A Laundry stage with more than ten tiles on a side spans two grid columns,
 * so its tiles wrap less and the rail stays short; Hair stages stay one column
 * wide. The count ignores the type filter, so a stage keeps its width when the
 * filter changes.
 */
const WIDE_STAGE_TILE_THRESHOLD = 10;
export const stageSpan = (s: JourneyStageDef, journeyKey: JourneyKey): 1 | 2 =>
  (journeyKey === 'lhc' && Math.max(s.benefiting.length, s.negativelyImpacted.length) > WIDE_STAGE_TILE_THRESHOLD ? 2 : 1);

/** The drivers a tile cites, each once. The API stores no code outside the
 *  driver base (prism/api/routers/journey.py); a code a later base no longer
 *  has is left out rather than drawn as a driver. */
export const citedDrivers = (tile: JourneyTile, driversById: Map<string, Driver>): CitedDriver[] =>
  Array.from(new Set(tile.driverCodes)).flatMap(code => {
    const info = DRIVER_CODE_MAP[code];
    return info ? [{ code, info, live: driversById.get(info.driverId) }] : [];
  });

/** The words for a tile's intensity, 1 to 3. */
export const INTENSITY_LABELS: Record<1 | 2 | 3, string> = { 1: 'Mild', 2: 'Moderate', 3: 'Strong' };
