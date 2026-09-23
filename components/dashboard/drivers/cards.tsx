/**
 * The Drivers page's chips and labels: the per-field help of the section
 * cards, the meta and Edited chips, the source item with its credibility
 * tier and publishing host, and the small labels the panels share. The section card itself is
 * shared with the Settings sheet (components/dashboard/SectionCard.tsx).
 */
import React, { type FC } from 'react';
import { FileText, ExternalLink, AlertTriangle } from 'lucide-react';
import { CATEGORIES, FIRST_YEAR, HORIZON, NO_VALUE, REGIONS, fmtPct } from '@/lib/format';
import { UNCERTAINTY_KAPPA, UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import { S, HEADLINE_FONT } from '@/lib/theme';
import { VC_STEPS, epicentreOf } from '@/lib/valueChain';
import Chip from '@/components/dashboard/Chip';
import type { Driver, DriverScores, DriverSource, ExposureMap, SourceTier } from '@/types';
import { curveLabel, uncLabel } from './shared';
import { BaselineMark } from './scales';

// ─── Where a source is published ──────────────────────────────────
/** A source link's host without "www." ("eur-lex.europa.eu"), shown under its
 *  title; null for a link that is not a URL. */
export function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

// ─── Per-field help, shown by the info tips on the section cards ─
export const FIELD_HELP = {
  probability: 'Likelihood this driver materialises at the stated severity. Scale: 1 = Very Unlikely, 3 = Possible, 5 = Almost Certain. The 1–5 score sets a Beta prior whose MEAN is score/6, deliberately shrunk against overconfidence: 1→0.17, 2→0.33, 3→0.50, 4→0.67, 5→0.83 (a "5" means five in six, not certainty). The band width comes from the Beta concentration α+β, which the Uncertainty score sets (6 for an unscored driver), sampled by the Monte Carlo.',
  uncertainty: `How much the SIZE and TIMING of the effect could differ from the modelled values, given its direction: one score per driver. It is not probability (how likely the effect is at all) and not Confidence (how well the present state is evidenced). 0 = fixed by law or contract; 1 = size within about ±25 %, timing dated; 2 = well-evidenced mechanism, size within about ±50 %, timing 1–2 years; 3 = size could be half or double, or the onset depends on an undated trigger; 4 = size could be near zero or more than double; 5 = the sign could differ across scenarios or the effect may not materialise inside the horizon. The engine turns it into the Beta-prior concentration (${UNCERTAINTY_KAPPA.join('/')}; the mean stays probability/6) and the peak-year jitter (${UNCERTAINTY_PEAK_JITTER.join('/')} years). Unscored: concentration 6 and the model-wide ±1-year jitter.`,
  gp1: 'The share of a category’s GP1 (gross profit after cost of goods) this driver can realistically move at full materialization. Multiplied by probability and direction, it produces the Shift.',
  timing: `When the driver reaches full impact (Peak Year) and the shape of how it builds toward that peak over ${FIRST_YEAR}–${HORIZON} (Diffusion Curve).`,
  category: 'How hard this driver hits each Hair and Laundry & Home Care category, on a 0–5 scale. Grey = unscored: a cell you leave blank is not part of your proposal.',
  regional: 'How strongly this driver plays out across regions (Europe, North America, Asia, High Growth), on a 0–5 scale.',
  vc: 'The stage of the value chain, from raw materials through to the consumer, where this driver’s impact centres (its epicentre). One stage per driver: the value-chain attribution assigns the driver’s whole contribution to this stage, which is stored as a profile around it (5 at the stage, 3 one stage away, 1 two stages away).',
} as const;

// ─── Meta chip: the confidence and evidence pills of the meta row ──
export const MetaChip: FC<{ label: string }> = ({ label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 12px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant,
    textTransform: 'uppercase',
  }}>
    {label}
  </span>
);

// ─── Source tier: the credibility scale, from S (official regulators and
// statistics) to E (social, unverified); the tooltip explains each tier. ─
export const TIER_CONFIG: Record<SourceTier, { color: string; description: string }> = {
  'S':  { color: '#22c55e', description: 'Official regulatory / statistical authority' },
  'A':  { color: '#3b82f6', description: 'Tier-1 consulting or analyst primary research' },
  'A-': { color: '#60a5fa', description: 'Investment-bank equity research' },
  'B+': { color: '#a78bfa', description: 'Specialist market-research firm' },
  'B':  { color: '#c084fc', description: 'Industry trade press' },
  'B-': { color: '#e879f9', description: 'Company first-party source' },
  'C':  { color: '#f59e0b', description: 'General business press' },
  'D':  { color: '#ef4444', description: 'Aggregator / forecast' },
  'E':  { color: '#991b1b', description: 'Social / unverified' },
};
export const TIER_OPTIONS = Object.keys(TIER_CONFIG) as SourceTier[];

// ─── Source item ──────────────────────────────────────────────────
export const SourceItem: FC<{ src: DriverSource }> = ({ src }) => {
  const caption = [sourceHost(src.url), src.note].filter(Boolean).join(' · ');
  const tier = src.tier ? TIER_CONFIG[src.tier] : undefined;
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '10px 12px',
        backgroundColor: S.surfaceLow,
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: S.surface, color: S.primary,
      }}>
        <FileText size={14} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontSize: 13, fontWeight: 600,
          color: S.onSurface, lineHeight: 1.35,
        }}>
          <span style={{ fontWeight: 600 }}>{src.title}</span>
          {tier && (
            <span
              title={`Source rating ${src.tier}: ${tier.description}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 22, height: 18, padding: '0 6px',
                borderRadius: 4,
                fontFamily: HEADLINE_FONT,
                fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                backgroundColor: `${tier.color}22`,
                color: tier.color,
                border: `1px solid ${tier.color}55`,
                textTransform: 'none',
              }}
            >
              {src.tier}
            </span>
          )}
        </span>
        <span style={{
          display: 'block', fontSize: 11, color: S.mutedText, marginTop: 2,
        }}>
          {caption}
        </span>
      </span>
      <ExternalLink size={12} style={{ color: S.mutedText, marginTop: 4 }} />
    </a>
  );
};

// ─── Edited: the model inputs an admin has moved off the baseline ─
/** One line per model input whose current value differs from the baseline,
 *  compared at display precision; the value chain by its epicentre stage. */
function baselineDifferences(d: Driver, base: DriverScores): string[] {
  const lines: string[] = [];
  const compare = (input: string, now: string, then: string) => {
    if (now !== then) lines.push(`${input}: ${now} (baseline ${then})`);
  };
  const compareCells = (
    input: string, cells: ReadonlyArray<readonly [key: string, label: string]>, now: ExposureMap, then: ExposureMap,
  ) => {
    const changed = cells
      .filter(([key]) => (now[key] ?? 0) !== (then[key] ?? 0))
      .map(([key, label]) => `${label} ${now[key] ?? 0} (baseline ${then[key] ?? 0})`);
    if (changed.length) lines.push(`${input}: ${changed.join(', ')}`);
  };
  const stage = (profile: ExposureMap): string => {
    const s = epicentreOf(profile);
    return s == null ? 'unscored' : VC_STEPS[s - 1];
  };
  compare('Probability', `${d.probability} / 5`, `${base.probability} / 5`);
  compare('GP1 % affected', fmtPct(d.gp1_pct_affected, 0), fmtPct(base.gp1_pct_affected, 0));
  compare('Peak year', String(d.peak_year), String(base.peak_year));
  compare('Diffusion curve', curveLabel(d.diffusion_curve), curveLabel(base.diffusion_curve));
  compare('Uncertainty', uncLabel(d.uncertainty), uncLabel(base.uncertainty));
  compareCells('Category exposure', CATEGORIES.map((c) => [c.name, c.short] as const), d.category_exposure, base.category_exposure);
  compareCells('Regional exposure', REGIONS.map((r) => [r, r] as const), d.regional_exposure, base.regional_exposure);
  compare('Value chain epicentre', stage(d.vc_exposure), stage(base.vc_exposure));
  return lines;
}

/** The Edited chip of a driver an admin has changed, listing the changed
 *  inputs with their baseline values; an unedited driver carries no chip. */
export const EditedChip: FC<{ driver: Driver }> = ({ driver }) => {
  if (!driver.scores_edited) return null;
  const changes = driver.baseline ? baselineDifferences(driver, driver.baseline) : [];
  const title = !driver.baseline
    ? 'Edited by an admin. This driver has no baseline to compare with.'
    : changes.length > 0
      ? ['Edited by an admin. Changed from the baseline:', ...changes].join('\n')
      : 'Edited by an admin; every score matches the baseline.';
  return <Chip kind="edited" title={title} />;
};

export const Dash: FC = () => <span style={{ color: S.mutedText, fontSize: 12 }}>{NO_VALUE}</span>;
export const Val: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: S.onSurface }}>{children}</span>
);

/** The baseline beside an Expert Rating field; `value` is null without one. */
export const BaselineRef: FC<{ value: string | null }> = ({ value }) => (
  <span title="The driver's baseline score" style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
    backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11, fontWeight: 700, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', cursor: 'help',
  }}>
    <BaselineMark /> {`Baseline ${value ?? NO_VALUE}`}
  </span>
);

/** Shown in place of a panel whose proposals could not be loaded. */
export const ProposalsUnavailable: FC<{ what: string; onRetry: () => void }> = ({ what, onRetry }) => (
  <div role="alert" style={{ padding: '26px 0', textAlign: 'center', color: S.onSurfaceVariant }}>
    <AlertTriangle size={20} style={{ color: S.error }} />
    <div style={{ marginTop: 8, fontSize: 14 }}>The proposals for this driver could not be loaded, so {what}.</div>
    <button type="button" onClick={onRetry} style={{
      marginTop: 12, padding: '7px 16px', borderRadius: 999, border: `1px solid ${S.cardBorder}`,
      background: S.surface, color: S.primary, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    }}>
      Try again
    </button>
  </div>
);

// A label over an edit control
export const FieldLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: S.mutedText, marginBottom: 6,
  }}>
    {children}
  </div>
);
