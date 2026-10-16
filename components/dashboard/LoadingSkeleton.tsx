/**
 * Shimmer placeholders. FullPageSkeleton sketches the dashboard shell (top
 * nav and a page) while Clerk starts up; PaneSkeleton sketches a page alone
 * (header, headline tiles, a card) under the real navigation while the code
 * of the Consumer Journey or the Explorer loads on its first visit.
 */

import { S, SHADOW } from '@/lib/theme';

const shimmer = `linear-gradient(90deg, ${S.surfaceLow} 0%, ${S.surfaceHigh} 50%, ${S.surfaceLow} 100%)`;

/** One shimmering bar. `width` may be a percentage, capped by `maxWidth`, so
 *  a bar never runs past a phone's screen. */
function SkeletonBase({
  width = '100%', maxWidth, height = 16, borderRadius = 8,
}: { width?: string | number; maxWidth?: string | number; height?: string | number; borderRadius?: string | number }) {
  return (
    <div style={{ width, maxWidth, height, borderRadius, background: shimmer,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' }} />
  );
}

const SHIMMER_KEYFRAMES = '@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';

export function FullPageSkeleton() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: S.bg }}>
      {/* Top nav (the shimmer's keyframes come with the page below) */}
      <div className="px-4 md:px-8" style={{ height: 64, backgroundColor: S.glass, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, minWidth: 0 }}>
          <SkeletonBase width={96} height={24} borderRadius={6} />
          {/* The tabs: in the top bar from lg up, behind the menu below it. */}
          <div className="hidden lg:flex" style={{ gap: 24 }}>
            <SkeletonBase width={64} height={14} />
            <SkeletonBase width={120} height={14} />
            <SkeletonBase width={170} height={14} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="hidden md:block"><SkeletonBase width={160} height={14} /></div>
          <SkeletonBase width={88} height={30} borderRadius={999} />
        </div>
      </div>

      <PaneSkeleton />
    </div>
  );
}

/** A page being loaded: its header, headline tiles and a card. */
export function PaneSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ backgroundColor: S.bg }}>
      <style>{SHIMMER_KEYFRAMES}</style>
      <div className="px-4 py-6 md:px-8 md:py-10" style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ borderLeft: `4px solid ${S.primaryContainer}`, paddingLeft: 20, marginBottom: 32 }}>
          <SkeletonBase width="60%" maxWidth={220} height={11} />
          <div style={{ height: 12 }} />
          <SkeletonBase width="90%" maxWidth={420} height={36} borderRadius={10} />
          <div style={{ height: 12 }} />
          <SkeletonBase width="100%" maxWidth={560} height={14} />
        </div>

        {/* Three headline tiles, as the pages lay them out: each takes a share of the row and
            wraps under the others when the row is too narrow. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 200px))', gap: 12, marginBottom: 32 }}>
          <SkeletonBase height={104} borderRadius={16} />
          <SkeletonBase height={104} borderRadius={16} />
          <SkeletonBase height={104} borderRadius={16} />
        </div>

        <div className="p-4 md:p-6" style={{ backgroundColor: S.surface, borderRadius: 16,
          boxShadow: SHADOW.card,
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonBase key={i} height={22} borderRadius={6} />
          ))}
        </div>
      </div>
    </div>
  );
}
