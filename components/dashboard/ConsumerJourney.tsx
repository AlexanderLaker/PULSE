/**
 * The Consumer Journey: a qualitative overlay that maps the Profit Pool
 * Drivers to the moments of the Laundry and Hair consumer journeys.
 *
 * Every tile is authored content with visible provenance (revision month and
 * evidence grade). Its dialog shows the drivers behind the moment, resolved to
 * the live drivers and linked to the Drivers page, the net effect, the
 * Strategist Read (authored, not simulated) and the stage context. Nothing
 * here feeds or reads the Shift Matrix.
 *
 * The tiles come from data/consumerJourney.ts until an admin saves an edit;
 * from then on the newest saved version replaces them. The stage contexts
 * always come from the module.
 *
 * This view sits one tab away from computed output, so it has to read as
 * authored judgment, never as model output.
 */

'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight, Edit3, Info, CircleCheck, Plus, Save } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import useOverlay, { PaneActiveContext } from '@/hooks/useOverlay';
import { ApiError, getJourneyContent, saveJourneyContent } from '@/lib/apiClient';
import {
  LHC_JOURNEY, HAIR_JOURNEY, type JourneyContent, type JourneyKey, type JourneyTile, type TileType,
} from '@/data/consumerJourney';
import { S, SHADOW, EXPANSION_RGB, CONTRACTION_RGB, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import {
  type ContentOrigin, currentMonth, displayTileName, type SaveState, type SelectedTile,
  type Side, sortTilesForDisplay, stageSpan, type TileEdits, TYPE_STYLES,
} from './journey/shared';
import { JourneySwitch, StageRollup, TilePill, TypeChip } from './journey/tiles';
import { PanelBody } from './journey/PanelBody';

interface ConsumerJourneyProps {
  /** Opens the Drivers page searched for this driver name. */
  onNavigateToDriver?: (query: string) => void;
  /** Shows the editing controls; the save route checks the role again. */
  isAdmin?: boolean;
}

const ConsumerJourney: FC<ConsumerJourneyProps> = ({
  onNavigateToDriver,
  isAdmin = false,
}) => {
  const { drivers } = usePrism();

  const [tab, setTab] = useState<JourneyKey>('lhc');
  const [typeFilter, setTypeFilter] = useState<Set<TileType>>(() => new Set(['product', 'tech', 'service']));
  const [selected, setSelected] = useState<SelectedTile | null>(null);
  const [editing, setEditing] = useState(false);
  // The editing controls stay hidden until an admin turns them on.
  const [editMode, setEditMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // The bundled content, replaced by the newest saved version once it arrives.
  // `version` is the stored version the content on screen started from (0 for
  // the bundled copy); a save names it, so a save made by someone else in the
  // meantime is never overwritten unseen.
  const [content, setContent] = useState<JourneyContent>({ lhc: LHC_JOURNEY, hair: HAIR_JOURNEY });
  const [version, setVersion] = useState(0);
  const [origin, setOrigin] = useState<ContentOrigin>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getJourneyContent()
      .then((stored) => {
        if (cancelled) return;
        if (stored.content) setContent({ lhc: stored.content.lhc, hair: stored.content.hair });
        else setContent({ lhc: LHC_JOURNEY, hair: HAIR_JOURNEY });
        setVersion(stored.version);
        setOrigin(stored.content ? 'stored' : 'bundled');
      })
      .catch(() => { if (!cancelled) setOrigin('unavailable'); });
    return () => { cancelled = true; };
  }, [loadAttempt]);
  /** Load the stored content again, dropping unsaved edits (after a conflict or a failed load). */
  const loadStored = useCallback(() => {
    setSelected(null);
    setEditing(false);
    setSaveState('idle');
    setSaveMsg(null);
    setOrigin('loading');
    setLoadAttempt((n) => n + 1);
  }, []);

  const stages = content[tab];
  // Nothing is shown from the bundled copy while the saved journey loads: it
  // would flash, and a tile opened from it would stay the old text.
  const ready = origin !== 'loading';

  const driversLoaded = drivers.length > 0;
  const driversById = useMemo(() => new Map(drivers.map(d => [d.id, d])), [drivers]);

  const totals = useMemo(() => ({
    benefiting: stages.reduce((n, s) => n + s.benefiting.length, 0),
    declining: stages.reduce((n, s) => n + s.negativelyImpacted.length, 0),
  }), [stages]);

  const openTile = useCallback((tile: JourneyTile, stageId: string, stageLabel: string, side: Side) => {
    setSelected({ tile, stageId, stageLabel, side });
    setEditing(false);
  }, []);
  const closePanel = useCallback(() => { setSelected(null); setEditing(false); }, []);

  // The tile dialog shares the overlay behaviour: Escape closes it, focus stays
  // inside and returns to the tile, and the page behind does not scroll.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useOverlay(!!selected, closePanel, panelRef);

  // The visible tiles in rail order (stage by stage, tailwind before headwind,
  // filtered and sorted as rendered), so ◀ ▶ step through neighbours you can see.
  const flatTiles = useMemo<SelectedTile[]>(() => {
    const out: SelectedTile[] = [];
    for (const s of stages) {
      for (const side of ['benefiting', 'negativelyImpacted'] as const) {
        sortTilesForDisplay(s[side].filter(t => typeFilter.has(t.type)))
          .forEach(t => out.push({ tile: t, stageId: s.id, stageLabel: s.label, side }));
      }
    }
    return out;
  }, [stages, typeFilter]);
  const selectedIndex = useMemo(
    () => (selected ? flatTiles.findIndex(f => f.tile.id === selected.tile.id) : -1),
    [flatTiles, selected],
  );
  const stepSelection = useCallback((delta: number) => {
    if (selectedIndex < 0) return;
    const ni = selectedIndex + delta;
    if (ni < 0 || ni >= flatTiles.length) return;
    setSelected(flatTiles[ni]);
    setEditing(false);
  }, [selectedIndex, flatTiles]);

  // ← and → step to the neighbouring tiles while the dialog is open and its
  // pane is on screen, but not while a tile is being edited or the caret is in
  // a field, where the arrows move the caret.
  const paneActive = useContext(PaneActiveContext);
  useEffect(() => {
    if (!selected || editing || !paneActive) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.key === 'ArrowLeft') stepSelection(-1);
      else if (e.key === 'ArrowRight') stepSelection(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, editing, paneActive, stepSelection]);

  // ── Admin edits: local until "Save to server" ──
  const mutateTiles = useCallback((stageId: string, side: Side, update: (tiles: JourneyTile[]) => JourneyTile[]) => {
    setContent(prev => ({
      ...prev,
      [tab]: prev[tab].map(s => (s.id === stageId ? { ...s, [side]: update(s[side]) } : s)),
    }));
    setSaveState('idle');
    setSaveMsg(null);
  }, [tab]);

  const applyEdits = useCallback((sel: SelectedTile, edits: TileEdits) => {
    const updated: JourneyTile = {
      ...sel.tile,
      name: edits.name.trim() || sel.tile.name,
      intensity: edits.intensity,
      driverNote: edits.driverNote,
      driverCodes: edits.driverCodes,
      analysis: edits.analysis.trim() ? edits.analysis : sel.tile.analysis,
      provenance: { ...sel.tile.provenance, date: currentMonth() },   // an edit re-dates the tile
    };
    mutateTiles(sel.stageId, sel.side, tiles => tiles.map(t => (t.id === sel.tile.id ? updated : t)));
    setSelected({ ...sel, tile: updated });
    setEditing(false);
  }, [mutateTiles]);

  const removeTile = useCallback((sel: SelectedTile) => {
    mutateTiles(sel.stageId, sel.side, tiles => tiles.filter(t => t.id !== sel.tile.id));
    closePanel();
  }, [mutateTiles, closePanel]);

  const addTile = useCallback((stageId: string, side: Side) => {
    const slug = Math.random().toString(36).slice(2, 8);
    const tile: JourneyTile = {
      id: `${tab}.${stageId}.${side === 'benefiting' ? 'exp' : 'con'}.new-${slug}`,
      name: 'New tile',
      type: 'product',
      driverCodes: [],
      driverNote: '',
      intensity: 2,
      provenance: { date: currentMonth(), grade: 'estimate' },
      analysis: '',
    };
    mutateTiles(stageId, side, tiles => [...tiles, tile]);
    const stageLabel = stages.find(s => s.id === stageId)?.label ?? stageId;
    setSelected({ tile, stageId, stageLabel, side });
    setEditing(true);
  }, [mutateTiles, tab, stages]);

  /** Saves the whole tile map for every user; the route answers 403 unless the
   *  caller is an admin, and 409 when someone saved after this content loaded. */
  const saveToServer = useCallback(async () => {
    if (origin !== 'stored' && origin !== 'bundled') return;
    setSaveState('saving');
    setSaveMsg(null);
    try {
      const saved = await saveJourneyContent(content, version);
      setVersion(saved.version);
      setOrigin('stored');
      setSaveState('saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setSaveState('forbidden');
        setSaveMsg('Admin required: your account cannot save journey content.');
        return;
      }
      if (e instanceof ApiError && e.status === 409) {
        setSaveState('conflict');
        setSaveMsg('Someone else saved the journey after you opened it, so this save was refused. '
          + 'Load their version (your unsaved edits here are dropped) and make your changes again.');
        return;
      }
      const status = e instanceof ApiError && e.status > 0 ? ` (${e.status})` : '';
      setSaveState('error');
      setSaveMsg(`Save failed${status}. ${(e as Error).message.slice(0, 160)}`);
    }
  }, [content, version, origin]);
  const canSave = origin === 'stored' || origin === 'bundled';

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main className="max-w-[1440px] mx-auto px-8 py-10">

        {/* ─── Header ─── */}
        <header className="mb-5 flex items-start justify-between gap-8 flex-wrap">
          <div className="pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
              Consumer Journey
            </div>
            <h1 className="font-extrabold tracking-tight" style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2.4rem', lineHeight: 1.1 }}>
              Where Profit Pools Shift Along the Journey
            </h1>
            <p className="mt-2 max-w-2xl text-[15px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
              Profit Pool Drivers mapped to consumer moments, tile by tile. Each tile is an authored
              strategist read with visible provenance; click any tile for its evidence and analysis.
            </p>
          </div>
        </header>

        {/* ─── Scope banner, always visible ─── */}
        <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}` }}>
          <Info size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant, flexShrink: 0, marginTop: 2 }} />
          <p className="text-[12.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, margin: 0 }}>
            <strong style={{ fontFamily: HEADLINE_FONT }}>Qualitative overlay mapping drivers to consumer moments. Authored content does not feed the Shift Matrix.</strong>
          </p>
        </div>

        {origin === 'unavailable' && (
          <div role="status" className="mb-5 flex items-center justify-between gap-3 flex-wrap rounded-xl px-4 py-3"
            style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer }}>
            <p className="text-[12.5px]" style={{ lineHeight: 1.55, margin: 0 }}>
              The saved journey could not be loaded, so these are the texts shipped with PRISM; an admin may
              have changed them since.
            </p>
            <button type="button" onClick={loadStored} className="px-3 py-1.5 rounded-full text-[12px] font-bold"
              style={{ backgroundColor: S.surface, color: S.primary, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}>
              Try again
            </button>
          </div>
        )}

        {/* ─── Tabs and filters ─── */}
        <section className="mb-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <JourneySwitch label="Laundry" active={tab === 'lhc'} onClick={() => { setTab('lhc'); closePanel(); }} />
            <JourneySwitch label="Hair" active={tab === 'hair'} onClick={() => { setTab('hair'); closePanel(); }} />
            {isAdmin && (
              <button type="button"
                onClick={() => { if (editMode) setEditing(false); setEditMode(v => !v); }}
                // Editing starts once the saved journey is known: an edit made on
                // the bundled copy while it loads would be replaced when it arrives.
                disabled={!editMode && origin === 'loading'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200"
                style={{
                  backgroundColor: editMode ? S.primaryContainer : S.surfaceLow,
                  color: editMode ? S.onPrimaryContainer : S.onSurfaceVariant,
                  border: 'none', cursor: !editMode && origin === 'loading' ? 'wait' : 'pointer', fontFamily: HEADLINE_FONT,
                }}
                aria-pressed={editMode}
                title={editMode
                  ? 'Editing is on: click to hide the add / edit / save controls'
                  : origin === 'loading'
                    ? 'Loading the saved journey…'
                    : 'Show the editing controls (add tiles, edit tiles, save to server)'}
              >
                <Edit3 size={11} strokeWidth={2.5} /> Edit board
              </button>
            )}
            {tab === 'lhc' && (
              <span className="text-[11px]" style={{ color: S.mutedText, fontStyle: 'italic', fontFamily: BODY_FONT }}>
                Laundry only: the Home Care (dish / surface / WC) journey is not built yet.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {ready && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.expansion, fontFamily: HEADLINE_FONT }}>
                  <TrendingUp size={12} strokeWidth={2.5} /> Tailwind {totals.benefiting}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: S.error, fontFamily: HEADLINE_FONT }}>
                  <TrendingDown size={12} strokeWidth={2.5} /> Headwind {totals.declining}
                </span>
              </div>
            )}
            <div className="h-5 w-px" style={{ backgroundColor: S.cardBorder }} aria-hidden="true" />
            <div className="flex gap-1.5">
              {(Object.keys(TYPE_STYLES) as TileType[]).map(key => (
                <TypeChip
                  key={key}
                  typeKey={key}
                  active={typeFilter.has(key)}
                  onClick={() => setTypeFilter(prev => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  })}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─── Stage rail ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: S.surface, boxShadow: SHADOW.card }}
        >
          {!ready ? (
            <div role="status" className="px-8 py-16 text-center text-[13px]"
              style={{ color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
              Loading the saved journey…
            </div>
          ) : (
          <div>
            <div
              className="grid"
              style={{
                // Every stage fits the width: minmax(0, 1fr) lets the columns
                // shrink equally. A wide stage takes two units, so the unit
                // count is the number of stages plus the wide ones; the header,
                // tailwind and headwind rows each add up to that count, which
                // keeps the three rows aligned.
                gridTemplateColumns: `repeat(${stages.reduce((n, s) => n + stageSpan(s, tab), 0)}, minmax(0, 1fr))`,
                width: '100%', gap: 0,
              }}
            >
              {/* Stage headers with the tailwind / headwind rollup */}
              {stages.map((stage, i) => (
                <div
                  key={stage.id + '_h'}
                  style={{
                    gridColumn: stageSpan(stage, tab) === 2 ? 'span 2' : undefined,
                    padding: '10px 9px 9px', backgroundColor: S.surfaceLow,
                    borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                    borderBottom: `1px solid ${S.cardBorder}`,
                    // A flex column pins the rollup to the bottom of the cell
                    // (the grid gives every header the same height), so the
                    // bars line up whether a title takes one line or two.
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: S.onSurfaceVariant, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                    Stage {i + 1}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.onSurface, marginTop: 3, lineHeight: 1.25, fontFamily: HEADLINE_FONT, letterSpacing: '-0.01em' }}>
                    {stage.label}
                  </div>
                  {/* marginTop auto pushes the rollup to the bottom edge; the padding keeps it clear of a two-line title. */}
                  <div style={{ marginTop: 'auto', paddingTop: 7 }}>
                    <StageRollup
                      benefiting={stage.benefiting.filter(t => typeFilter.has(t.type))}
                      negativelyImpacted={stage.negativelyImpacted.filter(t => typeFilter.has(t.type))}
                    />
                  </div>
                </div>
              ))}

              {/* Tailwind row */}
              {stages.map((stage, i) => {
                const tiles = sortTilesForDisplay(stage.benefiting.filter(t => typeFilter.has(t.type)));
                return (
                  <div
                    key={stage.id + '_b'}
                    style={{
                      gridColumn: stageSpan(stage, tab) === 2 ? 'span 2' : undefined,
                      backgroundColor: `rgba(${EXPANSION_RGB},0.04)`, padding: '7px 6px',
                      borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                      borderBottom: `1px solid ${S.cardBorder}`, minHeight: 56,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: S.expansion, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        <TrendingUp size={10} strokeWidth={2.5} /> Tailwind
                      </span>
                      {isAdmin && editMode && (
                        <button type="button"
                          onClick={() => addTile(stage.id, 'benefiting')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.expansion, padding: 0, display: 'inline-flex' }}
                          title="Add benefiting tile"
                          aria-label="Add benefiting tile"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                    {tiles.map(tile => (
                      <TilePill
                        key={tile.id}
                        tile={tile}
                        side="benefiting"
                        selected={selected?.tile.id === tile.id}
                        onClick={() => openTile(tile, stage.id, stage.label, 'benefiting')}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Headwind row */}
              {stages.map((stage, i) => {
                const tiles = sortTilesForDisplay(stage.negativelyImpacted.filter(t => typeFilter.has(t.type)));
                return (
                  <div
                    key={stage.id + '_n'}
                    style={{
                      gridColumn: stageSpan(stage, tab) === 2 ? 'span 2' : undefined,
                      backgroundColor: `rgba(${CONTRACTION_RGB},0.04)`, padding: '7px 6px',
                      borderRight: i < stages.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                      minHeight: 56,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, color: S.error, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        <TrendingDown size={10} strokeWidth={2.5} /> Headwind
                      </span>
                      {isAdmin && editMode && (
                        <button type="button"
                          onClick={() => addTile(stage.id, 'negativelyImpacted')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.error, padding: 0, display: 'inline-flex' }}
                          title="Add declining tile"
                          aria-label="Add declining tile"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                    {tiles.map(tile => (
                      <TilePill
                        key={tile.id}
                        tile={tile}
                        side="negativelyImpacted"
                        selected={selected?.tile.id === tile.id}
                        onClick={() => openTile(tile, stage.id, stage.label, 'negativelyImpacted')}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Flow indicator */}
          <div className="px-8 py-3.5 flex items-center gap-3" style={{ borderTop: `1px solid ${S.cardBorder}` }}>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
              Consumer flow
            </span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${S.primary}, ${S.outline})` }} />
            <ArrowRight size={14} strokeWidth={2.5} style={{ color: S.outline }} />
          </div>
        </motion.div>

        {/* ─── Admin save bar, shown in edit mode ─── */}
        {isAdmin && editMode && (
          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap rounded-2xl px-5 py-3.5" style={{ backgroundColor: S.surface, boxShadow: SHADOW.card }}>
            <div className="flex items-center gap-2">
              <Edit3 size={14} strokeWidth={2.5} style={{ color: S.onSurfaceVariant }} />
              <span className="text-[12px]" style={{ color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
                Editing on: tile edits update this view. <strong style={{ fontFamily: HEADLINE_FONT }}>Save to server</strong> saves the journey content for all users.
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!canSave && (
                <span className="text-[11.5px] font-bold" style={{ color: origin === 'unavailable' ? S.error : S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                  {origin === 'loading'
                    ? 'Loading the saved journey…'
                    : 'The saved journey could not be loaded; saving is off so it cannot be overwritten.'}
                </span>
              )}
              {saveMsg && (
                <span className="text-[11.5px] font-bold" style={{ color: saveState === 'error' || saveState === 'forbidden' || saveState === 'conflict' ? S.error : S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                  {saveMsg}
                </span>
              )}
              {(saveState === 'conflict' || origin === 'unavailable') && (
                <button type="button" onClick={loadStored} className="px-3 py-1.5 rounded-full text-[12px] font-bold"
                  style={{ backgroundColor: S.surfaceLow, color: S.primary, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}>
                  {origin === 'unavailable' ? 'Try again' : 'Load the saved version'}
                </button>
              )}
              {saveState === 'saved' && !saveMsg && (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: S.expansion, fontFamily: HEADLINE_FONT }}>
                  <CircleCheck size={13} strokeWidth={2.5} /> Saved
                </span>
              )}
              <button type="button"
                onClick={saveToServer}
                disabled={saveState === 'saving' || !canSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold"
                style={{
                  backgroundColor: saveState === 'saving' || !canSave ? S.surfaceHigh : S.primary,
                  color: saveState === 'saving' || !canSave ? S.onSurfaceVariant : S.onPrimary,
                  border: 'none', cursor: saveState === 'saving' || !canSave ? 'default' : 'pointer', fontFamily: HEADLINE_FONT,
                }}
              >
                <Save size={13} strokeWidth={2.5} />
                {saveState === 'saving' ? 'Saving…' : 'Save to server'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════
          Detail dialog: Why-chain, Strategist Read and stage context
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="cj-scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, backgroundColor: S.scrim, backdropFilter: 'blur(2px)', zIndex: 40 }}
            />
            <motion.div
              key="cj-dialog"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={closePanel}
              style={{
                position: 'fixed', inset: 0, zIndex: 50, overflowY: 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px',
              }}
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                aria-label={`${displayTileName(selected.tile.name)}: detail`}
                onClick={e => e.stopPropagation()}
                style={{
                  width: 'min(1120px, 100%)', margin: 'auto', maxHeight: '92vh',
                  display: 'flex', flexDirection: 'column',
                  backgroundColor: S.bg, borderRadius: 20,
                  boxShadow: SHADOW.dialog,
                  overflow: 'hidden',
                }}
              >
                <PanelBody
                  selected={selected}
                  journeyKey={tab}
                  driversById={driversById}
                  driversLoaded={driversLoaded}
                  canEdit={isAdmin && editMode}
                  editing={editing}
                  position={selectedIndex >= 0 ? { index: selectedIndex, total: flatTiles.length } : null}
                  onPrev={() => stepSelection(-1)}
                  onNext={() => stepSelection(1)}
                  onClose={closePanel}
                  onEdit={() => setEditing(true)}
                  onCancelEdit={() => setEditing(false)}
                  onApplyEdits={edits => applyEdits(selected, edits)}
                  onRemove={() => removeTile(selected)}
                  onNavigateToDriver={onNavigateToDriver}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConsumerJourney;
