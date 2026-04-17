/**
 * Generates 43 branded placeholder JPGs for the Innovation Explorer.
 *
 * Parses data/innovations.ts, extracts each entry's imageGradient /
 * imageAccent / number / categoryShort / name, and rasterizes a branded
 * SVG card to public/images/innovations/inn_XX.jpg via sharp.
 *
 * These serve as repo-committed, CDN-cached fallbacks until real
 * Unsplash photography is bootstrapped from a machine with outbound
 * internet access (see public/images/innovations/README.md).
 */

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'data', 'innovations.ts');
const OUT_DIR = join(ROOT, 'public', 'images', 'innovations');

const WIDTH = 800;
const HEIGHT = 600;

// --- Parse innovations.ts ---------------------------------------------------

function parseInnovations() {
  const text = readFileSync(SRC, 'utf8');
  // Split on id:'inn_ boundaries to isolate each record.
  const chunks = text.split(/\bid:\s*'inn_/);
  const out = [];
  for (let i = 1; i < chunks.length; i++) {
    const body = chunks[i];
    const idMatch = body.match(/^(\d{2,3})'/);
    if (!idMatch) continue;
    const id = `inn_${idMatch[1]}`;
    const numberMatch = body.match(/number:\s*(\d+)/);
    const nameMatch = body.match(/name:\s*'([^']+)'/);
    const catMatch = body.match(/categoryShort:\s*'([^']+)'/);
    const gradMatch = body.match(/imageGradient:\s*'([^']+)'/);
    const accMatch = body.match(/imageAccent:\s*'([^']+)'/);
    if (!gradMatch || !accMatch) continue;
    out.push({
      id,
      number: numberMatch ? parseInt(numberMatch[1], 10) : 0,
      name: nameMatch ? nameMatch[1] : '',
      categoryShort: catMatch ? catMatch[1] : '',
      imageGradient: gradMatch[1],
      imageAccent: accMatch[1],
    });
  }
  return out;
}

// --- Gradient helper --------------------------------------------------------

/**
 * Converts a CSS `linear-gradient(135deg, #aaa 0%, #bbb 100%)` string into
 * the pieces we need to emit an SVG <linearGradient>.
 */
function parseGradient(css) {
  const angleMatch = css.match(/linear-gradient\(\s*(\d+)deg\s*,/);
  const angle = angleMatch ? parseInt(angleMatch[1], 10) : 135;
  const stopRe = /(#[0-9a-fA-F]{3,8})\s+(\d+)%/g;
  const stops = [];
  let m;
  while ((m = stopRe.exec(css)) !== null) {
    stops.push({ color: m[1], offset: parseInt(m[2], 10) });
  }
  if (stops.length < 2) {
    stops.push({ color: '#1e293b', offset: 0 });
    stops.push({ color: '#0f172a', offset: 100 });
  }
  // Convert CSS angle (0deg = up) to SVG vector on a unit square.
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = 0.5, cy = 0.5;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  return {
    x1: cx - dx,
    y1: cy - dy,
    x2: cx + dx,
    y2: cy + dy,
    stops,
  };
}

// --- SVG builder ------------------------------------------------------------

function svgFor(inn) {
  const g = parseGradient(inn.imageGradient);
  const accent = inn.imageAccent;
  const num = String(inn.number).padStart(2, '0');
  const tag = (inn.categoryShort || '').toUpperCase();

  const stopsXml = g.stops
    .map(
      (s) =>
        `<stop offset="${s.offset}%" stop-color="${s.color}" />`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">
      ${stopsXml}
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
      <stop offset="60%" stop-color="${accent}" stop-opacity="0.10" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="dim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45" />
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect width="100%" height="100%" fill="url(#glow)" />

  <!-- Subtle grid lines for editorial texture -->
  <g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1">
    <line x1="0" y1="150" x2="${WIDTH}" y2="150" />
    <line x1="0" y1="300" x2="${WIDTH}" y2="300" />
    <line x1="0" y1="450" x2="${WIDTH}" y2="450" />
    <line x1="200" y1="0" x2="200" y2="${HEIGHT}" />
    <line x1="400" y1="0" x2="400" y2="${HEIGHT}" />
    <line x1="600" y1="0" x2="600" y2="${HEIGHT}" />
  </g>

  <!-- Large numeric mark -->
  <text x="60" y="${HEIGHT - 80}"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-size="280" font-weight="700"
        fill="#ffffff" fill-opacity="0.92"
        letter-spacing="-12">${num}</text>

  <!-- Category tag -->
  <text x="62" y="90"
        font-family="'JetBrains Mono', 'SF Mono', Menlo, monospace"
        font-size="18" font-weight="600"
        fill="#ffffff" fill-opacity="0.85"
        letter-spacing="4">${tag}</text>

  <!-- Accent bar -->
  <rect x="60" y="110" width="64" height="3" fill="${accent}" />

  <rect width="100%" height="100%" fill="url(#dim)" />
</svg>`;
}

// --- Main -------------------------------------------------------------------

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const innovations = parseInnovations();
  console.log(`Parsed ${innovations.length} innovations from data/innovations.ts`);

  let written = 0;
  for (const inn of innovations) {
    const outPath = join(OUT_DIR, `${inn.id}.jpg`);
    const svg = svgFor(inn);
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outPath);
    written++;
    if (written % 10 === 0 || written === innovations.length) {
      console.log(`  [${written}/${innovations.length}] wrote ${inn.id}.jpg`);
    }
  }
  console.log(`\nDone. ${written} placeholder JPGs written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
