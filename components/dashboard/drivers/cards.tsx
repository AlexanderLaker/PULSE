/**
 * The Drivers page's chips and labels: the per-field help of the section
 * cards, the meta and Edited chips, the source item with its credibility
 * tier and publishing host, and the small labels the panels share. The
 * section card itself is shared with the Settings sheet
 * (components/dashboard/SectionCard.tsx).
 */
import React, { useEffect, useId, useRef, useState, type FC } from 'react';
import { FileText, ExternalLink, AlertTriangle, X } from 'lucide-react';
import { CATEGORIES, FIRST_YEAR, HORIZON, NO_VALUE, REGIONS, SOURCE_TIERS, fmtPct } from '@/lib/format';
import { UNCERTAINTY_KAPPA, UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
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
  probability: 'Likelihood that this driver materialises as described. Scale: 1 = Very Unlikely, 3 = Possible, 5 = Almost Certain. The 1–5 score sets a Beta prior whose mean is score/6, deliberately shrunk against overconfidence: 1→0.17, 2→0.33, 3→0.50, 4→0.67, 5→0.83 (a "5" means five in six, not certainty). The band width comes from the Beta concentration α+β, which the Uncertainty score sets, sampled by the Monte Carlo.',
  uncertainty: `How much the size and timing of the effect could differ from the modelled values, given its direction: one score per driver. It is not probability (how likely the effect is at all) and not Confidence (how well the present state is evidenced). 0 = fixed by law or contract; 1 = size within about ±25%, timing dated or within a year; 2 = well-evidenced mechanism, size within about ±50%, timing 1–2 years; 3 = size could be half or double, or the onset depends on an undated trigger; 4 = size could be near zero or more than double; 5 = the sign could differ across scenarios, or the effect may not materialise at all. The engine turns it into the Beta-prior concentration (${UNCERTAINTY_KAPPA.join('/')}; the mean stays probability/6) and the peak-year jitter (${UNCERTAINTY_PEAK_JITTER.join('/')} years).`,
  gp1: 'The share of a category’s GP1 (gross profit: net sales less the direct cost of goods) this driver can realistically move at full materialisation. Multiplied by the probability’s mean (probability / 6) and the direction, it gives the driver’s expected effect.',
  timing: `When the driver reaches full impact (the peak year) and the shape of how it builds towards that peak over ${FIRST_YEAR}–${HORIZON} (the diffusion curve).`,
  category: 'How hard this driver hits each Hair and Laundry & Home Care category, on a 0–5 scale.',
  regional: 'How strongly this driver plays out across regions (Europe, North America, Asia, High Growth), on a 0–5 scale.',
  vc: 'The stage of the value chain, from raw materials through to the consumer, where this driver’s impact centres (its epicentre). One stage per driver: the value-chain attribution assigns the driver’s whole contribution to this stage. It does not change the shift.',
  confidence: 'How well the driver\'s present state is evidenced: High, Medium or Low. It is not the probability of the effect.',
} as const;

// ─── Meta chip: the confidence and evidence pills of the meta row ──
/** A pill of the meta row. `plain` sets it in sentence case and lets it wrap
 *  (the evidence line); `help` explains it on hover and to a screen reader. */
export const MetaChip: FC<{ label: string; help?: string; plain?: boolean }> = ({ label, help, plain = false }) => (
  <span title={help} style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 12px', borderRadius: 999,
    fontSize: 11, fontWeight: plain ? 600 : 700, letterSpacing: plain ? 0 : '0.04em',
    backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant,
    textTransform: plain ? 'none' : 'uppercase',
    whiteSpace: plain ? 'normal' : 'nowrap', lineHeight: 1.4, maxWidth: '100%',
  }}>
    {label}
    {help && <span className="sr-only">. {help}</span>}
  </span>
);

// ─── Source tier: the credibility scale, from S (official regulators and
// statistics) to E (social, unverified); the tooltip explains each tier
// (docs/DRIVERS.md, Sources). A-, B+ and B- sit between two grades. ─
export const TIER_CONFIG: Record<SourceTier, { color: string; description: string }> = {
  'S':  { color: '#22c55e', description: 'Statute, regulator, official statistics or peer-reviewed research' },
  'A':  { color: '#3b82f6', description: 'Analyst, consulting or market-measurement research; a major poll or major press; a company’s reports, results or published positions' },
  'A-': { color: '#60a5fa', description: 'Between A and B, nearer A' },
  'B+': { color: '#a78bfa', description: 'Between A and B, nearer B' },
  'B':  { color: '#c084fc', description: 'Specialist research firm or trade press; an earnings-call transcript; a survey' },
  'B-': { color: '#e879f9', description: 'Between B and C, nearer B' },
  'C':  { color: '#f59e0b', description: 'General business press' },
  'D':  { color: '#ef4444', description: 'Aggregator or forecast' },
  'E':  { color: '#991b1b', description: 'Social media or unverified' },
};
export const TIER_OPTIONS: readonly SourceTier[] = SOURCE_TIERS;
/** The whole scale in one line, for the Sources card's help. */
export const TIER_LEGEND = `Source tiers, strongest first. ${TIER_OPTIONS.map((t) => `${t}: ${TIER_CONFIG[t].description}`).join('. ')}.`;

// ─── Source item ──────────────────────────────────────────────────
/** One source: a link when it has one, otherwise the same card as plain text. */
export const SourceItem: FC<{ src: DriverSource }> = ({ src }) => {
  const caption = [sourceHost(src.url), src.published].filter(Boolean).join(' · ');
  const tier = src.tier ? TIER_CONFIG[src.tier] : undefined;
  const card: React.CSSProperties = {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '10px 12px',
    backgroundColor: S.surfaceLow,
    borderRadius: 10,
    textDecoration: 'none',
    color: 'inherit',
  };
  const body = (
    <>
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
          <span style={{ fontWeight: 600 }}>{src.title || sourceHost(src.url) || src.url}</span>
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
        {caption && (
          <span style={{
            display: 'block', fontSize: 11, color: S.mutedText, marginTop: 2,
          }}>
            {caption}
          </span>
        )}
      </span>
    </>
  );
  return src.url ? (
    <a href={src.url} target="_blank" rel="noopener noreferrer" style={card}>
      {body}
      <ExternalLink size={12} aria-label="opens in a new tab" style={{ color: S.mutedText, marginTop: 4 }} />
    </a>
  ) : (
    <div style={card}>{body}</div>
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
      .filter(([key]) => now[key] !== then[key])
      .map(([key, label]) => `${label} ${now[key]} (baseline ${then[key]})`);
    if (changed.length) lines.push(`${input}: ${changed.join(', ')}`);
  };
  compare('Probability', `${d.probability} / 5`, `${base.probability} / 5`);
  compare('GP1 % affected', fmtPct(d.gp1_pct_affected, 0), fmtPct(base.gp1_pct_affected, 0));
  compare('Peak year', String(d.peak_year), String(base.peak_year));
  compare('Diffusion curve', curveLabel(d.diffusion_curve), curveLabel(base.diffusion_curve));
  compare('Uncertainty', uncLabel(d.uncertainty), uncLabel(base.uncertainty));
  compareCells('Category exposure', CATEGORIES.map((c) => [c.name, c.short] as const), d.category_exposure, base.category_exposure);
  compareCells('Regional exposure', REGIONS.map((r) => [r, r] as const), d.regional_exposure, base.regional_exposure);
  compare('Value-chain epicentre', d.vc_epicentre, base.vc_epicentre);
  return lines;
}

/** The Edited chip of a driver an admin has changed: a button that opens the
 *  list of changed inputs with their baseline values in a small popover
 *  (Escape closes it and focus returns to the chip; the hover keeps the same
 *  list as a bonus). An unedited driver carries no chip. */
export const EditedChip: FC<{ driver: Driver }> = ({ driver }) => {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popId = useId();
  // Focus moves to the popover's close button when it opens; a click outside closes it.
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  if (!driver.scores_edited) return null;
  const changes = baselineDifferences(driver, driver.baseline);
  const title = changes.length > 0
    ? ['Edited by an admin. Changed from the baseline:', ...changes].join('\n')
    : 'Edited by an admin; every score matches the baseline.';
  const close = () => {
    setOpen(false);
    chipRef.current?.focus();
  };
  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (open && e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <Chip kind="edited" title={title} onClick={() => setOpen((v) => !v)} expanded={open} buttonRef={chipRef} />
      {open && (
        <div role="dialog" id={popId} aria-label="Changed from the baseline" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
          width: 'max(260px, min(360px, 80vw))', padding: '10px 12px', borderRadius: 10,
          backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, boxShadow: SHADOW.popover,
          fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.5, color: S.onSurface, fontWeight: 500,
          textTransform: 'none', letterSpacing: 0, textAlign: 'left', whiteSpace: 'normal',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: S.onSurfaceVariant }}>
              Edited by an admin
            </span>
            <button ref={closeRef} type="button" onClick={close} aria-label="Close" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
              borderRadius: 999, border: 'none', background: 'transparent', color: S.onSurfaceVariant, cursor: 'pointer',
            }}>
              <X size={13} />
            </button>
          </div>
          {changes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {changes.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p style={{ margin: 0 }}>Every score matches the baseline.</p>
          )}
        </div>
      )}
    </span>
  );
};

export const Dash: FC = () => <span style={{ color: S.mutedText, fontSize: 12 }}>{NO_VALUE}</span>;
export const Val: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: S.onSurface }}>{children}</span>
);

/** The baseline beside an Expert Rating field. */
export const BaselineRef: FC<{ value: string }> = ({ value }) => (
  <span title="The driver's baseline score" style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
    backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11, fontWeight: 700, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', cursor: 'help',
  }}>
    <BaselineMark /> {`Baseline ${value}`}
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
