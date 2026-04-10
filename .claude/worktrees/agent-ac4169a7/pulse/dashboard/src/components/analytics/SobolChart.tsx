/**
 * SobolChart — Sobol indices for sensitivity & interaction effects
 * Bar chart showing first-order vs total-order Sobol indices
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { T, FORCES } from '../../lib/format';
import type { SobolResult, SobolIndex } from '../../types/analytics';

interface SobolChartProps {
  sobolData?: SobolResult | null;
  isLoading?: boolean;
}

interface ChartDataItem {
  name: string;
  S1: number;
  ST: number;
  interaction: number;
}

export default function SobolChart({
  sobolData = null,
  isLoading = false,
}: SobolChartProps) {
  const [viewMode, setViewMode] = useState<'forces' | 'trends'>('forces');

  if (!sobolData) {
    return (
      <div
        style={{
          padding: 24,
          backgroundColor: T.bg2,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          textAlign: 'center',
          color: T.text3,
        }}
      >
        {isLoading ? 'Computing Sobol indices...' : 'No Sobol data available'}
      </div>
    );
  }

  const forceData = (sobolData as any).forces ?? [];
  const trendData = (sobolData as any).trends ?? [];
  const data: SobolIndex[] = viewMode === 'forces' ? forceData : trendData;

  const chartData: ChartDataItem[] = data.map((item: any) => ({
    name: item.name,
    S1: item.first_order ?? 0,
    ST: item.total_order ?? 0,
    interaction: (item.total_order ?? 0) - (item.first_order ?? 0),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        backgroundColor: T.bg2,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
      }}
    >
      {/* Header */}
      <div>
        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: T.text,
            margin: '0 0 8px 0',
          }}
        >
          Sensitivity Analysis (Sobol)
        </h3>
        <p
          style={{
            fontSize: 13,
            color: T.text3,
            margin: 0,
          }}
        >
          First-order (S₁) = direct effect • Total-order (Sₜ) = direct + interactions
        </p>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${T.border}` }}>
        {(['forces', 'trends'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: '12px 16px',
              backgroundColor: viewMode === mode ? T.accentDim : 'transparent',
              border: 'none',
              borderBottom: viewMode === mode ? `2px solid ${T.accent}` : 'none',
              color: viewMode === mode ? T.text : T.text2,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textTransform: 'capitalize',
            }}
          >
            By {mode}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
          <XAxis
            dataKey="name"
            tick={{ fill: T.text3, fontSize: 12 }}
            axisLine={{ stroke: T.border }}
          />
          <YAxis
            tick={{ fill: T.text3, fontSize: 12 }}
            axisLine={{ stroke: T.border }}
            domain={[0, 1]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: T.bg1,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text,
            }}
            formatter={(value: any) => (value * 100).toFixed(1) + '%'}
          />
          <Legend
            wrapperStyle={{ paddingTop: 16, color: T.text2, fontSize: 12 }}
            iconType="square"
          />
          <Bar dataKey="S1" fill={T.accent} name="First-order (S₁)" radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="interaction"
            fill={T.purple}
            name="Interaction (Sₜ - S₁)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend / Explanation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          paddingTop: 16,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin: 0,
            }}
          >
            High Interaction
          </h4>
          <p style={{ fontSize: 13, color: T.text2, margin: 0, lineHeight: 1.4 }}>
            When interaction &gt; S₁: effects depend on other parameters
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              margin: 0,
            }}
          >
            Low Interaction
          </h4>
          <p style={{ fontSize: 13, color: T.text2, margin: 0, lineHeight: 1.4 }}>
            When interaction ≈ 0: effects are additive &amp; independent
          </p>
        </div>
      </div>
    </motion.div>
  );
}
