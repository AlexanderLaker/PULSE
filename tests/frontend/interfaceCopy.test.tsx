// @vitest-environment jsdom
/**
 * Rules for everything a person reads in the dashboard.
 *
 *   1. The modelled item is a driver ("Profit Pool Drivers" in full, "Drivers"
 *      in menus and headers). A static sweep over every string literal,
 *      template chunk and JSX text of the interface code (app/, components/,
 *      hooks/, lib/, api/) finds no "trend" or "trends", apart from
 *      third-party names. The authored journey content may use the word in
 *      its ordinary sense (a fashion trend), so data/ is not swept.
 *   2. No em dash in any dashboard source, content, copy or comment.
 *   3. Render checks on the entry gate and the Drivers page: the labels are
 *      there and no readable text or accessible attribute says trend.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { makeDriver, makeStore } from './fixtures/prism';

const REPO = path.resolve(__dirname, '..', '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'api', 'types', 'data', 'tests/frontend'];
const COPY_DIRS = ['app', 'components', 'hooks', 'lib', 'api'];
const WORD = /\btrends?\b/i;
const EM_DASH = String.fromCharCode(0x2014);

/** Whole string literals that may contain the word: third-party names only. */
const ALLOWED: RegExp[] = [
  /^trends\.google$/,   // source-domain detection
  /^Google Trends$/,    // a third-party product
];

function sourceFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|css)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
    }
  };
  dirs.forEach((d) => walk(path.join(REPO, d)));
  return out;
}

function trendStrings(file: string, src = fs.readFileSync(file, 'utf8')): string[] {
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

describe('the driver vocabulary', () => {
  it('no string a person can read says trend', () => {
    const files = sourceFiles(COPY_DIRS).filter((f) => !f.endsWith('.css'));
    expect(files.length).toBeGreaterThan(25);
    expect(files.flatMap((f) => trendStrings(f))).toEqual([]);
  });

  it('the sweep catches readable strings and spares identifiers', () => {
    const probe = [
      "import { TrendingUp } from 'lucide-react';",
      "const TABS = [{ id: 'drivers', label: 'Trends' }];",
      'export const P = () => <span title="Open the trend">Megatrend context</span>;',
    ].join('\n');
    const hits = trendStrings(path.join(REPO, 'components', 'probe.tsx'), probe);
    expect(hits.map((h) => h.replace(/^.*? /, ''))).toEqual(['"Trends"', '"Open the trend"']);
  });

  it('the top navigation names the page "Drivers"', () => {
    const page = fs.readFileSync(path.join(REPO, 'app', 'dashboard', 'page.tsx'), 'utf8');
    expect(page).toMatch(/\{ id: 'drivers', label: 'Drivers' \}/);
  });
});

describe('typography', () => {
  it('no dashboard file contains an em dash', () => {
    const offenders = sourceFiles(SOURCE_DIRS)
      .filter((f) => fs.readFileSync(f, 'utf8').includes(EM_DASH))
      .map((f) => path.relative(REPO, f));
    expect(offenders).toEqual([]);
  });
});

// ─── Rendered surfaces ─────────────────────────────────────────────────────

const STORE = vi.hoisted(() => ({ store: {} as unknown }));

vi.mock('@/hooks/usePrism', () => ({
  __esModule: true,
  default: () => STORE.store,
  PrismProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/api/client', () => ({
  getDriverProposals: vi.fn(async () => null),
  saveMyProposal: vi.fn(async () => null),
}));

import HomeGate from '@/components/dashboard/HomeGate';
import Drivers from '@/components/dashboard/Drivers';

const TWO_DRIVERS = [
  makeDriver(),
  makeDriver({ id: 'government_r04', name: 'Packaging regulation cost stack', force: 'Government' }),
];

afterEach(() => cleanup());

/** Every text a person can read or hear: text nodes and the accessible attributes. */
function readableText(root: HTMLElement): string {
  const attributes = Array.from(root.querySelectorAll('[aria-label], [title], [placeholder], [alt]'))
    .flatMap((el) => ['aria-label', 'title', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? ''));
  return [root.textContent ?? '', ...attributes].join(' \n ');
}

describe('rendered surfaces', () => {
  it('the entry gate: the door says Drivers and counts them', () => {
    STORE.store = makeStore({ drivers: TWO_DRIVERS, simulation: null });
    const { container } = render(<HomeGate active onNavigate={() => {}} />);
    expect(screen.getByRole('button', { name: /^Drivers, the input\. 2 drivers: the evidence\./ })).toBeTruthy();
    expect(container.textContent).toContain('2 drivers: the evidence.');
    expect(readableText(container)).not.toMatch(WORD);
  });

  it('the Drivers page: header, search, mode tab and column say driver', () => {
    STORE.store = makeStore({ drivers: TWO_DRIVERS });
    const { container } = render(<Drivers />);
    expect(container.textContent).toContain("The 2 Profit Pool Drivers behind each category's shift to 2035.");
    expect(screen.getByPlaceholderText('Search drivers…')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Driver List/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Sort by Driver/ })).toBeTruthy();
    expect(readableText(container)).not.toMatch(WORD);
  });

  it('the Drivers page before the drivers arrive does not say "The 0"', () => {
    STORE.store = makeStore({ drivers: [] });
    const { container } = render(<Drivers />);
    expect(container.textContent).toContain("The Profit Pool Drivers behind each category's shift to 2035.");
    expect(container.textContent).not.toMatch(/The 0 /);
  });
});
