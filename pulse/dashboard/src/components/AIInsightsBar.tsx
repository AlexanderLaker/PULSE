/**
 * AIInsightsBar — Bottom bar showing AI-detected insights
 * Slides up to reveal details, Apple-style design, light mode
 */

import { useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, AlertTriangle, Zap, ChevronUp, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface Insight {
  title: string;
  description: string;
}

interface Trigger {
  category: string;
  condition: string;
  action: string;
  severity?: 'high' | 'medium' | 'low';
}

interface AIInsightsBarProps {
  insights?: Insight[];
  triggers?: Trigger[];
  isLoading?: boolean;
}

// ─── AIInsightsBar ────────────────────────────────────────────────────────

const AIInsightsBar: FC<AIInsightsBarProps> = ({
  insights = [],
  triggers = [],
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const totalAlerts = (insights?.length || 0) + (triggers?.length || 0);

  if (totalAlerts === 0 && !isLoading) return null;

  return (
    <>
      {/* Bar Button */}
      <motion.button
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.15)';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
          }}
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Brain size={16} color="#0071E3" />
            </motion.div>
          ) : totalAlerts > 0 ? (
            <Brain size={16} color="#0071E3" />
          ) : null}
        </div>

        {/* Text */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#1D1D1F',
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading ? 'Analyzing...' : `${totalAlerts} ${totalAlerts === 1 ? 'insight' : 'insights'}`}
        </span>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp size={16} color="#6E6E73" />
        </motion.div>
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(false)}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50vh',
                backgroundColor: 'rgba(0,0,0,0.1)',
                zIndex: 99,
              }}
            />

            {/* Details Panel */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 101,
                maxHeight: '50vh',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px 12px 0 0',
                boxShadow: '0 -10px 30px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: '#1D1D1F',
                    margin: 0,
                  }}
                >
                  AI Insights & Alerts
                </h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
                  }}
                >
                  <X size={16} color="#1D1D1F" />
                </button>
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: 24,
                }}
              >
                {/* AI Suggestions */}
                {insights && insights.length > 0 && (
                  <div>
                    <h4
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1D1D1F',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        margin: '0 0 12px 0',
                      }}
                    >
                      New Signals
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {insights.map((insight, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          style={{
                            display: 'flex',
                            gap: 12,
                            padding: 12,
                            backgroundColor: '#F5F5F7',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.06)',
                          }}
                        >
                          <Zap size={16} color="#0071E3" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#1D1D1F',
                                margin: '0 0 4px 0',
                              }}
                            >
                              {insight.title}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                color: '#6E6E73',
                                margin: 0,
                              }}
                            >
                              {insight.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trigger Alerts */}
                {triggers && triggers.length > 0 && (
                  <div>
                    <h4
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1D1D1F',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        margin: insights && insights.length > 0 ? '16px 0 12px 0' : '0 0 12px 0',
                      }}
                    >
                      Triggers Fired
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {triggers.map((trigger, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          style={{
                            display: 'flex',
                            gap: 12,
                            padding: 12,
                            backgroundColor:
                              trigger.severity === 'high'
                                ? 'rgba(255, 69, 58, 0.08)'
                                : 'rgba(255, 159, 10, 0.08)',
                            borderRadius: 8,
                            border: `1px solid ${
                              trigger.severity === 'high'
                                ? 'rgba(255, 69, 58, 0.2)'
                                : 'rgba(255, 159, 10, 0.2)'
                            }`,
                          }}
                        >
                          <AlertTriangle
                            size={16}
                            color={trigger.severity === 'high' ? '#FF453A' : '#FF9F0A'}
                            style={{ flexShrink: 0, marginTop: 2 }}
                          />
                          <div>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#1D1D1F',
                                margin: '0 0 4px 0',
                              }}
                            >
                              {trigger.category} {trigger.condition}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                color: '#6E6E73',
                                margin: 0,
                              }}
                            >
                              {trigger.action}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {(!insights || insights.length === 0) && (!triggers || triggers.length === 0) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 120,
                      color: '#6E6E73',
                      fontSize: 15,
                    }}
                  >
                    {isLoading ? 'Analyzing trends...' : 'No insights at this time'}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIInsightsBar;
