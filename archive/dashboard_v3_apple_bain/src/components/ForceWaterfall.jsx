/**
 * ForceWaterfall — Horizontal bar chart showing force contribution decomposition.
 * Shows which forces drive shifts in a selected category (by % contribution).
 * Apple × Bain: clean, purposeful, data-forward.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts';
import { T, FORCES, CATEGORIES, fmtPct, shortCat, tooltipStyle } from '../lib/format';

/**
 * Custom tooltip matching design tokens.
 */
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const { value, payload: dataPayload } = payload[0];
  const force = dataPayload.force;
  const color = FORCES[force]?.color || T.text2;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      style={{
        ...tooltipStyle,
        background: T.bg1,
        borderColor: T.border2,
      }}
    >
      <div style={{ color, fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
        {force}
      </div>
      <div style={{ fontSize: 11, color: T.text2 }}>
        Contribution: <span style={{ color, fontFamily: T.mono, fontWeight: 600 }}>
          {fmtPct(value, 1)}
        </span>
      </div>
    </motion.div>
  );
}

export default function ForceWaterfall({ data = {}, selectedCategory = 'lhc_fcn' }) {
  const { chartData, categoryName } = useMemo(() => {
    if (!data || !data.forceContributions) {
      return { chartData: [], categoryName: 'FCN' };
    }

    const contributions = data.forceContributions[selectedCategory] || [];
    const catObj = CATEGORIES.find(c => c.id === selectedCategory);
    const catLabel = catObj?.name || selectedCategory;

    // Convert to chart format and sort by absolute magnitude (descending)
    const chartPoints = Object.entries(FORCES).map(([forceName, forceData]) => {
      const contribution = contributions.find(c => c.force === forceName) || {};
      return {
        force: forceName,
        value: contribution.value || 0,
        normalized: contribution.normalized || 0,
      };
    }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    return {
      chartData: chartPoints,
      categoryName: shortCat(catLabel),
    };
  }, [data, selectedCategory]);

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: T.bg2,
          border: `1px solid ${T.border1}`,
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <p style={{ color: T.text2, fontSize: 13 }}>
          No force decomposition data available
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: T.bg2,
        border: `1px solid ${T.border1}`,
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        padding: '24px 20px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.text2,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 4,
        }}>
          Force Decomposition
        </div>
        <div style={{
          fontSize: 11,
          color: T.text3,
        }}>
          Contribution to {categoryName} shift by force
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 220, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 100 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={T.border}
              horizontal={true}
              vertical={false}
            />

            <XAxis
              type="number"
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: T.text3, fontSize: 10 }}
              axisLine={{ stroke: T.border1 }}
              style={{ fontFamily: T.mono }}
            />

            <YAxis
              dataKey="force"
              type="category"
              tick={{ fill: T.text2, fontSize: 10 }}
              axisLine={{ stroke: T.border1 }}
              width={95}
              style={{ fontFamily: T.mono, fontWeight: 500 }}
            />

            {/* Zero reference line */}
            <ReferenceLine
              x={0}
              stroke={T.border1}
              strokeDasharray="2 2"
            />

            {/* Contribution bars, colored by force */}
            <Bar
              dataKey="value"
              fill={T.accent}
              radius={[0, 8, 8, 0]}
              isAnimationActive={true}
              shape={<CustomBarCell />}
            >
              {chartData.map((entry, idx) => {
                const color = FORCES[entry.force]?.color || T.accent;
                return (
                  <Cell
                    key={`cell-${idx}`}
                    fill={entry.value >= 0 ? color : T.red}
                    opacity={0.7}
                  />
                );
              })}
            </Bar>

            <Tooltip content={<CustomTooltip />} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div style={{
        display: 'flex',
        gap: 12,
        paddingTop: 12,
        borderTop: `1px solid ${T.border}`,
      }}>
        {['Consumer', 'Government', 'Technology'].map(forceName => {
          const entry = chartData.find(d => d.force === forceName);
          const value = entry?.value || 0;
          const color = FORCES[forceName]?.color || T.text2;

          return (
            <div key={forceName} style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.text3, marginBottom: 4, fontFamily: T.mono }}>
                {forceName.slice(0, 3).toUpperCase()}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color,
                fontFamily: T.mono,
              }}>
                {fmtPct(value, 1)}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Custom bar shape for richer styling.
 */
function CustomBarCell(props) {
  const { x, y, width, height, fill, radius } = props;

  if (width < 0) {
    // Negative bar: flip to left
    return (
      <g>
        <rect
          x={x + width}
          y={y}
          width={-width}
          height={height}
          fill={fill}
          rx={radius?.[2] || 4}
          ry={radius?.[3] || 4}
        />
      </g>
    );
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        rx={radius?.[0] || 4}
        ry={radius?.[1] || 4}
      />
    </g>
  );
}
