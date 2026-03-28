/**
 * SessionSnapshots — Persistent session history & state management panel
 *
 * Save/load/compare snapshots of simulation state (shifts, trends, scenario).
 * All snapshots are persisted to the backend SQLite database — permanent audit trail.
 * No auto-deletion, no localStorage. Weekly timestamp history by design.
 *
 * Slide-in right panel (460px wide, z-index 201) with Framer Motion animation.
 *
 * Props: { currentShifts, currentTrends, onClose, onRestoreSnapshot, currentScenario }
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, RotateCcw, TrendingUp, TrendingDown, Copy, Loader, Clock } from 'lucide-react';
import { T, fmtShift } from '../lib/format';
import type { ShiftMatrix, Trend } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Snapshot {
  id: string;
  name: string;
  createdAt: string; // ISO date
  scenario: string;
  shifts: ShiftMatrix;
  trends: Trend[];
  trendCount: number;
  netShift: number; // average 2030 median across categories
  notes?: string;
}

/** Shape returned by GET /api/v1/snapshots */
interface APISnapshot {
  id: number;
  name: string;
  created_at: string;
  scenario: string;
  shifts: ShiftMatrix;
  trends: Trend[];
  trend_count: number;
  net_shift: number;
  notes: string | null;
  created_by: string | null;
  model_version: string | null;
  iterations: number | null;
}

interface SessionSnapshotsProps {
  currentShifts: ShiftMatrix | null;
  currentTrends: Trend[];
  onClose: () => void;
  onRestoreSnapshot?: (snapshot: Snapshot) => void;
  currentScenario?: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────

/**
 * Compute net shift: average of all categories' 2030 median values.
 */
function computeNetShift(shifts: ShiftMatrix): number {
  const values: number[] = [];

  Object.values(shifts).forEach(categoryPath => {
    if (typeof categoryPath === 'object' && categoryPath[2030]) {
      const yearData = categoryPath[2030];
      const median = typeof yearData === 'number'
        ? yearData
        : (yearData as any).median || 0;
      values.push(median);
    }
  });

  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Format relative date: "Just now", "2 hours ago", "Yesterday", "Mar 15, 2026".
 */
function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  // Show full date for older snapshots (permanent history)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[date.getMonth()];
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m} ${d}, ${y}`;
}

/**
 * Convert API response to local Snapshot type.
 */
function apiToSnapshot(api: APISnapshot): Snapshot {
  return {
    id: String(api.id),
    name: api.name,
    createdAt: api.created_at,
    scenario: api.scenario,
    shifts: api.shifts,
    trends: api.trends || [],
    trendCount: api.trend_count,
    netShift: api.net_shift,
    notes: api.notes || undefined,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SessionSnapshots: React.FC<SessionSnapshotsProps> = ({
  currentShifts,
  currentTrends,
  onClose,
  onRestoreSnapshot,
  currentScenario = 'Base Case',
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [compareMode, setCompareMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch snapshots from backend on mount
  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/snapshots');
      if (!res.ok) throw new Error(`Failed to fetch snapshots (${res.status})`);
      const data: APISnapshot[] = await res.json();
      setSnapshots(data.map(apiToSnapshot));
    } catch (err) {
      console.error('Failed to load snapshots:', err);
      setError('Could not load snapshot history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Handle save — POST to backend
  const handleSave = async () => {
    if (!snapshotName.trim() || !currentShifts || saving) return;

    try {
      setSaving(true);
      setError(null);

      const body = {
        name: snapshotName.trim(),
        scenario: currentScenario,
        shifts: currentShifts,
        trends: currentTrends,
        trend_count: currentTrends.length,
        net_shift: computeNetShift(currentShifts),
        notes: snapshotNotes.trim() || null,
      };

      const res = await fetch('/api/v1/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Failed to save snapshot (${res.status})`);

      const saved: APISnapshot = await res.json();
      // Prepend the new snapshot to the list
      setSnapshots(prev => [apiToSnapshot(saved), ...prev]);

      // Reset form
      setSnapshotName('');
      setSnapshotNotes('');
    } catch (err) {
      console.error('Failed to save snapshot:', err);
      setError('Could not save snapshot');
    } finally {
      setSaving(false);
    }
  };

  // Handle restore
  const handleRestore = (snapshot: Snapshot) => {
    onRestoreSnapshot?.(snapshot);
  };

  // Compute comparison delta
  const comparisonDelta = useMemo(() => {
    if (!compareMode || !currentShifts) return null;

    const snapshot = snapshots.find(s => s.id === compareMode);
    if (!snapshot) return null;

    const oldNetShift = snapshot.netShift;
    const newNetShift = computeNetShift(currentShifts);
    const delta = newNetShift - oldNetShift;

    const oldTrendCount = snapshot.trendCount;
    const newTrendCount = currentTrends.length;
    const trendDelta = newTrendCount - oldTrendCount;

    // Count categories with changes > 0.5pp
    const changedCategories = Object.keys(currentShifts).filter(cat => {
      const oldPath = snapshot.shifts[cat];
      const newPath = currentShifts[cat];

      if (!oldPath || !newPath) return false;

      const oldMedian = typeof oldPath[2030] === 'number'
        ? oldPath[2030] as number
        : (oldPath[2030] as any)?.median || 0;

      const newMedian = typeof newPath[2030] === 'number'
        ? newPath[2030] as number
        : (newPath[2030] as any)?.median || 0;

      return Math.abs(newMedian - oldMedian) > 0.005;
    }).length;

    return { delta, trendDelta, changedCategories };
  }, [compareMode, snapshots, currentShifts, currentTrends]);

  // Group snapshots by week for visual organization
  const groupedSnapshots = useMemo(() => {
    const groups: { label: string; snapshots: Snapshot[] }[] = [];
    const now = new Date();
    let currentGroup: { label: string; snapshots: Snapshot[] } | null = null;

    snapshots.forEach(s => {
      const date = new Date(s.createdAt);
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

      let label: string;
      if (diffDays < 1) label = 'Today';
      else if (diffDays < 2) label = 'Yesterday';
      else if (diffDays < 7) label = 'This Week';
      else if (diffDays < 14) label = 'Last Week';
      else if (diffDays < 30) label = 'This Month';
      else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[date.getMonth()]} ${date.getFullYear()}`;
      }

      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, snapshots: [] };
        groups.push(currentGroup);
      }
      currentGroup.snapshots.push(s);
    });

    return groups;
  }, [snapshots]);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(2px)',
            zIndex: 200,
          }}
        />
      </AnimatePresence>

      {/* Panel */}
      <motion.div
        initial={{ x: 460, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 460, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '460px',
          backgroundColor: T.bg,
          borderLeft: `1px solid ${T.border}`,
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} color={T.accent} />
            <h2
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: T.text,
                margin: 0,
              }}
            >
              Session History
            </h2>
            {snapshots.length > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  color: T.text3,
                  fontFamily: T.mono,
                  backgroundColor: T.bg1,
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {snapshots.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.text3,
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.text3; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '16px',
          }}
        >
          {/* Save Current State Section */}
          <div
            style={{
              padding: '12px',
              backgroundColor: T.bg1,
              borderRadius: '8px',
              border: `1px solid ${T.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <label
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Save Current State
            </label>

            <input
              type="text"
              placeholder="e.g., Q2 Planning Refresh"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '12px',
                border: `1px solid ${T.border}`,
                borderRadius: '6px',
                backgroundColor: T.bg,
                color: T.text,
                fontFamily: T.sans,
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
            />

            <textarea
              placeholder="Optional notes (e.g., assumptions, context)"
              value={snapshotNotes}
              onChange={(e) => setSnapshotNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '11px',
                border: `1px solid ${T.border}`,
                borderRadius: '6px',
                backgroundColor: T.bg,
                color: T.text,
                fontFamily: T.sans,
                resize: 'vertical',
                minHeight: '50px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
            />

            <button
              onClick={handleSave}
              disabled={!snapshotName.trim() || !currentShifts || saving}
              style={{
                padding: '8px 12px',
                backgroundColor: snapshotName.trim() && currentShifts && !saving ? T.accent : T.border,
                color: snapshotName.trim() && currentShifts && !saving ? '#fff' : T.text3,
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: snapshotName.trim() && currentShifts && !saving ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (snapshotName.trim() && currentShifts && !saving) {
                  e.currentTarget.style.backgroundColor = '#0057B8';
                }
              }}
              onMouseLeave={(e) => {
                if (snapshotName.trim() && currentShifts && !saving) {
                  e.currentTarget.style.backgroundColor = T.accent;
                }
              }}
            >
              {saving ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
              {saving ? 'Saving...' : 'Save Snapshot'}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: T.red + '10',
                borderRadius: '6px',
                border: `1px solid ${T.red + '30'}`,
                fontSize: '11px',
                color: T.red,
              }}
            >
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 12px',
                color: T.text3,
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ margin: 0 }}>Loading history...</p>
            </div>
          ) : groupedSnapshots.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {groupedSnapshots.map(group => (
                <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Week/period label */}
                  <label
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: T.text3,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {group.label}
                  </label>

                  {group.snapshots.map((snapshot, index) => (
                    <motion.div
                      key={snapshot.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      {/* Snapshot Card */}
                      <div
                        style={{
                          padding: '10px',
                          backgroundColor: T.bg1,
                          borderRadius: '8px',
                          border: `1px solid ${
                            compareMode === snapshot.id ? T.accent + '40' : T.border
                          }`,
                          transition: 'border-color 0.2s, background-color 0.2s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget;
                          if (compareMode !== snapshot.id) {
                            el.style.backgroundColor = T.bg2;
                          }
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget;
                          if (compareMode !== snapshot.id) {
                            el.style.backgroundColor = T.bg1;
                          }
                        }}
                      >
                        {/* Card Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: T.text,
                                marginBottom: '2px',
                              }}
                            >
                              {snapshot.name}
                            </div>
                            <div
                              style={{
                                fontSize: '9px',
                                color: T.text3,
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                              }}
                            >
                              <span>{formatRelativeDate(snapshot.createdAt)}</span>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '4px',
                                  height: '4px',
                                  borderRadius: '50%',
                                  backgroundColor: T.border,
                                }}
                              />
                              <span
                                style={{
                                  padding: '2px 6px',
                                  backgroundColor: T.accent + '20',
                                  borderRadius: '3px',
                                  color: T.accent,
                                }}
                              >
                                {snapshot.scenario}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Metrics Row */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            marginBottom: '8px',
                            fontSize: '10px',
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              backgroundColor: T.bg,
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ color: T.text3 }}>Net Shift:</span>
                            <span
                              style={{
                                fontFamily: T.mono,
                                fontWeight: 600,
                                color: snapshot.netShift > 0 ? T.green : snapshot.netShift < 0 ? T.red : T.text2,
                              }}
                            >
                              {fmtShift(snapshot.netShift, 2)}
                            </span>
                          </div>
                          <div
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              backgroundColor: T.bg,
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ color: T.text3 }}>Trends:</span>
                            <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.text }}>
                              {snapshot.trendCount}
                            </span>
                          </div>
                        </div>

                        {/* Notes Display (if present) */}
                        {snapshot.notes && (
                          <div
                            style={{
                              padding: '6px 8px',
                              backgroundColor: T.bg,
                              borderRadius: '4px',
                              marginBottom: '8px',
                              fontSize: '9px',
                              color: T.text2,
                              lineHeight: 1.4,
                              fontStyle: 'italic',
                            }}
                          >
                            {snapshot.notes}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                            width: '100%',
                          }}
                        >
                          <button
                            onClick={() => handleRestore(snapshot)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              backgroundColor: T.accent + '20',
                              color: T.accent,
                              border: `1px solid ${T.accent + '40'}`,
                              borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'background-color 0.2s, border-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = T.accent + '40';
                              e.currentTarget.style.borderColor = T.accent;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = T.accent + '20';
                              e.currentTarget.style.borderColor = T.accent + '40';
                            }}
                          >
                            <RotateCcw size={10} />
                            Restore
                          </button>

                          <button
                            onClick={() => setCompareMode(compareMode === snapshot.id ? null : snapshot.id)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              backgroundColor: compareMode === snapshot.id ? T.purple + '40' : T.bg,
                              color: compareMode === snapshot.id ? T.purple : T.text2,
                              border: `1px solid ${compareMode === snapshot.id ? T.purple + '60' : T.border}`,
                              borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'background-color 0.2s, border-color 0.2s, color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              if (compareMode !== snapshot.id) {
                                e.currentTarget.style.backgroundColor = T.purple + '20';
                                e.currentTarget.style.borderColor = T.purple + '40';
                                e.currentTarget.style.color = T.purple;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (compareMode !== snapshot.id) {
                                e.currentTarget.style.backgroundColor = T.bg;
                                e.currentTarget.style.borderColor = T.border;
                                e.currentTarget.style.color = T.text2;
                              }
                            }}
                          >
                            <Copy size={10} />
                            Compare
                          </button>
                        </div>
                      </div>

                      {/* Comparison View */}
                      <AnimatePresence>
                        {compareMode === snapshot.id && comparisonDelta && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                              padding: '10px',
                              backgroundColor: T.purple + '08',
                              borderRadius: '6px',
                              border: `1px solid ${T.purple + '20'}`,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '9px',
                                color: T.text2,
                                lineHeight: 1.6,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600 }}>Net Shift Change:</span>
                                <span
                                  style={{
                                    fontFamily: T.mono,
                                    fontWeight: 600,
                                    color: comparisonDelta.delta > 0 ? T.green : T.red,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  {comparisonDelta.delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                  {fmtShift(comparisonDelta.delta, 2)}
                                </span>
                              </div>

                              {comparisonDelta.changedCategories > 0 && (
                                <div>
                                  <span style={{ fontWeight: 600 }}>
                                    {comparisonDelta.changedCategories} categor{comparisonDelta.changedCategories === 1 ? 'y' : 'ies'} changed
                                  </span>
                                  {' ('}
                                  <span style={{ color: T.text3 }}>&gt;0.5pp shift</span>
                                  {')'}
                                </div>
                              )}

                              {comparisonDelta.trendDelta !== 0 && (
                                <div>
                                  <span style={{ fontWeight: 600 }}>{Math.abs(comparisonDelta.trendDelta)}</span>
                                  {' trend'}
                                  {Math.abs(comparisonDelta.trendDelta) === 1 ? '' : 's'}
                                  {' '}
                                  <span style={{ color: T.text3 }}>
                                    {comparisonDelta.trendDelta > 0 ? 'added' : 'removed'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 12px',
                color: T.text3,
                fontSize: '12px',
                lineHeight: 1.6,
              }}
            >
              <p style={{ margin: 0, marginBottom: '8px' }}>No snapshots yet.</p>
              <p style={{ margin: 0, fontSize: '11px', color: T.text3 }}>
                Save your current state above to build a permanent history of simulation versions.
              </p>
            </div>
          )}
        </div>

        {/* Footer — permanent history note */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: `1px solid ${T.border}`,
            fontSize: '9px',
            color: T.text3,
            textAlign: 'center',
            backgroundColor: T.bg1,
          }}
        >
          Snapshots are permanently stored. History is never deleted.
        </div>
      </motion.div>

      {/* Spinner animation keyframe (injected once) */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

export default SessionSnapshots;
