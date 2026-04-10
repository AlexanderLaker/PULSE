/**
 * AllocationChart — Resource allocation optimizer output.
 * Apple × Bain × Goldman Sachs: clean bars, summary metrics, elegant typography.
 *
 * Props: { data }
 * data.allocation = [{ id, name, short, group, color, weight, currentWeight, shift2030 }]
 *
 * Displays: sorted by weight descending, with delta from current allocation,
 * plus Sharpe ratio, expected return, portfolio risk metrics.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { T, CATEGORIES, fmtPct, shortCat } from '../lib/format';

export default function AllocationChart({ data, allocation }) {
  // Parse allocation data — either array of categories with weights, or nested object
  const items = useMemo(() => {
    if (!allocation && !data) return [];

    let result = [];
    if (allocation?.weights) {
      // Object: { category_id: weight, ... }
      result = Object.entries(allocation.weights)
        .map(([catId, weight]) => {
          const catDef = CATEGORIES.find(c => c.id === catId);
          return {
            id: catId,
            name: catDef?.name || catId,
            short: shortCat(catDef?.name || catId),
            color: catDef?.color || '#818CF8',
            weight: weight || 0,
            currentWeight: allocation.current_weights?.[catId] || 0,
            shift2030: allocation.shifts_2030?.[catId] || 0,
          };
        })
        .sort((a, b) => b.weight - a.weight);
    } else if (Array.isArray(data)) {
      // Array: [{ id, name, short, color, weight, currentWeight, shift2030 }, ...]
      result = [...data].sort((a, b) => b.weight - a.weight);
    }

    return result;
  }, [allocation, data]);

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          backgroundColor: T.bg2,
          borderRadius: '12px',
          border: `1px solid ${T.border1}`,
          padding: '40px',
          textAlign: 'center',
          color: T.text2,
          fontSize: '12px',
        }}
      >
        Run a simulation with allocation optimization enabled to see recommendations.
      </motion.div>
    );
  }

  // Compute portfolio metrics
  const totalWeight = items.reduce((s, i) => s + (i.weight || 0), 0);
  const avgWeightedShift = totalWeight > 0
    ? items.reduce((s, i) => s + ((i.weight || 0) * (i.shift2030 || 0)), 0) / totalWeight
    : 0;
  const portfolioRisk = Math.sqrt(
    items.reduce((s, i) => s + Math.pow((i.weight || 0) * (i.shift2030 || 0), 2), 0)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        backgroundColor: T.bg2,
        borderRadius: '12px',
        border: `1px solid ${T.border1}`,
        backdropFilter: 'blur(10px)',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: T.text,
        }}>
          Resource Allocation
          <span style={{ fontSize: '12px', marginLeft: '10px', color: T.text2 }}>
            — Optimizer Output
          </span>
        </h3>
        <div style={{ fontSize: '10px', color: T.text2 }}>
          Relative category weights
        </div>
      </div>

      {/* Category rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {items.map((item, idx) => {
          const displayWeight = item.weight * 100;
          const currentDisplayWeight = (item.currentWeight || 0) * 100;
          const delta = displayWeight - currentDisplayWeight;
          const deltaColor = delta > 0.01 ? T.green : delta < -0.01 ? T.red : T.text3;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Color bar + name */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '100px',
              }}>
                <div style={{
                  width: '3px',
                  height: '20px',
                  backgroundColor: item.color,
                  borderRadius: '2px',
                }} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: T.text2,
                  minWidth: '40px',
                }}>
                  {item.short}
                </span>
              </div>

              {/* Horizontal bar (progress style) */}
              <div style={{
                flex: 1,
                height: '6px',
                backgroundColor: T.bg3,
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(displayWeight, 25)}%` }}
                  transition={{ delay: idx * 0.04 + 0.1, duration: 0.5, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}cc 100%)`,
                  }}
                />
              </div>

              {/* Weight % label */}
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: T.mono,
                color: T.text,
                minWidth: '32px',
                textAlign: 'right',
              }}>
                {displayWeight.toFixed(1)}%
              </span>

              {/* Delta (optional) */}
              {item.currentWeight !== undefined && (
                <span style={{
                  fontSize: '9px',
                  fontWeight: 500,
                  fontFamily: T.mono,
                  color: deltaColor,
                  minWidth: '48px',
                  textAlign: 'right',
                }}>
                  {delta > 0 ? `+${delta.toFixed(1)}pp` : `${delta.toFixed(1)}pp`}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Summary metrics footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        paddingTop: '16px',
        borderTop: `1px solid ${T.border1}`,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: T.text2, marginBottom: '4px' }}>
            Expected Return
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: T.mono,
            color: avgWeightedShift > 0 ? T.green : T.red,
          }}>
            {avgWeightedShift >= 0 ? '+' : ''}{(avgWeightedShift * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: T.text2, marginBottom: '4px' }}>
            Portfolio Risk (σ)
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: T.mono,
            color: T.text,
          }}>
            {(portfolioRisk * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: T.text2, marginBottom: '4px' }}>
            Sharpe Ratio
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: T.mono,
            color: T.text,
          }}>
            {(avgWeightedShift / (portfolioRisk || 1)).toFixed(2)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
