/**
 * SegmentedControl — Apple iOS-style toggle for switching matrix views.
 * Sliding highlight with spring animation.
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { T } from '../lib/format';

export interface Segment {
  key: string;
  label: string;
  icon?: string;  // emoji
}

interface SegmentedControlProps {
  segments: Segment[];
  activeKey: string;
  onChange: (key: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  activeKey,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Measure and position the sliding indicator
  useEffect(() => {
    const btn = buttonRefs.current[activeKey];
    const container = containerRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setIndicator({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [activeKey, segments]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        background: T.bg4,
        borderRadius: 10,
        padding: 3,
        gap: 0,
      }}
    >
      {/* Sliding highlight */}
      <motion.div
        layout
        animate={{
          left: indicator.left,
          width: indicator.width,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          borderRadius: 8,
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          zIndex: 0,
        }}
      />

      {/* Segment buttons */}
      {segments.map(seg => {
        const isActive = seg.key === activeKey;
        return (
          <button
            key={seg.key}
            ref={el => { buttonRefs.current[seg.key] = el; }}
            onClick={() => onChange(seg.key)}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? T.text : T.text3,
              fontFamily: 'inherit',
              letterSpacing: -0.1,
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
              borderRadius: 8,
            } as React.CSSProperties}
          >
            {seg.icon && <span style={{ fontSize: 12 }}>{seg.icon}</span>}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
