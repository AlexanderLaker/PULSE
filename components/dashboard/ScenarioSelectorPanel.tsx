/**
 * ScenarioSelectorPanel — Scenario selection and custom scenario builder
 * Extracted from WarRoom for modularity
 */

import { FC } from 'react';
import { motion } from 'framer-motion';
import { T } from '@/lib/format';
import type { ScenarioId } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface DefaultScenario {
  id: ScenarioId;
  label: string;
  icon: string;
}

interface ScenarioSelectorPanelProps {
  activeScenario: ScenarioId;
  scenarios?: Array<{ id: ScenarioId; label: string; icon?: string }>;
  onScenarioChange?: (id: ScenarioId) => void;
  onCustomScenario?: () => void;
}

// ─── ScenarioSelectorPanel ────────────────────────────────────────────────

const ScenarioSelectorPanel: FC<ScenarioSelectorPanelProps> = ({
  activeScenario,
  scenarios = [],
  onScenarioChange = () => {},
  onCustomScenario = () => {},
}) => {
  const defaultScenarios: DefaultScenario[] = [
    { id: 'base', label: 'Base Case', icon: '📊' },
    { id: 'green_squeeze', label: 'Green Squeeze', icon: '🌱' },
    { id: 'tech_disruption', label: 'Tech Disruption', icon: '⚡' },
    { id: 'price_war', label: 'Price War', icon: '💥' },
    { id: 'regulatory_cascade', label: 'Regulatory Cascade', icon: '📜' },
    { id: 'perfect_storm', label: 'Perfect Storm', icon: '🌪' },
  ];

  const allScenarios = [
    ...defaultScenarios,
    ...scenarios.map(s => ({
      id: s.id,
      label: s.label,
      icon: s.icon || '📋',
    })),
  ];

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
      <h3
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: T.text,
          margin: 0,
        }}
      >
        Scenario Selection
      </h3>

      {/* Scenario Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        {allScenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => onScenarioChange(scenario.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 16,
              backgroundColor: activeScenario === scenario.id ? T.accentDim : T.bg3,
              border: `2px solid ${
                activeScenario === scenario.id ? T.accent : T.border
              }`,
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (activeScenario !== scenario.id) {
                e.currentTarget.style.backgroundColor = T.bg4;
                e.currentTarget.style.borderColor = T.border2;
              }
            }}
            onMouseLeave={(e) => {
              if (activeScenario !== scenario.id) {
                e.currentTarget.style.backgroundColor = T.bg3;
                e.currentTarget.style.borderColor = T.border;
              }
            }}
          >
            <span style={{ fontSize: 20 }}>{scenario.icon}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: activeScenario === scenario.id ? T.accent : T.text,
                textAlign: 'center',
              }}
            >
              {scenario.label}
            </span>
          </button>
        ))}
      </div>

      {/* Custom Scenario Button */}
      <button
        onClick={onCustomScenario}
        style={{
          padding: '12px 16px',
          backgroundColor: T.bg3,
          border: `1px dashed ${T.border2}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          color: T.text2,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = T.bg4;
          e.currentTarget.style.color = T.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = T.bg3;
          e.currentTarget.style.color = T.text2;
        }}
      >
        + Create Custom Scenario
      </button>
    </motion.div>
  );
};

export default ScenarioSelectorPanel;
