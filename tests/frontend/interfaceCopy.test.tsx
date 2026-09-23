// @vitest-environment jsdom
/**
 * Rules for everything a person reads in the dashboard.
 *
 *   1. The modelled item is a driver ("Profit Pool Drivers" in full, "Drivers"
 *      in menus and headers). A static sweep over every string literal,
 *      template chunk and JSX text of the interface code (app/, components/,
 *      hooks/, lib/) finds no "trend" or "trends". The authored journey
 *      content may use the word in its ordinary sense (a fashion trend), so
 *      data/ is not swept.
 *   2. No em dash in any dashboard source, content, copy or comment.
 *   3. British spelling in every readable string of the interface code and in
 *      the journey content and driver code map (tests/spelling.json lists the
 *      American forms and the names that keep their own spelling).
 *   4. Render checks on the entry gate and the Drivers page: the labels are
 *      there and no readable text or accessible attribute says trend.
 *   5. The journey content describes the model as it is: it names the drivers
 *      behind a moment and never lists what the model leaves out.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { makeDriver, makeStore } from './fixtures/prism';

const REPO = path.resolve(__dirname, '..', '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'types', 'data', 'tests/frontend'];
const COPY_DIRS = ['app', 'components', 'hooks', 'lib'];
const WORD = /\btrends?\b/i;
const EM_DASH = String.fromCharCode(0x2014);


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

/** A string a person can read, and where it is. */
interface Readable { where: string; text: string }

/** Every string literal, template chunk and JSX text of a file, except module
 *  paths, object keys and the class names and styles of JSX elements. */
function readableStrings(file: string, src = fs.readFileSync(file, 'utf8')): Readable[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Readable[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const p = node.parent;
      const isModule = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)
        || (ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword));
      const isKey = p && ts.isPropertyAssignment(p) && p.name === node;
      const isStyling = p && ts.isJsxAttribute(p) && ['className', 'style'].includes(p.name.getText());
      if (!isModule && !isKey && !isStyling) text = node.text;
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      text = node.text;
    } else if (ts.isJsxText(node)) {
      text = node.getText();
    }
    if (text !== null) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      out.push({ where: `${path.relative(REPO, file)}:${line + 1}`, text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function readableMentions(file: string, src = fs.readFileSync(file, 'utf8')): string[] {
  return readableStrings(file, src)
    .filter((r) => WORD.test(r.text))
    .map((r) => `${r.where} ${JSON.stringify(r.text.trim().slice(0, 120))}`);
}

// ─── British spelling ──────────────────────────────────────────────────────
const SPELLING = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'spelling.json'), 'utf8')) as {
  american: string[]; names: string[];
};
const AMERICAN = SPELLING.american.map((p) => new RegExp(p, 'gi'));
// A class list or a style value is not copy: every word of it is a class or a
// CSS token ("items-center", "background-color 0.15s ease, color 0.15s ease").
const STYLE_TOKEN = new RegExp('^(?:[\\w.[\\]/%#()]*[-:][\\w.[\\]/%#:()-]*|\\d[\\w.%]*'
  + '|ease|linear|solid|auto|none|all|color|opacity|transform'
  + '|flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|uppercase|italic|truncate)$');
const isStyling = (text: string): boolean => text.split(/[\s,]+/).filter(Boolean).every((t) => STYLE_TOKEN.test(t));

/** The American forms in one readable string: a string of several words,
 *  without its links and the names that keep their own spelling. */
function americanForms(text: string): string[] {
  if (!/\s/.test(text.trim()) || isStyling(text)) return [];
  let prose = text.replace(/https?:\/\/\S+/g, ' ');
  for (const name of SPELLING.names) prose = prose.split(name).join(' ');
  return AMERICAN.flatMap((rx) => prose.match(rx) ?? []);
}

describe('the driver vocabulary', () => {
  it('no string a person can read says trend', () => {
    const files = sourceFiles(COPY_DIRS).filter((f) => !f.endsWith('.css'));
    expect(files.length).toBeGreaterThan(25);
    expect(files.flatMap((f) => readableMentions(f))).toEqual([]);
  });

  it('the sweep catches readable strings and spares identifiers', () => {
    const probe = [
      "import { TrendingUp } from 'lucide-react';",
      "const TABS = [{ id: 'drivers', label: 'Trends' }];",
      'export const P = () => <span title="Open the trend">Megatrend context</span>;',
    ].join('\n');
    const hits = readableMentions(path.join(REPO, 'components', 'probe.tsx'), probe);
    expect(hits.map((h) => h.replace(/^.*? /, ''))).toEqual(['"Trends"', '"Open the trend"']);
  });

  it('the top navigation names the page "Drivers"', () => {
    const page = fs.readFileSync(path.join(REPO, 'app', 'dashboard', 'page.tsx'), 'utf8');
    expect(page).toMatch(/\{ id: 'drivers', label: 'Drivers' \}/);
  });
});

describe('British spelling', () => {
  it('no readable string of the interface, the journey content or the driver code map spells the American way', () => {
    const files = [
      ...sourceFiles(COPY_DIRS).filter((f) => !f.endsWith('.css')),
      path.join(REPO, 'data', 'consumerJourney.ts'),
      path.join(REPO, 'data', 'driverCodeMap.ts'),
    ];
    const hits = files.flatMap((f) => readableStrings(f).flatMap((r) => {
      const forms = americanForms(r.text);
      return forms.length ? [`${r.where} ${forms.join(', ')}`] : [];
    }));
    expect(hits).toEqual([]);
  });

  it('the check finds American forms in copy and spares names, links, identifiers and styles', () => {
    expect(americanForms('Optimized cold-wash programs toward lower odor')).toEqual(
      ['odor', 'toward', 'programs', 'Optimized']);
    expect(americanForms('colour-safe care for grey hair, sized for travel')).toEqual([]);
    expect(americanForms('a range that emphasizes scent, oversized packs')).toEqual(['emphasizes']);
    expect(americanForms('Keratin Color and Color Wow at https://example.org/color-center')).toEqual([]);
    expect(americanForms('row_normalized_cell_weights')).toEqual([]);
    expect(americanForms('flex items-center justify-center')).toEqual([]);
    expect(americanForms('color 150ms ease')).toEqual([]);
    expect(americanForms('border-color 0.15s, background-color 0.15s')).toEqual([]);
  });
});

describe('the journey content', () => {
  // The content names the drivers behind each moment and never lists what the
  // model leaves out; the dialog of a tile without a driver says none is linked.
  const LEFT_OUT = /\bnot (?:a )?modell?ed\b|\bunmodell?ed\b|\bstrategist['’]s (?:read|view)\b|\bleft the model\b|\bno longer modell?ed\b/i;
  it('never says what the model leaves out', () => {
    const hits = readableStrings(path.join(REPO, 'data', 'consumerJourney.ts'))
      .filter((r) => LEFT_OUT.test(r.text))
      .map((r) => `${r.where} ${JSON.stringify(r.text.slice(0, 100))}`);
    expect(hits).toEqual([]);
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
vi.mock('@/lib/apiClient', () => ({
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
