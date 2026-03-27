/**
 * ForceRadar — Radar/spider chart showing 6 forces and their relative weights + net direction.
 */

import { useMemo, FC } from 'react';
import { motion } from 'framer-motion';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { Trend, ForceName } from '@/types';
import { FORCE_COLORS, FORCE_ICONS } from '@/lib/format';

interface ForceData {
  force: ForceName;
  score: number;
  weight: number;
  trends: number;
  direction: 'Expansion' | 'Contraction' | 'Neutral';
  icon: string;
}

interface ForceRadarProps {
  trends?: Trend[] | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ForceData;
  }>;
}

const CustomTooltip: FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as ForceData;
  return (
    <div style={{
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '11px',
      color: '#fff',
    }}>
      <div style={{ fontWeight: 600 }}>{data.force}</div>
      <div>Score: {data.score.toFixed(1)}</div>
      <div>Trends: {data.trends}</div>
    </div>
  );
};

const ForceRadar: FC<ForceRadarProps> = ({ trends = null }) => {
  const data = useMemo(() => {
    if (!trends || !Array.isArray(trends)) return [];

    // Group trends by force
    const forceStats: Record<ForceName, Trend[]> = {
      Consumer: [],
      Customer: [],
      Technology: [],
      Government: [],
      Environmental: [],
      Competitive: [],
    };

    trends.forEach(trend => {
      if (trend.force && forceStats[trend.force]) {
        forceStats[trend.force].push(trend);
      }
    });

    // Compute aggregates per force
    const result: ForceData[] = (
      Object.entries(forceStats) as Array<[ForceName, Trend[]]>
    )
      .map(([forceName, forceTrends]) => {
        const score =
          forceTrends.length > 0
            ? forceTrends.reduce((sum, t) => sum + (t.normalized_score ?? 0), 0) /
              forceTrends.length
            : 0;

        const weight =
          forceTrends.length > 0
            ? forceTrends.reduce((sum, t) => sum + (t.score ?? 0), 0) / (forceTrends.length * 25)
            : 0;

        // Net direction: majority vote on direction
        const directions = forceTrends.map(t => t.direction);
        const expansions = directions.filter(d => d === 'Expansion').length;
        const contractions = directions.filter(d => d === 'Contraction').length;
        let netDirection: 'Expansion' | 'Contraction' | 'Neutral' = 'Neutral';
        if (expansions > contractions) {
          netDirection = 'Expansion';
        } else if (contractions > expansions) {
          netDirection = 'Contraction';
        }

        return {
          force: forceName,
          score: Math.abs(score) * 100,
          weight: weight * 100,
          trends: forceTrends.length,
          direction: netDirection,
          icon: FORCE_ICONS[forceName] || '•',
        };
      });

    return result;
  }, [trends]);

  if (data.length === 0) {
    return (
      <div
        style={{
          background: T.bg2,
          border: `1px solid ${T.border1}`,
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
          padding: 32,
          textAlign: 'center',
          color: T.text2,
          fontSize: 13,
        }}
      >
        No force data available
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: T.bg2,
        border: `1px solid ${T.border1}`,
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        padding: '20px',
      }}
    >
      <h3
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.text2,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 16,
        }}
      >
        Force Landscape
      </h3>

      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(0,0,0,0.06)" />
            <PolarAngleAxis
              dataKey="force"
              tick={({ x, y, payload }) => (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={T.text3}
                  style={{ fontSize: 10 }}
                >
                  {FORCE_ICONS[(payload.value as ForceName) || 'Consumer']} {payload.value}
                </text>
              )}
            />
            <PolarRadiusAxis tick={false} axisLine={false} />
            <Radar
              name="Impact Score"
              dataKey="score"
              stroke={T.accent}
              fill={T.accent}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="Weight"
              dataKey="weight"
              stroke={T.green}
              fill={T.green}
              fillOpacity={0.08}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Force legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 12,
          justifyContent: 'center',
          paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        {data.map(d => (
          <div
            key={d.force}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}
          >
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: '50%',
                background: FORCE_COLORS[d.force],
              }}
            />
            <span style={{ color: T.text2 }}>{d.force}</span>
            <span
              style={{
                color: d.direction === 'Expansion' ? T.green : T.red,
              }}
            >
              {d.direction === 'Expansion' ? '↑' : d.direction === 'Contraction' ? '↓' : '→'}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// Import design tokens
import { T } from '@/lib/format';

export default ForceRadar;
