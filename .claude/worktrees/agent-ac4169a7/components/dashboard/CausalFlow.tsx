/**
 * CausalFlow — Interactive SVG Causal DAG visualization.
 * 6 force nodes in hexagonal layout with animated causal propagation edges.
 * Click a force to simulate shock propagation; hover to see edge weights.
 * Apple × Goldman Sachs: minimal, purposeful, data-driven.
 */

import { useMemo, useState, FC, SVGProps } from 'react';
import { motion } from 'framer-motion';
import type { CausalDAG, ForceName } from '@/types';
import { T, FORCES } from '@/lib/format';
import { propagateShock } from '@/api/client';

interface CausalFlowProps {
  dag?: CausalDAG | null;
  shockedForce?: ForceName | null;
  onShockForce?: (force: ForceName | null) => void;
}

interface Position {
  x: number;
  y: number;
}

interface ProcessedEdge {
  id: string;
  from: ForceName;
  to: ForceName;
  weight: number;
  lag: number;
  p1: Position;
  p2: Position;
  ctrl: Position;
  arrowPath: string;
}

interface PropagatedImpact {
  [force: string]: number;
}

/**
 * Position 6 forces on a circle (hexagonal layout).
 * Radius 105, centered at (220, 140), starting from -PI/2 (top).
 */
function getForcePositions(): Record<ForceName, Position> {
  const forceList = Object.keys(FORCES) as ForceName[];
  const centerX = 220;
  const centerY = 140;
  const radius = 105;

  const positions: Record<ForceName, Position> = {} as Record<ForceName, Position>;
  forceList.forEach((force, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / forceList.length;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    positions[force] = { x, y };
  });

  return positions;
}

/**
 * Compute control point for quadratic bezier curve (offset perpendicular to line).
 */
function computeControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset = 30
): Position {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = -dy / len;
  const uy = dx / len;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return {
    x: midX + ux * offset,
    y: midY + uy * offset,
  };
}

/**
 * Compute marker points for arrow (at end of line).
 */
function getArrowMarkerPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 8
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  const x3 = x2 - size * Math.cos(angle - Math.PI / 6);
  const y3 = y2 - size * Math.sin(angle - Math.PI / 6);
  const x4 = x2 - size * Math.cos(angle + Math.PI / 6);
  const y4 = y2 - size * Math.sin(angle + Math.PI / 6);
  return `M ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
}

const CausalFlow: FC<CausalFlowProps> = ({
  dag = null,
  shockedForce = null,
  onShockForce = () => {},
}) => {
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredForce, setHoveredForce] = useState<ForceName | null>(null);
  const [shockMagnitude, setShockMagnitude] = useState<number>(0.3);
  const [propagatedImpacts, setPropagatedImpacts] = useState<PropagatedImpact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positions = useMemo(() => getForcePositions(), []);

  // Parse causal edges from data
  const edges = useMemo((): ProcessedEdge[] => {
    if (!dag?.edges || !Array.isArray(dag.edges)) return [];

    return dag.edges
      .map((edge, _idx) => {
        const { from, to, weight = 0.5, lag = 0 } = edge;
        if (!positions[from] || !positions[to]) return null;

        const p1 = positions[from];
        const p2 = positions[to];
        const ctrl = computeControlPoint(p1.x, p1.y, p2.x, p2.y, 45);

        return {
          id: `${from}-${to}`,
          from,
          to,
          weight: Math.min(Math.max(weight, 0), 1),
          lag,
          p1,
          p2,
          ctrl,
          arrowPath: getArrowMarkerPath(p1.x, p1.y, p2.x, p2.y),
        };
      })
      .filter((e): e is ProcessedEdge => e !== null);
  }, [dag?.edges, positions]);

  // Determine which edges are "active" (if a force is shocked)
  const activeEdges = useMemo((): Set<string> => {
    if (!shockedForce) return new Set();

    const active = new Set<string>();
    const visited = new Set<ForceName>([shockedForce]);
    const queue: ForceName[] = [shockedForce];

    // BFS to mark all downstream edges from shocked force
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      edges.forEach(edge => {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          active.add(edge.id);
          queue.push(edge.to);
        }
      });
    }

    return active;
  }, [shockedForce, edges]);

  // Handle shock propagation
  const handleRunPropagation = async () => {
    if (!shockedForce) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await propagateShock({
        shocked_force: shockedForce,
        magnitude: shockMagnitude,
        years: 5,
      });

      // Extract first year's impacts or use provided data
      if (result.impacts && typeof result.impacts === 'object') {
        const firstYearKey = Object.keys(result.impacts)[0];
        if (firstYearKey && typeof (result.impacts as any)[firstYearKey] === 'object') {
          setPropagatedImpacts((result.impacts as any)[firstYearKey] as PropagatedImpact);
        } else {
          setPropagatedImpacts(result.impacts as unknown as PropagatedImpact);
        }
      }
    } catch (err) {
      // Fallback to local mock propagation using DAG weights
      console.warn('Propagation API failed, using local mock:', err);
      const mockImpacts: PropagatedImpact = {};
      const forceList = Object.keys(FORCES) as ForceName[];

      forceList.forEach(force => {
        mockImpacts[force] = 0;
      });

      mockImpacts[shockedForce] = shockMagnitude;

      // Simple BFS propagation using edge weights
      const visited = new Set<ForceName>([shockedForce]);
      const queue: Array<{ force: ForceName; impact: number }> = [
        { force: shockedForce, impact: shockMagnitude },
      ];

      while (queue.length > 0) {
        const { force, impact } = queue.shift()!;

        edges.forEach(edge => {
          if (edge.from === force && !visited.has(edge.to)) {
            visited.add(edge.to);
            const propagatedImpact = impact * edge.weight;
            mockImpacts[edge.to] = (mockImpacts[edge.to] || 0) + propagatedImpact;
            queue.push({ force: edge.to, impact: propagatedImpact });
          }
        });
      }

      setPropagatedImpacts(mockImpacts);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    onShockForce(null);
    setPropagatedImpacts(null);
    setShockMagnitude(0.3);
    setError(null);
  };

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
      } as React.CSSProperties}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.text2,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 4,
          }}
        >
          Causal DAG
        </div>
        <div
          style={{
            fontSize: 11,
            color: T.text3,
          }}
        >
          Force Interdependencies · Click a force to propagate shock
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <svg
          width={440}
          height={280}
          viewBox="0 0 440 280"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Radial gradient for shocked node glow */}
            <radialGradient id="shockGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={T.purple} stopOpacity={0.4} />
              <stop offset="100%" stopColor={T.purple} stopOpacity={0} />
            </radialGradient>

            {/* Arrow marker */}
            <marker
              id="arrowActive"
              markerWidth={10}
              markerHeight={10}
              refX={8}
              refY={3}
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 3 L 0 6 Z" fill={T.purple} />
            </marker>

            <marker
              id="arrowInactive"
              markerWidth={10}
              markerHeight={10}
              refX={8}
              refY={3}
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 3 L 0 6 Z" fill={T.border2} />
            </marker>
          </defs>

          {/* Edges (curves with arrows) */}
          {edges.map(edge => {
            const isActive = activeEdges.has(edge.id);
            const isHovered = hoveredEdge === edge.id;
            const _isSourceHovered =
              hoveredForce === edge.from || hoveredForce === edge.to;

            return (
              <g key={edge.id}>
                {/* Quadratic bezier curve for edge */}
                <path
                  d={`M ${edge.p1.x} ${edge.p1.y} Q ${edge.ctrl.x} ${edge.ctrl.y} ${edge.p2.x} ${edge.p2.y}`}
                  fill="none"
                  stroke={isActive ? T.purple : T.border1}
                  strokeWidth={isHovered ? 3 : isActive ? 2 : 1.5}
                  opacity={isActive ? 1 : 0.18}
                  markerEnd={isActive ? 'url(#arrowActive)' : 'url(#arrowInactive)'}
                  style={{
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'default',
                  }}
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />

                {/* Weight + lag label (always visible, but dimmer when inactive) */}
                {(true) && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <text
                      x={edge.ctrl.x}
                      y={edge.ctrl.y - 8}
                      textAnchor="middle"
                      fontSize={9}
                      fill={isActive || isHovered ? T.text2 : T.text4}
                      fontFamily={T.mono}
                      fontWeight={500}
                    >
                      {(edge.weight * 100).toFixed(0)}%
                    </text>
                    {edge.lag > 0 && (
                      <text
                        x={edge.ctrl.x}
                        y={edge.ctrl.y + 6}
                        textAnchor="middle"
                        fontSize={8}
                        fill={isActive || isHovered ? T.text3 : T.text4}
                        fontFamily={T.mono}
                      >
                        lag {edge.lag}y
                      </text>
                    )}
                  </motion.g>
                )}
              </g>
            );
          })}

          {/* Force nodes */}
          {(Object.entries(FORCES) as Array<[ForceName, typeof FORCES[ForceName]]>).map(
            ([force, { color, emoji }]) => {
              const pos = positions[force];
              const isShocked = shockedForce === force;
              const isSourceNode = edges.some(e => isShocked && e.from === force);

              return (
                <g key={force}>
                  {/* Glow backdrop (shocked node) */}
                  {isShocked && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={35}
                      fill="url(#shockGlow)"
                      style={{
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      }}
                    />
                  )}

                  {/* Node circle */}
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={22}
                    fill={T.bg2}
                    stroke={isShocked ? color : T.border1}
                    strokeWidth={isShocked ? 3 : 1.5}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={() => setHoveredForce(force)}
                    onMouseLeave={() => setHoveredForce(null)}
                    onClick={() => onShockForce(isShocked ? null : force)}
                    whileHover={{ r: 26, strokeWidth: 2 }}
                    whileTap={{ scale: 0.95 }}
                  />

                  {/* Force emoji */}
                  <text
                    x={pos.x}
                    y={pos.y + 6}
                    textAnchor="middle"
                    fontSize={16}
                    dominantBaseline="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {emoji}
                  </text>

                  {/* Force label below node */}
                  <text
                    x={pos.x}
                    y={pos.y + 42}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isShocked ? color : T.text2}
                    fontFamily={T.mono}
                    fontWeight={isShocked ? 600 : 500}
                    style={{ pointerEvents: 'none' }}
                  >
                    {force}
                  </text>

                  {/* "SHOCK" label when shocked */}
                  {isShocked && (
                    <motion.text
                      x={pos.x}
                      y={pos.y - 36}
                      textAnchor="middle"
                      fontSize={11}
                      fill={T.red}
                      fontFamily={T.mono}
                      fontWeight={700}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      SHOCK {(shockMagnitude * 100).toFixed(0)}%
                    </motion.text>
                  )}

                  {/* Propagated impact (if available) */}
                  {propagatedImpacts && propagatedImpacts[force] && propagatedImpacts[force] !== shockMagnitude && (
                    <motion.text
                      x={pos.x}
                      y={pos.y + 60}
                      textAnchor="middle"
                      fontSize={10}
                      fill={propagatedImpacts[force] > 0 ? T.green : T.red}
                      fontFamily={T.mono}
                      fontWeight={600}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {propagatedImpacts[force] > 0 ? '+' : ''}{(propagatedImpacts[force] * 100).toFixed(1)}%
                    </motion.text>
                  )}
                </g>
              );
            }
          )}
        </svg>

        {/* CSS for pulse animation */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.2; }
          }
        `}</style>
      </div>

      {/* Shock Magnitude Slider (appears when force selected) */}
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: shockedForce ? 1 : 0, height: shockedForce ? 'auto' : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          overflow: 'hidden',
          marginTop: 16,
          paddingTop: shockedForce ? 16 : 0,
          borderTop: shockedForce ? `1px solid ${T.border}` : 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.text2,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                minWidth: 100,
              }}
            >
              Shock Magnitude
            </label>
            <input
              type="range"
              min="-0.5"
              max="0.5"
              step="0.05"
              value={shockMagnitude}
              onChange={(e) => setShockMagnitude(parseFloat(e.target.value))}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: `linear-gradient(to right, ${T.red}, ${T.text3}, ${T.green})`,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: shockMagnitude > 0 ? T.green : shockMagnitude < 0 ? T.red : T.text3,
                minWidth: 45,
                textAlign: 'right',
                fontFamily: T.mono,
              }}
            >
              {shockMagnitude > 0 ? '+' : ''}{(shockMagnitude * 100).toFixed(1)}%
            </span>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize: 10,
                color: T.red,
                padding: '8px 12px',
                borderRadius: 6,
                background: `${T.red}15`,
                border: `1px solid ${T.red}30`,
              }}
            >
              {error}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 600,
                color: T.text2,
                background: T.bg3,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = T.bg3;
              }}
            >
              Reset
            </button>
            <button
              onClick={handleRunPropagation}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 600,
                color: T.bg1,
                background: T.purple,
                border: 'none',
                borderRadius: 8,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.opacity = '0.85';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {isLoading ? 'Running...' : 'Run Propagation'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Edge Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 8,
        fontSize: 9,
        color: T.text3,
        fontFamily: T.mono,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={T.purple} strokeWidth="2"/></svg>
          Active propagation
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={T.border1} strokeWidth="1.5" opacity="0.18"/></svg>
          Inactive edge
        </span>
        <span>Weight = propagation strength (0-100%)</span>
        <span>Lag = delay in years</span>
      </div>

      {/* Legend / Instructions */}
      <div
        style={{
          fontSize: 10,
          color: T.text3,
          textAlign: 'center',
          fontFamily: T.mono,
          paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        {shockedForce ? (
          <span>
            Propagating shock from <strong style={{ color: T.purple }}>{shockedForce}</strong>
          </span>
        ) : (
          <span>Click a force to simulate shock propagation through the DAG</span>
        )}
      </div>
    </motion.div>
  );
};

export default CausalFlow;
