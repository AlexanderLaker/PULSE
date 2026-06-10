/**
 * ShiftPill — Compact matrix cell matching Time Path heatmap style.
 * Uses same heatColor() background as the Heatmap component.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { T, fmtShift, shiftColorHex, heatColor } from '../lib/format';

interface ShiftPillProps {
  value: number;
  maxVal?: number;
  bold?: boolean;
  p10?: number;
  p90?: number;
}

const ShiftPill: React.FC<ShiftPillProps> = ({ value, maxVal = 0.05, bold = false, p10, p90 }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Compact pill — matches Heatmap cell style */}
      <motion.div
        whileHover={{ scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          background: heatColor(value),
          fontSize: 10,
          fontWeight: bold ? 700 : 600,
          fontFamily: T.mono,
          color: shiftColorHex(value),
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          cursor: 'default',
          fontVariantNumeric: 'tabular-nums',
        } as React.CSSProperties}
      >
        {fmtShift(value)}
      </motion.div>

      {/* Hover tooltip with p10/p90 range */}
      <AnimatePresence>
        {hovered && (p10 !== undefined || p90 !== undefined) && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 6,
              padding: '6px 10px',
              borderRadius: 8,
              background: '#1D1D1F',
              color: '#F5F5F7',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: T.mono,
              lineHeight: 1.5,
              whiteSpace: 'nowrap',
              zIndex: 100,
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
              fontVariantNumeric: 'tabular-nums',
            } as React.CSSProperties}
          >
            {/* Tooltip arrow */}
            <div
              style={{
                position: 'absolute',
                bottom: -4,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 8,
                height: 4,
                background: '#1D1D1F',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#86868B' }}>P10</span>
              <span style={{ color: shiftColorHex(p10!), fontWeight: 600 }}>{fmtShift(p10!)}</span>
              <span style={{ color: '#48484A' }}>|</span>
              <span style={{ color: '#86868B' }}>P90</span>
              <span style={{ color: shiftColorHex(p90!), fontWeight: 600 }}>{fmtShift(p90!)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShiftPill;
