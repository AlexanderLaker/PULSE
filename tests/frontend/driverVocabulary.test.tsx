// @vitest-environment jsdom
/**
 * Driver vocabulary lock (owner ruling O15, 2026-09-16).
 *
 * The owner renamed the modelled items: "Profit Pool Drivers" in full,
 * "Drivers" in menus, headers and overviews. Code identifiers keep `trend`
 * (the Trend types, the `trends-2` pane id, the /trends API routes, the
 * database), so the lock looks only at what a person can read:
 *
 *   1. a static sweep over every string literal, template chunk and JSX
 *      text in the interface sources: no "trend" / "trends" in any
 *      user-facing string, apart from an explicit allowlist of identifiers
 *      and third-party names;
 *   2. render checks on the Drivers page and the entry gate: the new labels
 *      are there, and no rendered text or accessible attribute says trend.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO = path.resolve(__dirname, '..', '..');
const UI_DIRS = ['app', 'components', 'hooks', 'lib', 'api'];
const WORD = /\btrends?\b/i;

/** String nodes that may keep the word: identifiers and third-party names,
 *  never copy. Each entry matches the WHOLE literal text. */
const ALLOWED: RegExp[] = [
  /^trends-2$/,                          // keep-alive pane id (page.tsx, HomeGate)
  /^\/api\/v1\/trends\/$/,               // backend route (admin proxy)
  /^\[\/api\/trends\/:id PUT\] error:$/, // server-side console tag
  /^\/trends\/?$/,                       // api/client.ts route templates
  /^trends\.google$/,                    // source-domain detection
  /^Google Trends$/,                     // third-party product name
];

function uiFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
    }
  };
  UI_DIRS.forEach((d) => walk(path.join(REPO, d)));
  return out;
}

function userFacingTrendStrings(file: string, src = fs.readFileSync(file, 'utf8')): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      const isModule = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)
        || (ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword));
      const isKey = p && ts.isPropertyAssignment(p) && p.name === node;
      if (!isModule && !isKey) text = node.text;
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      text = node.text;
    } else if (ts.isJsxText(node)) {
      text = node.getText();
    }
    if (text !== null && WORD.test(text) && !ALLOWED.some((re) => re.test(text!.trim()))) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      hits.push(`${path.relative(REPO, file)}:${line + 1} ${JSON.stringify(text.trim().slice(0, 120))}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('O15 driver vocabulary: static sweep of interface strings', () => {
  it('no user-facing string in app/, components/, hooks/, lib/ or api/ says trend', () => {
    const files = uiFiles();
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.flatMap((f) => userFacingTrendStrings(f));
    expect(offenders).toEqual([]);
  });

  it('the top nav names the input page "Drivers"', () => {
    const page = fs.readFileSync(path.join(REPO, 'app', 'dashboard', 'page.tsx'), 'utf8');
    expect(page).toMatch(/\{ id: 'trends-2',\s+label: 'Drivers' \}/);
  });

  it('the sweep itself catches user-facing trend strings and spares identifiers', () => {
    const probe = [
      "import { TrendingUp } from 'lucide-react';",
      "const TABS = [{ id: 'trends-2', label: 'Trends' }];",
      "export const P = () => <span title=\"Open the trend\" data-k={TABS[0].id}>Megatrend context</span>;",
    ].join('\n');
    const hits = userFacingTrendStrings(path.join(REPO, 'components', 'probe.tsx'), probe);
    expect(hits.map((h) => h.replace(/^.*? /, ''))).toEqual(['"Trends"', '"Open the trend"']);
  });
});

// ─── Render checks ───────────────────────────────────────────────────────
const STORE = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/api/client', () => ({
  getDiagnostics: vi.fn(async () => ({ db_reachable: true, simulation_run_count: 1 })),
  getTrendProposals: vi.fn(async () => null),
  saveMyProposal: vi.fn(async () => null),
  updateTrend: vi.fn(),
}));

import HomeGate from '@/components/dashboard/HomeGate';
import Trends2 from '@/components/dashboard/Trends2';

const driver = {
  id: 'consumer_r01', name: 'Private label structural penetration', force: 'Consumer',
  direction: 'Contraction', probability: 5, confidence: 'High',
  description: 'Retailer brands keep gaining share.', normalized_score: -0.03, gp1_shift: -0.03,
  category_exposure: { 'Hair: Color': 3 }, regional_exposure: { Europe: 5 }, vc_exposure: {},
  source_type: 'seed', data_source: 's',
};

STORE.store = {
  health: { status: 'ok', version: 'test', has_simulation: true },
  trends: [driver, { ...driver, id: 'government_r04', name: 'Packaging regulation cost stack', force: 'Government' }],
  simulation: null,
  config: {},
  loading: false, error: null, backendAvailable: true, connectionState: 'connected',
  updateTrend: vi.fn(), reload: vi.fn(), reconnect: vi.fn(),
};

afterEach(() => cleanup());

/** Every piece of text a person can read or hear: text nodes plus the
 *  accessible attributes. */
function readableText(root: HTMLElement): string {
  const attrs = Array.from(root.querySelectorAll('[aria-label], [title], [placeholder], [alt]'))
    .flatMap((el) => ['aria-label', 'title', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? ''));
  return [root.textContent ?? '', ...attrs].join(' \n ');
}

describe('O15 driver vocabulary: rendered surfaces', () => {
  it('entry gate: the door says Drivers, nothing says trend', () => {
    const { container } = render(<HomeGate active onNavigate={() => {}} />);
    expect(screen.getByRole('button', { name: /^Drivers — the input\. 2 drivers, the evidence\./ })).toBeTruthy();
    expect(container.textContent).toContain('2 drivers — the evidence.');
    expect(readableText(container)).not.toMatch(WORD);
  });

  it('Drivers page: header, search, mode tab and column say driver, nothing says trend', () => {
    const { container } = render(<Trends2 />);
    expect(container.textContent).toContain('Drivers');
    expect(container.textContent).toContain("The 2 Profit Pool Drivers behind each category's shift to 2035.");
    expect(screen.getByPlaceholderText('Search drivers…')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Driver List/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Sort by Driver/ })).toBeTruthy();
    expect(readableText(container)).not.toMatch(WORD);
  });

  it('Drivers page before the drivers load: no "The 0 Profit Pool Drivers"', () => {
    const loaded = STORE.store.trends;
    STORE.store.trends = [];
    try {
      const { container } = render(<Trends2 />);
      expect(container.textContent).toContain("The Profit Pool Drivers behind each category's shift to 2035.");
      expect(container.textContent).not.toMatch(/The 0 /);
    } finally {
      STORE.store.trends = loaded;
    }
  });
});
