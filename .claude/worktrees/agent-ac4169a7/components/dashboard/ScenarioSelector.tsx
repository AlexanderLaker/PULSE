/**
 * ScenarioSelector — Dropdown + scenario cards for quick switching.
 */
import { useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, Zap, AlertTriangle, Leaf, Shield, Skull, Sun } from 'lucide-react';
import type { Scenario, ScenarioId } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  activeScenario: ScenarioId;
  setActiveScenario: (id: ScenarioId) => void;
  onSimulate: () => void;
  simulating: boolean;
}

// ─── Icon Map ─────────────────────────────────────────────────────────────

type IconComponent = typeof Play;

const SCENARIO_ICONS: Record<ScenarioId, IconComponent> = {
  base: Play,
  green_squeeze: Leaf,
  tech_disruption: Zap,
  price_war: AlertTriangle,
  regulatory_cascade: Shield,
  regulatory_relief: Shield,
  perfect_storm: Skull,
  blue_sky: Sun,
};

// ─── ScenarioSelector ─────────────────────────────────────────────────────

const ScenarioSelector: FC<ScenarioSelectorProps> = ({
  scenarios,
  activeScenario,
  setActiveScenario,
  onSimulate,
  simulating
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const active = scenarios.find(s => s.id === activeScenario);

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        {/* Scenario dropdown */}
        <button
          onClick={() => setOpen(!open)}
          className="glass-card px-4 py-2.5 flex items-center gap-2 text-sm text-text-primary hover:border-border-active transition-all"
        >
          <span className="text-accent text-xs font-medium uppercase tracking-wider">Scenario:</span>
          <span className="font-medium">{active?.name || activeScenario}</span>
          <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Simulate button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSimulate()}
          disabled={simulating}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            simulating
              ? 'bg-accent/30 text-text-muted cursor-wait'
              : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
          }`}
        >
          {simulating ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
              Simulating…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Play size={14} />
              Run Simulation
            </span>
          )}
        </motion.button>
      </div>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 z-50 bg-bg-card border border-border-active rounded-2xl p-2 shadow-2xl min-w-[360px] max-h-[400px] overflow-y-auto"
          >
            {scenarios.map(s => {
              const Icon = SCENARIO_ICONS[s.id as ScenarioId] || Play;
              const isActive = s.id === activeScenario;
              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveScenario(s.id as ScenarioId); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-start gap-3 transition-all ${
                    isActive ? 'bg-accent/15 border border-accent/30' : 'hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-accent mt-0.5' : 'text-text-muted mt-0.5'} />
                  <div>
                    <div className={`text-sm font-medium ${isActive ? 'text-accent' : 'text-text-primary'}`}>
                      {s.name}
                    </div>
                    {s.description && (
                      <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        {s.description}
                      </div>
                    )}
                    {s.shocks && Object.keys(s.shocks).length > 0 && (
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {Object.entries(s.shocks).map(([force, mag]) => {
                          const magnitude = mag as number;
                          return (
                            <span key={force} className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${
                              magnitude > 0 ? 'bg-expansion/12 text-expansion' : 'bg-contraction/12 text-contraction'
                            }`}>
                              {force}: {magnitude > 0 ? '+' : ''}{(magnitude * 100).toFixed(0)}%
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScenarioSelector;
