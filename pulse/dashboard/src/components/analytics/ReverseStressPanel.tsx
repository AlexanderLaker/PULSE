/**
 * ReverseStressPanel — Reverse stress testing
 * "What parameter changes are needed to achieve a target shift?"
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, ChevronRight } from 'lucide-react';
import { T, CATEGORIES, fmtShift, fmtPct } from '../../lib/format';
import type { ReverseStressResult } from '../../types/analytics';

interface ReverseStressPanelProps {
  onReverseStress?: (params: {
    category: string;
    target_shift: number;
  }) => Promise<ReverseStressResult>;
  isLoading?: boolean;
}

export default function ReverseStressPanel({
  onReverseStress = undefined,
  isLoading = false,
}: ReverseStressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('hair_care');
  const [targetShift, setTargetShift] = useState(-0.05);
  const [results, setResults] = useState<ReverseStressResult | null>(null);
  const [computing, setComputing] = useState(false);

  const handleCompute = async () => {
    if (!onReverseStress) return;
    setComputing(true);
    try {
      const result = await onReverseStress({
        category: selectedCategory,
        target_shift: targetShift,
      });
      setResults(result);
    } catch (e) {
      console.error('Reverse stress error:', e);
    } finally {
      setComputing(false);
    }
  };

  const currentCategory = CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        backgroundColor: T.bg2,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header / Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 24,
          backgroundColor: T.bg2,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = T.bg3;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = T.bg2;
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sliders size={20} color={T.accent} />
          <div style={{ textAlign: 'left' }}>
            <h3
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: T.text,
                margin: 0,
              }}
            >
              Reverse Stress Testing
            </h3>
            <p
              style={{
                fontSize: 13,
                color: T.text3,
                margin: '4px 0 0 0',
              }}
            >
              What changes would be needed to achieve a target shift?
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight size={20} color={T.text3} />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: 24,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            {/* Input Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Category Select */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Target Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: T.bg1,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 14,
                    color: T.text,
                    fontFamily: T.sans,
                    cursor: 'pointer',
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Shift Input */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Target Shift ({fmtShift(targetShift)})
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="range"
                    min="-0.2"
                    max="0.2"
                    step="0.01"
                    value={targetShift}
                    onChange={(e) => setTargetShift(parseFloat(e.target.value))}
                    style={{ flex: 1, height: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="number"
                    min="-0.2"
                    max="0.2"
                    step="0.01"
                    value={targetShift}
                    onChange={(e) => setTargetShift(parseFloat(e.target.value))}
                    style={{
                      width: 80,
                      padding: '8px 12px',
                      backgroundColor: T.bg1,
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: T.text,
                      fontFamily: T.mono,
                    }}
                  />
                </div>
              </div>

              {/* Compute Button */}
              <button
                onClick={handleCompute}
                disabled={computing || !onReverseStress}
                style={{
                  padding: '12px 16px',
                  backgroundColor: computing ? T.accentDim : T.accent,
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#FFFFFF',
                  cursor: computing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: computing ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!computing && onReverseStress) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!computing && onReverseStress) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {computing ? 'Computing...' : 'Calculate Required Changes'}
              </button>
            </div>

            {/* Results */}
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: 16,
                  backgroundColor: T.bg3,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                }}
              >
                <h4
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    margin: 0,
                  }}
                >
                  Parameter Adjustments Needed
                </h4>

                {/* Changes by force */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(results.required_changes ?? [])
                    .filter(([, change]) => change && typeof change === 'object')
                    .sort(([, a], [, b]) => {
                      const aVal = typeof a === 'object' && 'change_needed' in a ? a.change_needed : 0;
                      const bVal = typeof b === 'object' && 'change_needed' in b ? b.change_needed : 0;
                      return Math.abs(bVal) - Math.abs(aVal);
                    })
                    .slice(0, 8)
                    .map(([key, change]) => {
                      const changeObj = change as any;
                      const changeVal = changeObj?.change_needed ?? 0;
                      const forceName = changeObj?.force ?? key;

                      return (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingBottom: 8,
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: T.text,
                              fontWeight: 500,
                            }}
                          >
                            {forceName}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontFamily: T.mono,
                              color: changeVal < 0 ? T.red : T.green,
                              fontWeight: 500,
                            }}
                          >
                            {changeVal >= 0 ? '+' : ''}{fmtPct(changeVal, 0)}
                          </span>
                        </motion.div>
                      );
                    })}
                </div>

                {/* Summary */}
                {results.narrative && (
                  <p
                    style={{
                      fontSize: 12,
                      color: T.text2,
                      fontStyle: 'italic',
                      margin: '8px 0 0 0',
                    }}
                  >
                    {results.narrative}
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
