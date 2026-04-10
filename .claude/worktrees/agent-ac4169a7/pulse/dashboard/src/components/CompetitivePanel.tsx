/**
 * CompetitivePanel — Game theory competitive response visualization.
 * Shows competitor response archetypes and Nash equilibrium adjustments.
 */
import { useMemo, FC } from 'react';
import { motion } from 'framer-motion';
import { Swords, Shield, Zap, Target } from 'lucide-react';
import { fmtShift } from '../lib/format';

// ─── Types ────────────────────────────────────────────────────────────────

type ResponseType = 'aggressive' | 'defensive' | 'disruptive' | 'neutral';

interface CompetitorData {
  response_type?: ResponseType;
  pool_effect?: number;
  intensity?: number;
  categories_affected?: Record<string, number>;
}

interface CompetitorInfo extends CompetitorData {
  name: string;
}

interface CompetitivePanelProps {
  competitive?: Record<string, CompetitorData>;
}

// ─── Icon & Color Maps ─────────────────────────────────────────────────────

type IconComponent = typeof Swords;

const RESPONSE_ICONS: Record<ResponseType, IconComponent> = {
  aggressive: Swords,
  defensive: Shield,
  disruptive: Zap,
  neutral: Target,
};

const RESPONSE_COLORS: Record<ResponseType, string> = {
  aggressive: '#ef4444',
  defensive: '#3b82f6',
  disruptive: '#f59e0b',
  neutral: '#6b7280',
};

// ─── CompetitivePanel ──────────────────────────────────────────────────────

const CompetitivePanel: FC<CompetitivePanelProps> = ({ competitive }) => {
  const competitors = useMemo(() => {
    if (!competitive) return [];
    return Object.entries(competitive).map(([name, data]) => ({
      name,
      ...data,
    })) as CompetitorInfo[];
  }, [competitive]);

  if (competitors.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-text-muted text-sm">
        Run a simulation to see competitive dynamics
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
        Competitive Response — Nash Equilibrium
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {competitors.map((c, i) => {
          const responseType = (c.response_type || 'neutral') as ResponseType;
          const Icon = RESPONSE_ICONS[responseType] || Target;
          const color = RESPONSE_COLORS[responseType] || '#6b7280';
          return (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/[0.02] border border-border rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}20` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{c.name}</div>
                  <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color }}>
                    {c.response_type || 'Unknown'}
                  </div>
                </div>
              </div>

              {c.pool_effect != null && (
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-text-muted">Pool Effect</span>
                  <span className={`font-mono font-medium ${
                    c.pool_effect > 0 ? 'text-expansion' : 'text-contraction'
                  }`}>
                    {fmtShift(c.pool_effect)}
                  </span>
                </div>
              )}

              {c.intensity != null && (
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-text-muted">Intensity</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(c.intensity * 100, 100)}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <span className="text-text-secondary font-mono text-[10px]">
                      {(c.intensity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              {c.categories_affected && (
                <div className="mt-2 text-[10px] text-text-muted">
                  Affects: {Object.keys(c.categories_affected).join(', ')}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CompetitivePanel;
