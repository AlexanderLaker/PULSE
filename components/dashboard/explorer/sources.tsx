/**
 * The Explorer's sources: the evidence grade as the shared chip, and a source
 * as a short linked chip coloured by its grade.
 */
import type { FC } from 'react';
import type { SourceRef, EvidenceGrade } from '@/lib/profitPoolData';
import { INK_RGB } from '@/lib/theme';
import Chip, { chipInk } from '@/components/dashboard/Chip';

// ─── Evidence grade: the shared chip, with what the grade means on hover ──
const GRADE_TITLE: Record<EvidenceGrade, string> = {
  reported: 'Reported: figure as published at the linked page',
  derived:  'Derived: arithmetic on published figures (basis stated)',
  estimate: 'Estimate: structured judgment (basis stated)',
};

export const GradeChip: FC<{ grade: EvidenceGrade }> = ({ grade }) => (
  <Chip kind={grade} title={GRADE_TITLE[grade]} compact />
);

// ─── Compact source chip: "Name (value)" hyperlink, coloured by grade ──
// A source label reads "Source: figure" (lib/profitPoolData.ts); the chip
// keeps a short source name and the first figure in the label.
const SRC_VALUE_RE = /~?[€$£]?\s?\d[\d.,]*\s?(?:bn\b|m\b|%)/i;
export function sourceParts(src: SourceRef): { name: string; value: string } {
  const head = src.label.split(': ')[0];
  const name = head
    .replace(/\s+FY?\d{2,4}.*$/i, '')                          // drop "FY2025 …" onward
    .replace(/\s*~?[€$£]?\d[\d.,]*\s?(?:bn\b|m\b|%).*$/i, '')  // drop a trailing figure
    .replace(/\s*\(.*$/, '')                                    // drop a trailing "( …"
    .replace(/\s*&\s*Company$/i, '')                            // "Kline & Company" → "Kline"
    .trim();
  const m = src.label.match(SRC_VALUE_RE);
  return { name: name || head, value: m ? m[0].replace(/\s+/g, '') : '' };
}

// Each source tagged by the list it comes from (revenue/size or GP1 margin), deduplicated by URL.
export function taggedSources(
  revenue: SourceRef[], margin: SourceRef[],
): { src: SourceRef; kind: 'Revenue' | 'GP1' }[] {
  const seen = new Set<string>();
  const out: { src: SourceRef; kind: 'Revenue' | 'GP1' }[] = [];
  revenue.forEach((s) => { if (!seen.has(s.url)) { seen.add(s.url); out.push({ src: s, kind: 'Revenue' }); } });
  margin.forEach((s) => { if (!seen.has(s.url)) { seen.add(s.url); out.push({ src: s, kind: 'GP1' }); } });
  return out;
}

export const SourceChip: FC<{ src: SourceRef; kind: 'Revenue' | 'GP1' }> = ({ src, kind }) => {
  const { name, value } = sourceParts(src);
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      // The hover carries the full derivation: a triangulated category size
      // has to show how it was derived, because Passport's own values are
      // licence-restricted.
      title={src.detail ? `${src.label}\n\nHow this was derived: ${src.detail}` : src.label}
      style={{
        fontSize: 11, fontWeight: 600, color: chipInk(src.grade),
        textDecoration: 'underline', textDecorationColor: `rgba(${INK_RGB}, 0.25)`,
        textUnderlineOffset: 2, whiteSpace: 'nowrap',
      }}
    >
      {value ? `${name} (${kind}: ${value})` : name}
    </a>
  );
};
