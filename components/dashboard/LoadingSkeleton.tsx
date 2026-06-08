/**
 * LoadingSkeleton — shimmer placeholder shown while Clerk hydrates.
 *
 * June 2026: rewritten to sketch the ACTUAL shell (top nav + editorial
 * header + headline tiles + matrix card) in the maritime palette. The
 * previous version mimicked the decommissioned v1 dashboard (KPI band /
 * timeline / waterfall) in the old Apple palette.
 */

import React from 'react';

const shimmer = 'linear-gradient(90deg, #eff4ff 0%, #dce9ff 50%, #eff4ff 100%)';

function SkeletonBase({
  width = '100%', height = 16, borderRadius = 8,
}: { width?: string | number; height?: string | number; borderRadius?: string | number }) {
  return (
    <div style={{ width, height, borderRadius, background: shimmer,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' }} />
  );
}

/** Full-page skeleton mirroring the live shell: nav, header, matrix card. */
export function FullPageSkeleton() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9ff' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {/* Top nav */}
      <div style={{ height: 64, backgroundColor: 'rgba(255,255,255,0.75)', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <SkeletonBase width={96} height={24} borderRadius={6} />
          <div style={{ display: 'flex', gap: 24 }}>
            <SkeletonBase width={64} height={14} />
            <SkeletonBase width={120} height={14} />
            <SkeletonBase width={170} height={14} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonBase width={160} height={14} />
          <SkeletonBase width={88} height={30} borderRadius={999} />
        </div>
      </div>

      {/* Editorial header + headline tiles + matrix card */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ borderLeft: '4px solid #d6e3ff', paddingLeft: 20, marginBottom: 32 }}>
          <SkeletonBase width={220} height={11} />
          <div style={{ height: 12 }} />
          <SkeletonBase width={420} height={36} borderRadius={10} />
          <div style={{ height: 12 }} />
          <SkeletonBase width={560} height={14} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          <SkeletonBase width={200} height={104} borderRadius={16} />
          <SkeletonBase width={200} height={104} borderRadius={16} />
          <SkeletonBase width={200} height={104} borderRadius={16} />
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 24,
          boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonBase key={i} height={22} borderRadius={6} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SkeletonBase;
