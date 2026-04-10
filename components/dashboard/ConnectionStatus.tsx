/**
 * Connection Status Indicator
 * Shows real-time backend connection status in the Profit Pool Shift Model header.
 * Displays: Connected (green), Reconnecting (amber), or Offline (red).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw, AlertCircle } from 'lucide-react';
import { T } from '@/lib/format';

interface ConnectionStatusProps {
  state: 'connected' | 'reconnecting' | 'offline';
  onReconnect: () => void;
}

export default function ConnectionStatus({ state, onReconnect }: ConnectionStatusProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleReconnectClick = async () => {
    setIsRetrying(true);
    try {
      await onReconnect();
    } finally {
      setIsRetrying(false);
    }
  };

  // Determine styling based on state
  const statusConfig = {
    connected: {
      dot: T.green,
      label: 'Connected',
      icon: null,
      description: 'Backend is live',
    },
    reconnecting: {
      dot: T.amber,
      label: 'Reconnecting...',
      icon: RotateCw,
      description: 'Attempting to connect',
    },
    offline: {
      dot: T.red,
      label: 'Offline',
      icon: AlertCircle,
      description: 'Using local mock data',
    },
  };

  const config = statusConfig[state];
  const IconComponent = config.icon;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        border: `1px solid ${T.border1}`,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: T.sans,
        color: T.text2,
        cursor: state === 'offline' ? 'pointer' : 'default',
      }}
      role="status"
      aria-label={`Backend status: ${config.label}`}
      title={config.description}
      onClick={state === 'offline' ? handleReconnectClick : undefined}
    >
      {/* Status Dot */}
      <motion.div
        animate={state === 'reconnecting' ? { scale: [1, 1.2, 1] } : {}}
        transition={
          state === 'reconnecting'
            ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }
            : {}
        }
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: config.dot,
          flexShrink: 0,
        }}
      />

      {/* Label */}
      <span>{config.label}</span>

      {/* Icon (Reconnecting or Offline) */}
      <AnimatePresence>
        {IconComponent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            {state === 'reconnecting' ? (
              <IconComponent
                size={14}
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              />
            ) : (
              <IconComponent size={14} color={config.dot} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retry button when offline */}
      {state === 'offline' && !isRetrying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            marginLeft: 4,
            fontSize: 10,
            opacity: 0.6,
          }}
        >
          (click to retry)
        </motion.div>
      )}

      {isRetrying && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <RotateCw size={14} />
        </motion.div>
      )}

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
