/**
 * Review & Endorse, for admins: one driver's expert aggregate against its
 * baseline, field by field. The admin chooses per field between the current
 * value, the baseline, the expert mean and a manual value, and endorsing
 * writes the chosen values through the validated, audited driver edit.
 */
import React, { useMemo, useState, type FC } from 'react';
import {
  Users, Cpu, FileText, BarChart3, Clock, Zap, MapPin, Layers, Check, MessageSquare,
} from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { CATEGORIES, NO_VALUE, REGIONS, fmtPct, shortCat } from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { VC_STEPS, VC_SHORT_LABELS, canonicalVcProfile, epicentreOf } from '@/lib/valueChain';
import type { Driver, DriverUpdate, ExposureMap, ProposalAgg } from '@/types';
import {
  baselineOf, curveLabel, DIFFUSION_LABELS, EXPERT_COLOR, REVIEWED_COLOR, uncLabel, vcPos,
} from './shared';
import { BaselineMark, ColorDots, DeltaChip, DiffusionGlyph, EditableDots, ReadDots } from './scales';
import { FIELD_HELP, FieldLabel, ProposalsUnavailable, SectionCard, Val } from './cards';
import { useDriverProposals } from './useDriverProposals';

// ── Mini 0–100% bar (the GP1 % comparison) ──
const MiniBar: FC<{ v?: number; color: string }> = ({ v, color }) => (
  <div className="flex items-center gap-2" style={{ flex: 1 }}>
    <div style={{ position: 'relative', height: 7, borderRadius: 7, backgroundColor: S.surfaceHigh, flex: 1, maxWidth: 150 }}>
      {v != null && <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, Math.round(v * 100))}%`, backgroundColor: color, borderRadius: 7 }} />}
    </div>
    <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: v != null ? color : S.onSurfaceVariant }}>{fmtPct(v, 0)}</span>
  </div>
);

// ── Baseline over expert mean: the baseline row (ink) on top, the expert
//    mean (green) below, with who scored what on hover ──
const CompareStack: FC<{ baseline: React.ReactNode; expert: React.ReactNode; who?: string }> = ({ baseline, expert, who }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div className="flex items-center gap-2.5">
      <span style={{ fontSize: 11, fontWeight: 800, color: S.onSurface, width: 30, flexShrink: 0, letterSpacing: '0.04em' }}>Base</span>
      {baseline}
    </div>
    <div className="flex items-center gap-2.5" title={who} style={{ cursor: who ? 'help' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: REVIEWED_COLOR, width: 30, flexShrink: 0, letterSpacing: '0.04em' }}>ø</span>
      {expert}
    </div>
  </div>
);

// ── One exposure cell: its label, the baseline dots (ink) over the expert
//    mean (green), and the manual override ──
/** An exposure cell of the Review panel: its key and label, the baseline
 *  score and the experts' aggregate. */
interface ExposureRow { key: string; label: string; baseV?: number; curV: number; expert?: ProposalAgg }

const ExposureCompareCell: FC<{ label: string; baseVal?: number; expert?: ProposalAgg; manualVal?: number; onManual: (v: number) => void }> = ({ label, baseVal, expert, manualVal, onManual }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '9px 11px', border: `1px solid ${S.cardBorder}`, borderRadius: 9, backgroundColor: S.surface }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: S.onSurface }}>{label}</span>
      {expert?.count ? <span style={{ fontSize: 11, fontWeight: 700, color: S.mutedText }} title={`${expert.count} expert(s) scored`}>n{expert.count}</span> : null}
    </div>
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, fontWeight: 800, color: S.onSurface, width: 38, flexShrink: 0, textAlign: 'right' }}>Base</span>
      <ReadDots value={baseVal} color={S.onSurface} />
    </div>
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, fontWeight: 800, color: REVIEWED_COLOR, width: 38, flexShrink: 0, textAlign: 'right' }}>ø</span>
      <ReadDots value={expert?.avg} color={REVIEWED_COLOR} />
    </div>
    <div className="flex items-center gap-2" style={{ paddingTop: 5, borderTop: `1px solid ${S.surfaceLow}` }}>
      {/* Tightened tracking so "Manual" fits the 38px label gutter at 11px. */}
      <span style={{ fontSize: 11, letterSpacing: '-0.02em', fontWeight: 800, color: S.primary, width: 38, flexShrink: 0, textAlign: 'right' }} title="Manual override: click a dot to set">Manual</span>
      <EditableDots value={manualVal} onChange={(v) => { if (v != null) onManual(v); }} label={`${label} manual score`} />
    </div>
  </div>
);

// ── Per-field endorse choice: keep the current value, the baseline, the expert mean or a manual value ──
type EndorseSource = 'current' | 'baseline' | 'expert' | 'manual';
const ENDORSE_OPTIONS: Array<[EndorseSource, string]> = [
  ['current', 'Keep'], ['baseline', 'Baseline'], ['expert', 'Expert ø'], ['manual', 'Manual'],
];
/** What an exposure grid endorses, by its choice. */
const EXPOSURE_RESULT: Record<EndorseSource, string> = {
  current: 'Keep the current scores', baseline: 'Baseline', expert: 'Expert ø where scored, current elsewhere',
  manual: 'Manual (custom)',
};

const manInput: React.CSSProperties = {
  width: 66, padding: '5px 8px', borderRadius: 7, border: `1px solid ${S.primary}`,
  background: S.surface, color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 13,
};
const Decide: FC<{
  cur: EndorseSource;
  onPick: (s: EndorseSource) => void;
  baselineOk: boolean; expertOk: boolean;
  manual?: React.ReactNode;
  result?: React.ReactNode;
}> = ({ cur, onPick, baselineOk, expertOk, manual, result }) => (
  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.surfaceLow}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: S.mutedText }}>Endorse</span>
    <div style={{ display: 'inline-flex', border: `1px solid ${S.cardBorder}`, borderRadius: 999, overflow: 'hidden' }}>
      {ENDORSE_OPTIONS.map(([k, lab], i) => {
        const on = cur === k;
        const disabled = (k === 'baseline' && !baselineOk) || (k === 'expert' && !expertOk);
        const bg = on
          ? (k === 'current' ? S.onSurfaceVariant : k === 'baseline' ? S.onSurface : k === 'expert' ? REVIEWED_COLOR : S.primary)
          : S.surface;
        return (
          <button key={k} type="button" disabled={disabled} onClick={() => onPick(k)} aria-pressed={on}
            style={{ border: 'none', borderRight: i < ENDORSE_OPTIONS.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700,
              padding: '6px 11px', background: bg, color: on ? '#fff' : (disabled ? S.mutedText : S.onSurfaceVariant), opacity: disabled ? 0.45 : 1 }}>
            {lab}
          </button>
        );
      })}
    </div>
    {cur === 'manual' && manual}
    {result != null && <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onSurface }}>→ {result}</span>}
  </div>
);

// ── Value-chain epicentre votes (Review & Endorse) ──
// Stages are categories: each expert's pick is a stacked dot on its stage,
// counted and never averaged (a Supply Chain vote and two Commercial votes
// must not blend into Marketing). The admin keeps the current stage, endorses
// the majority or the baseline stage, or clicks any stage on the rail; a tie
// leaves no majority and stays visible.
const EpicentreVotePanel: FC<{
  baseline: number | null;
  /** The driver's stage now. */
  current: number | null;
  votes: Array<{ name: string; stage: number }>;
  majority: { stage: number; n: number } | null;
  endorsed: number | null;
  onEndorse: (stage: number) => void;
}> = ({ baseline, current, votes, majority, endorsed, onEndorse }) => {
  const byStage = new Map<number, Array<{ name: string }>>();
  for (const v of votes) {
    const l = byStage.get(v.stage) ?? [];
    l.push(v);
    byStage.set(v.stage, l);
  }
  const srcText = endorsed == null ? null
    : endorsed === current ? 'kept as it is'
    : majority != null && endorsed === majority.stage ? `Expert majority (${majority.n} of ${votes.length})`
    : baseline != null && endorsed === baseline ? 'Baseline'
    : 'Manual pick';
  const pillStyle = (on: boolean, disabled = false): React.CSSProperties => ({
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, padding: '6px 12px',
    background: on ? S.onSurface : S.surface,
    color: on ? '#fff' : disabled ? S.mutedText : S.onSurfaceVariant,
    opacity: disabled ? 0.45 : 1,
  });
  return (
    <div>
      <div style={{ position: 'relative', height: 78 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54, height: 6, borderRadius: 6, backgroundColor: S.surfaceHigh }} />
        {VC_STEPS.map((step, i) => (
          <button
            key={step} type="button" onClick={() => onEndorse(i + 1)}
            title={`Endorse ${step}`} aria-label={`Endorse ${step}`}
            style={{
              position: 'absolute', top: 52, left: vcPos(i + 1), width: 10, height: 10,
              borderRadius: 999, backgroundColor: S.surfaceHighest, border: 'none',
              padding: 0, cursor: 'pointer', transform: 'translateX(-50%)',
            }}
          />
        ))}
        {[...byStage.entries()].map(([stage, list]) => {
          const who = list.map((v) => v.name).join('\n');
          return (
            <React.Fragment key={stage}>
              <span title={who} style={{ position: 'absolute', top: 48, left: vcPos(stage), width: 2, height: 5, backgroundColor: EXPERT_COLOR, opacity: 0.35, transform: 'translateX(-50%)', cursor: 'help' }} />
              {list.slice(0, 3).map((v, j) => (
                <span
                  key={`${stage}-${j}`}
                  title={j === 2 && list.length > 3 ? who : `${v.name} → ${VC_STEPS[stage - 1]}`}
                  style={{
                    position: 'absolute', top: 36 - 13 * j, left: vcPos(stage), width: 10, height: 10,
                    borderRadius: 999, backgroundColor: EXPERT_COLOR, opacity: 0.65,
                    transform: 'translateX(-50%)', cursor: 'help',
                  }}
                />
              ))}
              {list.length > 3 && (
                <span title={who} style={{ position: 'absolute', top: 8, left: vcPos(stage), transform: 'translateX(-50%)', fontSize: 11, fontWeight: 800, color: EXPERT_COLOR, cursor: 'help' }}>
                  ×{list.length}
                </span>
              )}
            </React.Fragment>
          );
        })}
        {baseline != null && (
          <span title={`Baseline · ${VC_STEPS[baseline - 1]}`} style={{ position: 'absolute', top: 64, left: vcPos(baseline), width: 9, height: 9, backgroundColor: S.bg, border: `2px solid ${S.onSurface}`, transform: 'translateX(-50%) rotate(45deg)', cursor: 'help' }} />
        )}
        {endorsed != null && (
          <span title={`Endorsed · ${VC_STEPS[endorsed - 1]}`} style={{ position: 'absolute', top: 47, left: vcPos(endorsed), width: 20, height: 20, borderRadius: 999, backgroundColor: REVIEWED_COLOR, border: '3px solid #ffffff', outline: '1px solid rgba(31,122,61,0.45)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 2 }}>
        {VC_STEPS.map((step, i) => (
          <button
            key={step} type="button" onClick={() => onEndorse(i + 1)}
            aria-pressed={i + 1 === endorsed}
            title={`Endorse ${step}`}
            style={{
              border: 'none', background: 'transparent', padding: '4px 0', cursor: 'pointer',
              fontFamily: BODY_FONT, fontSize: 11, textAlign: 'center', lineHeight: 1.25,
              color: i + 1 === endorsed ? REVIEWED_COLOR : S.mutedText,
              fontWeight: i + 1 === endorsed ? 800 : 400,
            }}
          >
            {VC_SHORT_LABELS[i]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: S.mutedText }}>
        <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: EXPERT_COLOR, opacity: 0.65 }} /> One dot = one expert vote</span>
        <span className="inline-flex items-center gap-1.5"><BaselineMark size={12} /> Baseline</span>
        <span className="inline-flex items-center gap-1.5"><span style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: REVIEWED_COLOR, border: '2px solid #fff', outline: '1px solid rgba(31,122,61,0.45)' }} /> Endorsed stage</span>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.surfaceLow}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: S.mutedText }}>Endorse</span>
        <div style={{ display: 'inline-flex', border: `1px solid ${S.cardBorder}`, borderRadius: 999, overflow: 'hidden' }}>
          <button
            type="button" disabled={current == null}
            onClick={() => { if (current != null) onEndorse(current); }}
            aria-pressed={current != null && endorsed === current}
            style={{ ...pillStyle(current != null && endorsed === current, current == null), borderRight: `1px solid ${S.cardBorder}` }}
          >
            {current != null ? `Keep · ${VC_STEPS[current - 1]}` : `Keep ${NO_VALUE}`}
          </button>
          <button
            type="button" disabled={baseline == null}
            onClick={() => { if (baseline != null) onEndorse(baseline); }}
            aria-pressed={baseline != null && endorsed === baseline}
            style={{ ...pillStyle(baseline != null && endorsed === baseline, baseline == null), borderRight: `1px solid ${S.cardBorder}` }}
          >
            {baseline != null ? `Baseline · ${VC_STEPS[baseline - 1]}` : `Baseline ${NO_VALUE}`}
          </button>
          <button
            type="button" disabled={majority == null}
            onClick={() => { if (majority) onEndorse(majority.stage); }}
            aria-pressed={majority != null && endorsed === majority.stage}
            style={pillStyle(majority != null && endorsed === majority.stage, majority == null)}
          >
            {majority != null
              ? `Majority · ${VC_STEPS[majority.stage - 1]} (${majority.n}/${votes.length})`
              : votes.length > 0 ? 'No majority: a tie' : 'No expert votes yet'}
          </button>
        </div>
        <span style={{ fontSize: 11.5, color: S.mutedText }}>or click a stage on the rail</span>
        {endorsed != null && srcText && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onSurface }}>
            → <span style={{ color: REVIEWED_COLOR }}>{VC_STEPS[endorsed - 1]}</span> · {srcText}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Review & Endorse panel (admins) ──
export const ReviewPanel: FC<{ driver: Driver; updateDriver: (driverId: string, update: DriverUpdate) => Promise<void> }> = ({ driver, updateDriver }) => {
  const { data, loaded, failed, retry } = useDriverProposals(driver.id);
  const [src, setSrc] = useState<Record<string, EndorseSource>>({});
  const [man, setMan] = useState<Record<string, string>>({});
  const [manExpo, setManExpo] = useState<Record<string, ExposureMap>>({});
  // The value chain is endorsed as one stage: the admin's pick, else the
  // expert majority, else the baseline stage. Never an average (see
  // EpicentreVotePanel).
  const [endorsedVc, setEndorsedVc] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const agg = data?.aggregate;
  // Memoised so the vote memo below does not rerun on every render while the
  // proposals load (`data?.scorers ?? []` is a new array each time).
  const scorers = useMemo(() => data?.scorers ?? [], [data]);
  const count = scorers.length || driver.proposal_summary.count;
  // Every expert's comment from the Expert Rating panel; blank ones are skipped.
  const comments = scorers.filter((s) => (s.comment ?? '').trim().length > 0);

  // The baseline (see baselineOf) and the expert aggregate.
  const base = baselineOf(driver);
  const bP = base?.probability, bG = base?.gp1_pct_affected, bPk = base?.peak_year, bCv = base?.diffusion_curve;
  const bU = base?.uncertainty;
  const baseCat = base?.category_exposure;
  const baseReg = base?.regional_exposure;
  const baseVc = base?.vc_exposure;
  const baseVcStage = epicentreOf(baseVc);
  const eP = agg?.probability?.avg, eG = agg?.gp1_pct_affected?.avg, ePk = agg?.peak_year?.median, eCv = agg?.diffusion_curve?.mode;
  const eU = agg?.uncertainty?.median;
  // One value-chain vote per expert: the epicentre of the expert's profile.
  const vcVotes = useMemo(
    () => scorers
      .map((s) => ({ name: s.name, stage: epicentreOf(s.vc_exposure) }))
      .filter((v): v is { name: string; stage: number } => v.stage != null),
    [scorers],
  );
  const vcMajority = useMemo(() => {
    const counts = new Map<number, number>();
    for (const v of vcVotes) counts.set(v.stage, (counts.get(v.stage) ?? 0) + 1);
    let best: { stage: number; n: number } | null = null;
    let tied = false;
    for (const [stage, n] of counts) {
      if (best == null || n > best.n) { best = { stage, n }; tied = false; }
      else if (n === best.n) tied = true;
    }
    return tied ? null : best;
  }, [vcVotes]);
  // The stage the driver has now; endorsing it leaves the stored profile as it is.
  const currentVcStage = epicentreOf(driver.vc_exposure);
  const endorsedVcStage = endorsedVc ?? vcMajority?.stage ?? currentVcStage;
  const grouped = { Hair: CATEGORIES.filter((c) => c.group === 'Hair'), LHC: CATEGORIES.filter((c) => c.group === 'LHC') };
  const grpLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: S.onSurfaceVariant, margin: '2px 0 8px' };

  const whoFor = (field: 'probability' | 'gp1_pct_affected' | 'peak_year' | 'diffusion_curve' | 'uncertainty'): string | undefined => {
    const rows = scorers.filter((s) => s[field] != null);
    if (rows.length === 0) return undefined;
    return rows.map((s) => `${s.name}: ${field === 'gp1_pct_affected' ? fmtPct(s[field] as number, 0) : s[field]}`).join('\n');
  };
  // The expert mean of every cell an expert scored. The API changes only the
  // cells an edit names, so a cell nobody scored keeps its current value.
  const expertMap = (cells: ExposureRow[]): ExposureMap | undefined => {
    const out: ExposureMap = {};
    for (const c of cells) {
      if (c.expert?.avg != null) out[c.key] = Math.round(c.expert.avg);
    }
    return Object.keys(out).length ? out : undefined;
  };
  // Per-field endorse choice. A field defaults to the expert mean when an
  // expert scored it; a field nobody scored keeps its current value (an
  // admin's earlier edit stands). The admin can switch each field to the
  // baseline or enter a manual value.
  const hasCatE = !!(agg?.category_exposure && Object.keys(agg.category_exposure).length);
  const hasRegE = !!(agg?.regional_exposure && Object.keys(agg.regional_exposure).length);
  const srcOf = (key: string, hasExpert: boolean): EndorseSource => src[key] ?? (hasExpert ? 'expert' : 'current');
  const setS = (key: string, s: EndorseSource) => setSrc((p) => ({ ...p, [key]: s }));
  const setM = (key: string, v: string) => setMan((p) => ({ ...p, [key]: v }));
  const setAll = (s: EndorseSource) => {
    // "Set all to Manual" seeds the scalar inputs with the expert mean, else
    // the current value, so each field starts from a sensible value; exposure
    // cells default the same way through manCell.
    if (s === 'manual') {
      const numStr = (v: number | null | undefined) => (v == null ? '' : String(v));
      setMan({
        probability: numStr(eP != null ? Math.round(eP) : driver.probability),
        gp1: numStr(Math.round((eG ?? driver.gp1_pct_affected) * 100)),
        peak: numStr(ePk != null ? Math.round(ePk) : driver.peak_year || undefined),
        curve: eCv || driver.diffusion_curve || '',
        uncertainty: numStr(eU != null ? Math.round(eU) : driver.uncertainty),
      });
    }
    setSrc({ probability: s, gp1: s, peak: s, curve: s, uncertainty: s, category: s, region: s });
    // The value chain follows where a value exists; its manual choice is a
    // click on the rail, so "manual" leaves it alone.
    if (s === 'current') setEndorsedVc(currentVcStage);
    else if (s === 'baseline') setEndorsedVc(baseVcStage);
    else if (s === 'expert' && vcMajority != null) setEndorsedVc(vcMajority.stage);
  };
  // Manual exposure cells default to the expert mean (rounded) where scored,
  // else the current score; editing a cell switches its grid to Manual.
  const manCell = (kind: string, key: string, curV: number | undefined, expAvg: number | undefined): number | undefined => {
    const ex = manExpo[kind]?.[key];
    if (ex != null) return ex;
    if (expAvg != null) return Math.round(expAvg);
    return curV;
  };
  const setManCell = (kind: string, key: string, v: number) => {
    setManExpo((p) => ({ ...p, [kind]: { ...(p[kind] ?? {}), [key]: v } }));
    setS(kind, 'manual');
  };
  const catCells = CATEGORIES.map((c) => ({
    key: c.name, label: shortCat(c.name), group: c.group,
    baseV: baseCat == null ? undefined : (baseCat[c.name] ?? 0),
    curV: driver.category_exposure[c.name] ?? 0,
    expert: agg?.category_exposure[c.name],
  }));
  const regCells = REGIONS.map((r) => ({
    key: r, label: r,
    baseV: baseReg == null ? undefined : (baseReg[r] ?? 0),
    curV: driver.regional_exposure[r] ?? 0,
    expert: agg?.regional_exposure[r],
  }));
  const buildManualMap = (kind: string, cells: ExposureRow[]): ExposureMap | undefined => {
    const out: ExposureMap = {};
    for (const c of cells) { const v = manCell(kind, c.key, c.curV, c.expert?.avg); if (v != null) out[c.key] = v; }
    return Object.keys(out).length ? out : undefined;
  };

  // What each field endorses, within the ranges the API accepts; a field
  // that resolves to nothing is left out and keeps its value.
  const resolveProb = (): number | undefined => {
    const s = srcOf('probability', eP != null);
    if (s === 'current') return undefined;
    if (s === 'manual') { const n = parseInt(man.probability ?? '', 10); return isNaN(n) ? undefined : Math.max(1, Math.min(5, n)); }
    if (s === 'baseline') return bP;
    return eP != null ? Math.round(eP) : undefined;
  };
  // A GP1 share in (0, 1]: a zero share is left out.
  const resolveGp1 = (): number | undefined => {
    const s = srcOf('gp1', eG != null);
    if (s === 'current') return undefined;
    let v: number | undefined;
    if (s === 'manual') { const n = parseInt(man.gp1 ?? '', 10); v = isNaN(n) ? undefined : Math.min(100, n) / 100; }
    else v = s === 'baseline' ? bG : eG;
    return v != null && v > 0 ? Math.min(1, v) : undefined;
  };
  // A whole year in 2025–2035; anything else (such as the 0 of a driver
  // without a peak year) is left out, so the driver keeps its timing.
  const resolvePeak = (): number | undefined => {
    const s = srcOf('peak', ePk != null);
    if (s === 'current') return undefined;
    let n: number | undefined;
    if (s === 'manual') { const m = parseInt(man.peak ?? '', 10); n = isNaN(m) ? undefined : Math.max(2025, Math.min(2035, m)); }
    else if (s === 'baseline') n = bPk;
    else n = ePk != null ? Math.round(ePk) : undefined;
    if (n == null || !Number.isFinite(n) || n < 2025 || n > 2035) return undefined;
    return n;
  };
  const resolveCurve = (): string | undefined => {
    const s = srcOf('curve', !!eCv);
    if (s === 'current') return undefined;
    if (s === 'manual') return man.curve || undefined;
    if (s === 'baseline') return bCv;
    return eCv;
  };
  // A whole score 0–5; left out when nothing resolves, so an unscored driver
  // stays unscored.
  const resolveUnc = (): number | undefined => {
    const s = srcOf('uncertainty', eU != null);
    if (s === 'current') return undefined;
    let n: number | null | undefined;
    if (s === 'manual') { const m = parseInt(man.uncertainty ?? '', 10); n = isNaN(m) ? undefined : m; }
    else if (s === 'baseline') n = bU;
    else n = eU != null ? Math.round(eU) : undefined;
    if (n == null || !Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(5, n));
  };
  const resolved = {
    probability: resolveProb(),
    gp1: resolveGp1(),
    peak: resolvePeak(),
    curve: resolveCurve(),
    uncertainty: resolveUnc(),
  };

  const endorse = async () => {
    setErr(null); setSaving(true);
    const u: DriverUpdate = { revision: driver.revision };
    if (resolved.probability != null) u.probability = resolved.probability;
    if (resolved.gp1 != null) u.gp1_pct_affected = resolved.gp1;
    if (resolved.peak != null) u.peak_year = resolved.peak;
    if (resolved.curve) u.diffusion_curve = resolved.curve;
    if (resolved.uncertainty != null) u.uncertainty = resolved.uncertainty;
    const sc = srcOf('category', hasCatE);
    if (sc === 'manual') { const m = buildManualMap('category', catCells); if (m) u.category_exposure = m; }
    else if (sc === 'baseline') { if (baseCat) u.category_exposure = baseCat; }
    else if (sc === 'expert') { const c = expertMap(catCells); if (c) u.category_exposure = c; }
    const sr = srcOf('region', hasRegE);
    if (sr === 'manual') { const m = buildManualMap('region', regCells); if (m) u.regional_exposure = m; }
    else if (sr === 'baseline') { if (baseReg) u.regional_exposure = baseReg; }
    else if (sr === 'expert') { const r = expertMap(regCells); if (r) u.regional_exposure = r; }
    // A stage that does not move leaves the stored profile as it is; the
    // baseline stage writes the baseline profile itself, any other stage its
    // canonical profile.
    if (endorsedVcStage != null && endorsedVcStage !== currentVcStage) {
      u.vc_exposure = baseVcStage != null && endorsedVcStage === baseVcStage && baseVc
        ? baseVc
        : canonicalVcProfile(endorsedVcStage);
    }
    try { await updateDriver(driver.id, u); setDone(true); }
    catch (e) {
      setErr(e instanceof ApiError && e.status === 409
        ? 'The driver changed after this panel loaded; it now shows the current version. Check it and endorse again.'
        : (e as Error)?.message ?? 'Endorse failed');
    }
    finally { setSaving(false); }
  };

  const exposureCell = (kind: 'category' | 'region', c: ExposureRow) => (
    <ExposureCompareCell key={c.key} label={c.label} baseVal={c.baseV} expert={c.expert}
      manualVal={manCell(kind, c.key, c.curV, c.expert?.avg)} onManual={(v) => setManCell(kind, c.key, v)} />
  );
  // What "Keep" writes for a scalar field: nothing; shown as the current value.
  const keep = (v: React.ReactNode) => `keep ${v}`;
  const resultOf = (key: string, hasExpert: boolean, resolvedText: React.ReactNode, currentText: React.ReactNode) =>
    srcOf(key, hasExpert) === 'current' ? keep(currentText) : resolvedText;

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ padding: '24px 32px 30px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: EXPERT_COLOR }}>
          <Users size={13} strokeWidth={2.4} /> Review &amp; Endorse · {count} expert{count === 1 ? '' : 's'} scored
        </span>
        <span className="inline-flex items-center gap-3" style={{ fontSize: 11, fontWeight: 700 }}>
          <span className="inline-flex items-center gap-1.5" style={{ color: S.onSurface }}><span style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: S.onSurface }} /> Baseline</span>
          <span className="inline-flex items-center gap-1.5" style={{ color: REVIEWED_COLOR }}><span style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: REVIEWED_COLOR }} /> Expert ø</span>
        </span>
      </div>

      {failed ? (
        <ProposalsUnavailable what="there is nothing to endorse right now" onRetry={retry} />
      ) : loaded && count === 0 ? (
        <div style={{ padding: '26px 0', textAlign: 'center', color: S.onSurfaceVariant }}>
          <Users size={20} style={{ color: S.primary }} />
          <div style={{ marginTop: 8, fontSize: 14 }}>No expert proposals yet for this driver.</div>
        </div>
      ) : (
        <>
          {/* Laid out like the Expert Rating panel; every field shows the
              baseline (ink) over the expert mean (green). */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 20 }}>
            {/* Left: context, the core scores and timing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionCard title="Context" icon={FileText}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: S.onSurface, whiteSpace: 'pre-wrap' }}>
                  {driver.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
                </p>
              </SectionCard>

              <SectionCard title="Probability" icon={Zap} footnote="1 = Very Unlikely · 3 = Possible · 5 = Almost Certain.">
                <CompareStack who={whoFor('probability')}
                  baseline={<><ColorDots value={bP ?? 0} color={S.onSurface} /><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: S.onSurfaceVariant }}>{bP ?? NO_VALUE}</span></>}
                  expert={<><ColorDots value={eP != null ? Math.round(eP) : 0} color={REVIEWED_COLOR} /><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: REVIEWED_COLOR }}>{eP != null ? eP.toFixed(1) : NO_VALUE}</span>{eP != null && bP != null ? <DeltaChip value={eP - bP} /> : null}</>} />
                <Decide cur={srcOf('probability', eP != null)} onPick={(s) => setS('probability', s)} baselineOk={bP != null} expertOk={eP != null}
                  manual={<input type="number" min={1} max={5} value={man.probability ?? ''} onChange={(e) => setM('probability', e.target.value)} placeholder="1–5" style={manInput} />}
                  result={resultOf('probability', eP != null, resolved.probability ?? NO_VALUE, driver.probability)} />
              </SectionCard>

              <SectionCard title="Impact: GP1 % exposed" icon={BarChart3} footnote="Share of category GP1 this driver can move at full materialization.">
                <CompareStack who={whoFor('gp1_pct_affected')}
                  baseline={<MiniBar v={bG} color={S.onSurface} />}
                  expert={<><MiniBar v={eG} color={REVIEWED_COLOR} />{eG != null && bG != null ? <DeltaChip value={(eG - bG) * 100} unit="pp" digits={0} /> : null}</>} />
                <Decide cur={srcOf('gp1', eG != null)} onPick={(s) => setS('gp1', s)} baselineOk={bG != null} expertOk={eG != null}
                  manual={<span className="inline-flex items-center gap-1"><input type="number" min={1} max={100} value={man.gp1 ?? ''} onChange={(e) => setM('gp1', e.target.value)} placeholder="%" style={manInput} /><span style={{ fontSize: 12, color: S.mutedText }}>%</span></span>}
                  result={resultOf('gp1', eG != null, fmtPct(resolved.gp1, 0), fmtPct(driver.gp1_pct_affected, 0))} />
              </SectionCard>

              <SectionCard title="Materialization timing" icon={Clock}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <FieldLabel>Peak Year</FieldLabel>
                    <CompareStack who={whoFor('peak_year')}
                      baseline={<Val>{bPk ?? NO_VALUE}</Val>}
                      expert={<><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: REVIEWED_COLOR }}>{ePk != null ? Math.round(ePk) : NO_VALUE}</span>{ePk != null && bPk != null ? <DeltaChip value={ePk - bPk} unit="y" digits={0} /> : null}</>} />
                    <Decide cur={srcOf('peak', ePk != null)} onPick={(s) => setS('peak', s)} baselineOk={bPk != null} expertOk={ePk != null}
                      manual={<input type="number" min={2025} max={2035} value={man.peak ?? ''} onChange={(e) => setM('peak', e.target.value)} placeholder="year" style={{ ...manInput, width: 80 }} />}
                      result={resultOf('peak', ePk != null, resolved.peak ?? NO_VALUE, driver.peak_year || NO_VALUE)} />
                  </div>
                  <div>
                    <FieldLabel>Diffusion Curve</FieldLabel>
                    <CompareStack who={whoFor('diffusion_curve')}
                      baseline={<span className="inline-flex items-center gap-2">{bCv ? <DiffusionGlyph curve={bCv} color={S.onSurface} /> : null}<Val>{bCv ? curveLabel(bCv) : NO_VALUE}</Val></span>}
                      expert={<span className="inline-flex items-center gap-2">{eCv ? <DiffusionGlyph curve={eCv} color={REVIEWED_COLOR} /> : null}<span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: REVIEWED_COLOR }}>{eCv ? curveLabel(eCv) : NO_VALUE}</span>{eCv ? <DeltaChip value={eCv === bCv ? 0 : 1} digits={0} /> : null}</span>} />
                    <Decide cur={srcOf('curve', !!eCv)} onPick={(s) => setS('curve', s)} baselineOk={!!bCv} expertOk={!!eCv}
                      manual={<select value={man.curve ?? ''} onChange={(e) => setM('curve', e.target.value)} style={{ ...manInput, width: 'auto' }}><option value="">{NO_VALUE}</option>{Object.entries(DIFFUSION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>}
                      result={resultOf('curve', !!eCv, resolved.curve ? curveLabel(resolved.curve) : NO_VALUE,
                        driver.diffusion_curve ? curveLabel(driver.diffusion_curve) : NO_VALUE)} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Uncertainty" icon={Zap} footnote="0 = fixed · 3 = half or double · 5 = sign open. The expert scores are summarised by their median.">
                <CompareStack who={whoFor('uncertainty')}
                  baseline={<Val>{bU != null ? uncLabel(bU) : NO_VALUE}</Val>}
                  expert={<><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: REVIEWED_COLOR }}>{eU != null ? uncLabel(Math.round(eU)) : NO_VALUE}</span>{eU != null && bU != null ? <DeltaChip value={Math.round(eU) - bU} digits={0} /> : null}</>} />
                <Decide cur={srcOf('uncertainty', eU != null)} onPick={(s) => setS('uncertainty', s)} baselineOk={bU != null} expertOk={eU != null}
                  manual={<input type="number" min={0} max={5} value={man.uncertainty ?? ''} onChange={(e) => setM('uncertainty', e.target.value)} placeholder="0–5" style={manInput} />}
                  result={resultOf('uncertainty', eU != null, resolved.uncertainty != null ? uncLabel(resolved.uncertainty) : NO_VALUE,
                    driver.uncertainty != null ? uncLabel(driver.uncertainty) : NO_VALUE)} />
              </SectionCard>
            </div>

            {/* Right: the exposure grids, baseline over expert mean in every cell */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionCard title="Category Exposure" icon={Layers}>
                <div style={grpLabel}>HAIR</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(174px, 1fr))', gap: 10 }}>
                  {catCells.filter((c) => c.group === 'Hair').map((c) => exposureCell('category', c))}
                </div>
                <div style={{ ...grpLabel, marginTop: 14 }}>LAUNDRY &amp; HOME CARE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(174px, 1fr))', gap: 10 }}>
                  {catCells.filter((c) => c.group === 'LHC').map((c) => exposureCell('category', c))}
                </div>
                <Decide cur={srcOf('category', hasCatE)} onPick={(s) => setS('category', s)} baselineOk={!!baseCat} expertOk={hasCatE}
                  result={EXPOSURE_RESULT[srcOf('category', hasCatE)]} />
              </SectionCard>
              <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(174px, 1fr))', gap: 10 }}>
                  {regCells.map((c) => exposureCell('region', c))}
                </div>
                <Decide cur={srcOf('region', hasRegE)} onPick={(s) => setS('region', s)} baselineOk={!!baseReg} expertOk={hasRegE}
                  result={EXPOSURE_RESULT[srcOf('region', hasRegE)]} />
              </SectionCard>
              <SectionCard
                title="Value Chain Epicentre" icon={Cpu} accent={S.onTertiaryContainer} info={FIELD_HELP.vc}
                right={
                  <span title="Stages are categories: votes are counted, never averaged" style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, backgroundColor: S.amberContainer, color: S.onAmberContainer, whiteSpace: 'nowrap', cursor: 'help' }}>
                    {baseVcStage != null ? `Baseline ${VC_SHORT_LABELS[baseVcStage - 1]}` : `Baseline ${NO_VALUE}`}
                    {vcMajority != null ? ` · Majority ${VC_SHORT_LABELS[vcMajority.stage - 1]} ×${vcMajority.n}` : vcVotes.length > 0 ? ' · no majority' : ' · no votes'}
                  </span>
                }
              >
                <EpicentreVotePanel baseline={baseVcStage} current={currentVcStage} votes={vcVotes} majority={vcMajority}
                  endorsed={endorsedVcStage} onEndorse={setEndorsedVc} />
              </SectionCard>
            </div>
          </div>

          {/* Every expert's note from the Expert Rating tab: context for the
              review, never part of the endorsement. */}
          <div style={{ marginTop: 16 }}>
            <SectionCard
              title={`Expert Comments · ${comments.length}`}
              icon={MessageSquare}
              accent={EXPERT_COLOR}
              footnote="Free-text notes experts leave on the Expert Rating tab. They are context for the review and are not written into the driver on endorse."
            >
              {comments.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: S.mutedText }}>
                  <em>No comments left yet.</em>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comments.map((s) => (
                    <div key={s.user_id} style={{
                      padding: '10px 12px', borderRadius: 10,
                      backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                    }}>
                      <div style={{ fontFamily: HEADLINE_FONT, fontSize: 12.5, fontWeight: 800, color: S.onSurface, marginBottom: 5 }}>
                        {s.name}
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: S.onSurface, whiteSpace: 'pre-wrap' }}>
                        {s.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.mutedText }}>Set all to:</span>
              <button type="button" onClick={() => setAll('current')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: S.onSurfaceVariant }}>
                Keep current
              </button>
              <button type="button" onClick={() => setAll('expert')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: REVIEWED_COLOR }}>
                Experts ø
              </button>
              <button type="button" onClick={() => setAll('baseline')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: S.onSurface }}>
                Baseline
              </button>
              <button type="button" onClick={() => setAll('manual')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: S.primary }}>
                Manual
              </button>
            </div>
            <div className="flex items-center gap-3">
              {err && <span style={{ color: S.error, fontSize: 12 }}>{err}</span>}
              {done && !err && <span style={{ color: REVIEWED_COLOR, fontSize: 12, fontWeight: 700 }}>✓ Endorsed</span>}
              <button type="button" onClick={endorse} disabled={saving}
                style={{ padding: '9px 20px', borderRadius: 999, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.onSurface, color: '#fff', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Endorsing…' : done ? 'Endorse again' : 'Endorse driver →'}
              </button>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5" style={{ marginTop: 14, padding: '8px 14px', borderRadius: 10, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 12.5, lineHeight: 1.5 }}>
            <Check size={13} style={{ flexShrink: 0, color: REVIEWED_COLOR }} />
            <span>Endorsing writes the selected values into the driver (validated and audited). Shifts refresh after the next model run.</span>
          </div>
        </>
      )}
    </div>
  );
};
