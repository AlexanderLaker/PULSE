/**
 * WhiteSpotAnalyzer.tsx — White Spot Analyzer (Beta, isolated)
 *
 * Blueprint Workstream 2 (CONSUMER_JOURNEY_BLUEPRINT.md): overlays Henkel's
 * journey-stage footprint against modelled profit migration to surface
 * stages where profit flows in but Henkel is absent.
 *
 * DELIBERATELY SELF-CONTAINED so it can be removed without trace:
 *   • No changes to ConsumerJourney2, no backend, no new tables/endpoints.
 *   • Reads stage labels + opportunity texts from data/consumerJourney.ts
 *     (read-only import) and journey_decomposition from usePrism().
 *   • Henkel presence: seeded from the March 2026 blueprint footprint
 *     (laundry) and AI-suggested values (hair); user adjustments are stored
 *     in localStorage ONLY (per-browser, clearly labelled, resettable).
 *   • Own copy of the maritime style tokens — zero shared-module coupling.
 *
 * To delete: remove this file + the 'white-spot-analyzer' tab wiring in
 * app/dashboard/page.tsx (type union, TABS entry, import, render line).
 *
 * Method: white_spot_score = max(migration, 0) × (1 − presence/5)
 *   migration  = Σ over group categories of
 *                journey_decomposition[cat][`${tab}:${stageId}`]
 *                (terminal-year MC-median attribution, in pp — COMPUTED;
 *                 stage keys are namespaced "<journey>:<stage_id>" by the
 *                 engine — same parse as ConsumerJourney2's attribution)
 *   presence   = 0–5 judgment (blueprint / AI-suggested / user-adjusted)
 * Quadrants: presence ≥ 2.5 & migration ≥ 0 → defend & extend;
 *            presence ≥ 2.5 & migration < 0 → manage decline;
 *            presence < 2.5 & migration < 0 → watch;
 *            presence < 2.5 & migration ≥ 0 → WHITE SPOT.
 */

'use client';

import React, { useState, useMemo, useEffect, FC } from 'react';
import {
  TrendingUp, Info, RotateCcw, Eye, EyeOff, Target,
} from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import type { SimulationResult } from '@/types/simulation';
import { LHC_JOURNEY, HAIR_JOURNEY, LHC_CTX, HAIR_CTX } from '@/data/consumerJourney';

// ── Local style tokens (intentional copy — keeps this view deletable) ──
const S = {
  bg: '#f8f9ff', surface: '#ffffff', surfaceLow: '#eff4ff',
  surfaceContainer: '#e5eeff', surfaceHigh: '#dce9ff',
  primary: '#005db5', primaryDim: '#0052a0', primaryContainer: '#d6e3ff',
  onPrimaryContainer: '#00519e', onBg: '#00345e', onSurface: '#00345e',
  onSurfaceVariant: '#26619d',
  expansionContainer: '#d6ecdb', onExpansionContainer: '#1e5f2e', expansion: '#2d7d3f',
  error: '#9f403d', errorContainer: '#fee3e1', onErrorContainer: '#752121',
  amberContainer: '#fdf0d5', onAmberContainer: '#7a5200',
  cardBorder: 'rgba(0, 52, 94, 0.10)', mutedText: '#64748B',
};
const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ── Footprint seeds ────────────────────────────────────────────────
interface StageFootprint {
  presence: number; // 0-5
  brands: string;
  tier: 'core' | 'emerging' | 'none';
}

/** Laundry presence — from CONSUMER_JOURNEY_BLUEPRINT.md (March 2026). */
const LAUNDRY_FOOTPRINT: Record<string, StageFootprint> = {
  sorting:         { presence: 0, brands: '—',                              tier: 'none' },
  pre_treating:    { presence: 4, brands: 'Sil, Persil pre-treat',          tier: 'core' },
  loading:         { presence: 0, brands: '—',                              tier: 'none' },
  add_products:    { presence: 5, brands: 'Persil, Vernel, Weißer Riese, Spee, all, Purex', tier: 'core' },
  select_wash:     { presence: 1, brands: 'Persil (dosing cap / Smartwash)', tier: 'emerging' },
  washing_cycle:   { presence: 0, brands: '—',                              tier: 'none' },
  unloading:       { presence: 1, brands: 'Vernel',                         tier: 'emerging' },
  drying:          { presence: 1, brands: 'Vernel / Snuggle (US)',          tier: 'emerging' },
  ironing:         { presence: 1, brands: 'Vernel',                         tier: 'emerging' },
  folding_storing: { presence: 2, brands: 'Bref (moth)',                    tier: 'emerging' },
  taking_out:      { presence: 0, brands: '—',                              tier: 'none' },
  wearing:         { presence: 0, brands: '—',                              tier: 'none' },
  between_washes:  { presence: 0, brands: '—',                              tier: 'none' },
};

/** Hair presence — AI-suggested (2026-06), pending strategist review. */
const HAIR_FOOTPRINT: Record<string, StageFootprint> = {
  inspire:           { presence: 2, brands: 'got2b (social), Schwarzkopf content', tier: 'emerging' },
  diagnose:          { presence: 1, brands: 'Schwarzkopf Pro (salon consult)',     tier: 'emerging' },
  prepare:           { presence: 4, brands: 'Schwarzkopf, Gliss, Syoss',           tier: 'core' },
  remedy:            { presence: 3, brands: 'Gliss treatments, Schwarzkopf Pro',   tier: 'core' },
  transform:         { presence: 5, brands: 'Palette, Brillance, Igora, Live',     tier: 'core' },
  lock_finish:       { presence: 4, brands: 'Taft, got2b',                         tier: 'core' },
  maintain_optimize: { presence: 2, brands: 'Gliss leave-in range',                tier: 'emerging' },
  refresh_between:   { presence: 3, brands: 'got2b dry shampoo',                   tier: 'emerging' },
};

/** Illustrative migration values for the preview mode (clearly labelled —
 *  replaced by real journey_decomposition once a run carries it). */
const MOCK_MIGRATION: Record<'lhc' | 'hair', Record<string, number>> = {
  lhc: {
    sorting: 0.3, pre_treating: -0.8, loading: 0.1, add_products: -2.6,
    select_wash: 0.9, washing_cycle: 0.5, unloading: 0.2, drying: 0.4,
    ironing: -0.3, folding_storing: 0.2, taking_out: 0.1, wearing: 0.4,
    between_washes: 1.2,
  },
  hair: {
    inspire: 0.5, diagnose: 0.8, prepare: -0.6, remedy: 1.0,
    transform: -1.4, lock_finish: -0.5, maintain_optimize: 0.4,
    refresh_between: 0.9,
  },
};

const LS_KEY = 'prism_whitespot_footprint_v1';

type Quadrant = 'white_spot' | 'defend' | 'manage' | 'watch';

const QUADRANT_META: Record<Quadrant, { label: string; bg: string; fg: string }> = {
  white_spot: { label: 'White spot — act',   bg: '#FAECE7', fg: '#993C1D' },
  defend:     { label: 'Defend & extend',    bg: '#d6ecdb', fg: '#1e5f2e' },
  manage:     { label: 'Manage decline',     bg: '#fdf0d5', fg: '#7a5200' },
  watch:      { label: 'Watch',              bg: '#eff4ff', fg: '#26619d' },
};

function quadrantOf(presence: number, migration: number): Quadrant {
  if (presence >= 2.5) return migration >= 0 ? 'defend' : 'manage';
  return migration >= 0 ? 'white_spot' : 'watch';
}

const fmtPp = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}pp`;

// ═══════════════════════════════════════════════════════════════════
const WhiteSpotAnalyzer: FC = () => {
  const { simulation } = usePrism();
  const [tab, setTab] = useState<'lhc' | 'hair'>('lhc');
  const [preview, setPreview] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // Local presence adjustments (per-browser only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) setOverrides(JSON.parse(raw) as Record<string, number>);
    } catch { /* ignore */ }
  }, []);
  const setPresence = (key: string, v: number) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: v };
      try { window.localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const resetOverrides = () => {
    setOverrides({});
    try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  };

  const stages = tab === 'lhc' ? LHC_JOURNEY : HAIR_JOURNEY;
  const ctx = tab === 'lhc' ? LHC_CTX : HAIR_CTX;
  const seed = tab === 'lhc' ? LAUNDRY_FOOTPRINT : HAIR_FOOTPRINT;

  // ── Modelled migration: real run data, else optional labelled preview ──
  // journey_decomposition stage keys are namespaced "<journey>:<stage_id>"
  // (e.g. "lhc:add_products") — strip the namespace so lookups by bare
  // stage id work. Mirrors ConsumerJourney2's stage-attribution parse.
  const realMigration = useMemo(() => {
    const decomp = (simulation as SimulationResult | null)?.journey_decomposition;
    if (!decomp) return null;
    const prefix = tab === 'lhc' ? 'LHC' : 'Hair';
    const nsPrefix = `${tab}:`;
    const sums: Record<string, number> = {};
    let any = false;
    for (const [cat, stageMap] of Object.entries(decomp)) {
      if (!cat.startsWith(prefix)) continue;
      for (const [stageKey, v] of Object.entries(stageMap)) {
        if (!stageKey.startsWith(nsPrefix)) continue;
        const sid = stageKey.slice(nsPrefix.length);
        sums[sid] = (sums[sid] ?? 0) + (typeof v === 'number' ? v : 0);
        any = true;
      }
    }
    return any ? sums : null;
  }, [simulation, tab]);

  const migration = realMigration ?? (preview ? MOCK_MIGRATION[tab] : null);
  const dataMode: 'live' | 'preview' | 'none' = realMigration ? 'live' : preview ? 'preview' : 'none';

  // ── Rows ──
  const rows = useMemo(() => stages.map(s => {
    const key = `${tab}:${s.id}`;
    const fp = seed[s.id] ?? { presence: 0, brands: '—', tier: 'none' as const };
    const presence = overrides[key] ?? fp.presence;
    const mig = migration ? (migration[s.id] ?? 0) : null;
    const score = mig !== null ? Math.max(mig, 0) * (1 - presence / 5) : null;
    const quadrant = mig !== null ? quadrantOf(presence, mig) : null;
    return { id: s.id, key, label: s.label, brands: fp.brands, presence, mig, score, quadrant };
  }), [stages, seed, overrides, migration, tab]);

  const ranked = useMemo(
    () => rows.filter(r => r.score !== null && r.score > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    [rows],
  );

  // ── Scatter geometry ──
  const W = 860, H = 380, PAD_L = 64, PAD_R = 28, PAD_T = 30, PAD_B = 48;
  const migs = rows.map(r => r.mig ?? 0);
  const xMax = Math.max(0.5, ...migs.map(m => Math.abs(m))) * 1.15;
  const xPos = (m: number) => PAD_L + ((m + xMax) / (2 * xMax)) * (W - PAD_L - PAD_R);
  const yPos = (p: number) => H - PAD_B - (p / 5) * (H - PAD_T - PAD_B);

  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main className="max-w-[1280px] mx-auto px-8 py-10">

        {/* Header */}
        <header className="mb-4 pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Consumer Journey · White Spot Analyzer · Beta
          </div>
          <h1 className="font-extrabold tracking-tight"
            style={{ fontFamily: HEADLINE_FONT, fontSize: '2.2rem', lineHeight: 1.1 }}>
            Where Profit Migrates and Henkel Is Absent
          </h1>
          <p className="mt-2 max-w-2xl text-[15px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
            Modelled stage migration (simulation) × Henkel presence (judgment) →
            ranked white spots. score = migration⁺ × (1 − presence/5).
          </p>
        </header>

        {/* Beta / provenance banner */}
        <div className="mb-6 flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
          <Info size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant, flexShrink: 0, marginTop: 2 }} />
          <p className="text-[12.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, margin: 0 }}>
            <strong style={{ fontFamily: HEADLINE_FONT }}>Beta — removable view.</strong>{' '}
            Migration values are <strong>computed</strong> by the simulation (journey_decomposition,
            terminal-year). Presence scores are <strong>judgment</strong> — Laundry seeded from the March 2026
            blueprint footprint, Hair AI-suggested (Jun 2026); your adjustments below are saved in
            <strong> this browser only</strong>, not shared. Quadrant placement changes with either input.
          </p>
        </div>

        {/* Controls */}
        <section className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2">
            {(['lhc', 'hair'] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className="px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200"
                style={{
                  backgroundColor: tab === k ? S.primary : S.surfaceLow,
                  color: tab === k ? '#fff' : S.onSurfaceVariant,
                  border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
                }}>
                {k === 'lhc' ? 'Laundry' : 'Hair'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: dataMode === 'live' ? S.expansionContainer : dataMode === 'preview' ? S.amberContainer : S.surfaceLow,
                color: dataMode === 'live' ? S.onExpansionContainer : dataMode === 'preview' ? S.onAmberContainer : S.mutedText,
                fontFamily: HEADLINE_FONT,
              }}>
              <Target size={11} strokeWidth={2.5} />
              {dataMode === 'live' ? 'Live simulation data' : dataMode === 'preview' ? 'Illustrative preview — not model output' : 'No run data yet'}
            </span>
            {!realMigration && (
              <button onClick={() => setPreview(p => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                style={{ backgroundColor: S.surfaceContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}>
                {preview ? <EyeOff size={11} strokeWidth={2.5} /> : <Eye size={11} strokeWidth={2.5} />}
                {preview ? 'Hide illustrative preview' : 'Show illustrative preview'}
              </button>
            )}
            <button onClick={resetOverrides}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}>
              <RotateCcw size={11} strokeWidth={2.5} />
              Reset presence to defaults
            </button>
          </div>
        </section>

        {/* Footprint strip with presence editors */}
        <section className="rounded-2xl mb-6 p-5"
          style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)' }}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] pl-2.5 mb-3"
            style={{ color: S.onSurfaceVariant, borderLeft: `3px solid ${S.primary}`, fontFamily: HEADLINE_FONT }}>
            Henkel footprint by stage — presence 0–5 (adjustable, local)
          </h3>
          <div className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(150px, 1fr))` }}>
            {rows.map(r => {
              const tone = r.presence >= 4
                ? { bg: '#d6e3ff', fg: '#00519e' }
                : r.presence >= 1
                  ? { bg: '#eff4ff', fg: '#26619d' }
                  : { bg: '#fee3e1', fg: '#752121' };
              return (
                <div key={r.key} className="rounded-lg p-2.5" style={{ backgroundColor: tone.bg }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: tone.fg, fontFamily: HEADLINE_FONT, lineHeight: 1.25 }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: tone.fg, opacity: 0.85, margin: '3px 0 6px', lineHeight: 1.35, minHeight: 26 }}>
                    {r.brands}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={r.presence}
                      onChange={e => setPresence(r.key, parseInt(e.target.value, 10))}
                      aria-label={`Henkel presence at ${r.label}`}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 4px', borderRadius: 6,
                        border: `1px solid ${S.cardBorder}`, backgroundColor: '#fff', color: S.onSurface,
                      }}>
                      {[0, 1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    {r.mig !== null && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, fontFamily: HEADLINE_FONT,
                        color: r.mig >= 0 ? S.expansion : S.error,
                      }}>
                        {fmtPp(r.mig)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quadrant scatter */}
        <section className="rounded-2xl mb-6 p-5"
          style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)' }}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] pl-2.5 mb-3"
            style={{ color: S.onSurfaceVariant, borderLeft: `3px solid ${S.primary}`, fontFamily: HEADLINE_FONT }}>
            Presence × profit migration — quadrant map
          </h3>
          {migration ? (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
              aria-label="Scatter of journey stages: Henkel presence versus modelled profit migration">
              <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke={S.cardBorder} />
              <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={S.cardBorder} />
              <line x1={xPos(0)} y1={PAD_T} x2={xPos(0)} y2={H - PAD_B} stroke={S.cardBorder} strokeDasharray="4 4" />
              <line x1={PAD_L} y1={yPos(2.5)} x2={W - PAD_R} y2={yPos(2.5)} stroke={S.cardBorder} strokeDasharray="4 4" />
              <text x={PAD_L + 8} y={PAD_T + 14} fontSize="11" fill="#7a5200" fontFamily={HEADLINE_FONT} fontWeight={700}>MANAGE DECLINE</text>
              <text x={W - PAD_R - 8} y={PAD_T + 14} fontSize="11" fill="#1e5f2e" textAnchor="end" fontFamily={HEADLINE_FONT} fontWeight={700}>DEFEND &amp; EXTEND</text>
              <text x={PAD_L + 8} y={H - PAD_B - 8} fontSize="11" fill="#26619d" fontFamily={HEADLINE_FONT} fontWeight={700}>WATCH</text>
              <text x={W - PAD_R - 8} y={H - PAD_B - 8} fontSize="11" fill="#993C1D" textAnchor="end" fontFamily={HEADLINE_FONT} fontWeight={700}>WHITE SPOT — ACT</text>
              <text x={(PAD_L + W - PAD_R) / 2} y={H - 12} fontSize="11.5" fill={S.mutedText} textAnchor="middle" fontFamily={BODY_FONT}>
                modelled profit migration into stage (pp, terminal year{dataMode === 'preview' ? ' — ILLUSTRATIVE PREVIEW' : ''})
              </text>
              <text x={18} y={(PAD_T + H - PAD_B) / 2} fontSize="11.5" fill={S.mutedText} textAnchor="middle"
                transform={`rotate(-90 18 ${(PAD_T + H - PAD_B) / 2})`} fontFamily={BODY_FONT}>
                Henkel presence (0–5)
              </text>
              {[-1, 0, 1].map(t => {
                const v = t * Math.round(xMax * 0.8 * 10) / 10;
                return (
                  <text key={t} x={xPos(v)} y={H - PAD_B + 16} fontSize="10" fill={S.mutedText} textAnchor="middle" fontFamily={BODY_FONT}>
                    {v > 0 ? '+' : ''}{v.toFixed(1)}
                  </text>
                );
              })}
              {[0, 1, 2, 3, 4, 5].map(p => (
                <text key={p} x={PAD_L - 10} y={yPos(p) + 3.5} fontSize="10" fill={S.mutedText} textAnchor="end" fontFamily={BODY_FONT}>{p}</text>
              ))}
              {rows.map(r => {
                if (r.mig === null || !r.quadrant) return null;
                const meta = QUADRANT_META[r.quadrant];
                const x = xPos(r.mig), y = yPos(r.presence);
                const anchorEnd = x > W - 180;
                return (
                  <g key={r.key}>
                    <circle cx={x} cy={y} r={7} fill={meta.fg} fillOpacity={0.85}>
                      <title>{`${r.label} — presence ${r.presence}, migration ${fmtPp(r.mig)}${r.score !== null ? `, white-spot score ${r.score.toFixed(2)}` : ''}`}</title>
                    </circle>
                    <text x={x + (anchorEnd ? -11 : 11)} y={y + 4} fontSize="11" fill={S.onSurfaceVariant}
                      textAnchor={anchorEnd ? 'end' : 'start'} fontFamily={BODY_FONT}>
                      {r.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <p style={{ fontSize: 12.5, color: S.mutedText, margin: 0, lineHeight: 1.6 }}>
              No simulation run with journey attribution has been published yet. Once
              <span style={{ fontFamily: 'monospace' }}> journey_decomposition</span> is in the latest run,
              this chart populates with computed values — or use the illustrative preview toggle above to see
              the mechanics with clearly-labelled mock numbers.
            </p>
          )}
        </section>

        {/* Ranked white spots */}
        <section className="rounded-2xl p-5"
          style={{ backgroundColor: S.surface, boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)' }}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] pl-2.5 mb-3"
            style={{ color: S.onSurfaceVariant, borderLeft: `3px solid ${S.primary}`, fontFamily: HEADLINE_FONT }}>
            Ranked opportunity list — white-spot score
          </h3>
          {ranked.length === 0 ? (
            <p style={{ fontSize: 12.5, color: S.mutedText, margin: 0 }}>
              Available once migration data is present (live run or preview).
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ranked.map((r, i) => {
                const meta = r.quadrant ? QUADRANT_META[r.quadrant] : QUADRANT_META.watch;
                const opportunity = ctx[r.label]?.opportunity ?? '';
                return (
                  <div key={r.key} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ backgroundColor: S.surfaceLow }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 999, flexShrink: 0,
                      backgroundColor: meta.bg, color: meta.fg,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, fontFamily: HEADLINE_FONT, marginTop: 1,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontSize: 13.5, fontWeight: 700, fontFamily: HEADLINE_FONT }}>{r.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-[0.06em]"
                          style={{ backgroundColor: meta.bg, color: meta.fg, fontFamily: HEADLINE_FONT }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 11, color: S.mutedText }}>
                          migration {r.mig !== null ? fmtPp(r.mig) : '—'} · presence {r.presence}/5 · score {r.score?.toFixed(2)}
                        </span>
                      </div>
                      {opportunity && (
                        <p style={{ fontSize: 12, color: S.onSurfaceVariant, lineHeight: 1.55, margin: '4px 0 0' }}>
                          {opportunity}
                        </p>
                      )}
                    </div>
                    <TrendingUp size={14} strokeWidth={2.5} style={{ color: meta.fg, flexShrink: 0, marginTop: 4 }} />
                  </div>
                );
              })}
            </div>
          )}
          <p style={{ fontSize: 10.5, color: S.mutedText, margin: '10px 0 0', fontStyle: 'italic' }}>
            Opportunity texts are the authored stage contexts from the Consumer Journey layer (same provenance
            rules apply). Scores are mechanical — they rank, they don&apos;t decide.
          </p>
        </section>

      </main>
    </div>
  );
};

export default WhiteSpotAnalyzer;
