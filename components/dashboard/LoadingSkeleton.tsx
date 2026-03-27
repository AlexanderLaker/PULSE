/**
 * LoadingSkeleton — Shimmer loading skeletons matching Apple design
 * Light mode, subtle animations
 */

import { motion } from 'framer-motion';
import React from 'react';

/**
 * Shimmer gradient animation
 */
const shimmerGradient = 'linear-gradient(90deg, #FFFFFF 0%, #F5F5F7 50%, #FFFFFF 100%)';

interface SkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  delay?: number;
}

function SkeletonBase({
  width = '100%',
  height = 16,
  borderRadius = 8,
  delay = 0
}: SkeletonBaseProps) {
  const skeletonStyle: React.CSSProperties = {
    width,
    height,
    borderRadius,
    background: shimmerGradient,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  };

  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 1.5,
        delay,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
      }}
      style={skeletonStyle}
    />
  );
}

/**
 * KPI Card Skeleton
 */
export function KPICardSkeleton() {
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 18,
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
    backgroundColor: '#F5F5F7',
  };

  return (
    <div style={cardStyle}>
      <SkeletonBase width={28} height={28} borderRadius={8} />
      <SkeletonBase width="80%" height={10} />
      <SkeletonBase width="60%" height={28} />
      <SkeletonBase width="90%" height={10} />
    </div>
  );
}

/**
 * Headline KPI Skeleton (4 cards)
 */
export function HeadlineKPISkeleton() {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  };

  return (
    <div style={gridStyle}>
      {[0, 1, 2, 3].map((i) => (
        <KPICardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Heatmap Cell Skeleton
 */
function HeatmapCellSkeleton() {
  return (
    <SkeletonBase
      width="100%"
      height={40}
      borderRadius={4}
      delay={Math.random() * 0.3}
    />
  );
}

/**
 * Heatmap Skeleton (grid of cells)
 */
export function HeatmapSkeleton() {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: '#FBFBFD',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  };

  const headerColumnsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    flex: 1,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  };

  const rowColumnsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    flex: 1,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <SkeletonBase width={120} height={14} />
        <div style={headerColumnsStyle}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBase key={i} width={60} height={14} />
          ))}
        </div>
      </div>

      {/* Rows */}
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} style={rowStyle}>
          <SkeletonBase width={100} height={40} />
          <div style={rowColumnsStyle}>
            {[0, 1, 2, 3, 4].map((col) => (
              <HeatmapCellSkeleton key={col} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Path Timeline Skeleton
 */
export function PathTimelineSkeleton() {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: '#FBFBFD',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
  };

  const legendStyle: React.CSSProperties = {
    display: 'flex',
    gap: 24,
  };

  return (
    <div style={containerStyle}>
      {/* Title */}
      <SkeletonBase width={200} height={16} />

      {/* Chart area */}
      <SkeletonBase width="100%" height={250} borderRadius={8} />

      {/* Legend */}
      <div style={legendStyle}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBase key={i} width={80} height={12} />
        ))}
      </div>
    </div>
  );
}

/**
 * Panel Skeleton
 */
export function PanelSkeleton() {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: '#FBFBFD',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const contentRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <SkeletonBase width={150} height={18} />
        <SkeletonBase width={24} height={24} borderRadius={6} />
      </div>

      {/* Content rows */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={contentRowStyle}>
          <SkeletonBase width="70%" height={14} />
          <SkeletonBase width="100%" height={40} borderRadius={8} />
        </div>
      ))}
    </div>
  );
}

/**
 * Full Page Skeleton
 */
export function FullPageSkeleton() {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: 24,
    backgroundColor: '#FFFFFF',
  };

  return (
    <div style={containerStyle}>
      <HeadlineKPISkeleton />
      <HeatmapSkeleton />
      <PathTimelineSkeleton />
    </div>
  );
}

export default SkeletonBase;
