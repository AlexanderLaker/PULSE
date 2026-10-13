"""Rules for every text file in the repository.

- No em dash, in code, comments, content or documents.
- None of the names the schema and code before migration 0001 used: the
  migration's folder lists them (previous_names.txt), and only that folder
  and the migration's tests may name them.
- No tracked file is executable: the scripts are run as python3 or bash
  scripts/<name>, as the documents show.
- The dashboard's colours and shadows come from lib/theme.ts (and the force
  and category palettes from lib/format.ts): a literal colour anywhere else in
  its code (a hex or rgb() value, white or black as a style value, a class of
  Tailwind's own palette) is either a token that is missing or a copy that
  will drift. Three views keep a palette of their own (COLOUR_HOMES).
- British spelling in the documents and in the drivers' own texts
  (tests/spelling.json lists the American forms and the names that keep their
  own spelling; tests/frontend/interfaceCopy.test.tsx holds the dashboard to
  the same list).
- Scripts are entry points: no script or migration imports another script.
- The tracked files pass the handover's scan for secret-shaped strings.
- README.md's configuration table and .env.example name the same variables,
  and every variable the code reads is one of them.
- The Python dependencies are pinned: every requirement of a range file
  (requirements-dev.in, api/requirements.in) has an exact version in its
  compiled file, inside the range.
- `next dev` leaves the tracked files alone (Next.js's agent rules are off).
- Every response carries the security headers of vercel.json.
"""
import ast
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".css",
                 ".sh", ".txt", ".toml", ".ini", ".example", ".html", ".svg"}
SKIP_DIRS = {"node_modules", ".git", ".next", ".vercel", "__pycache__", ".venv", "venv", ".pytest_cache",
             ".hypothesis", "runs", "archive"}
EM_DASH = chr(0x2014)

#: The names before migration 0001, and the places allowed to name them.
_NAMES_FILE = REPO / "migrations" / "0001_driver_schema" / "previous_names.txt"
PREVIOUS_NAMES = re.compile("|".join(
    line.strip() for line in _NAMES_FILE.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.startswith("#")))
MAY_NAME_THE_PREVIOUS_RELEASE = ("migrations/0001_driver_schema/", "tests/test_migration.py")

#: Where the dashboard's code may write a colour: the theme, the force and
#: category palettes, and three palettes that belong to a single view.
COLOUR_HOMES = {
    "lib/theme.ts",
    "lib/format.ts",
    "components/dashboard/HomeGate.tsx",           # the entry doors' washes
    "components/dashboard/drivers/cards.tsx",      # the source-grade chips
    "components/dashboard/explorer/PoolChart.tsx",  # the mekko's bar fills
}
LITERAL_COLOUR = re.compile(
    r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}(?=['\"`;\s])|rgba?\(\s*\d"
    # a named colour as a style value
    r"|(?:color|background|backgroundColor|fill|stroke|borderColor)\s*:\s*['\"]?(?:white|black)\b"
    # Tailwind's own palette instead of the theme's tokens (bg-white, text-slate-500, hover:bg-black/5)
    r"|(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|placeholder|accent|caret)"
    r"-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky"
    r"|blue|indigo|violet|purple|fuchsia|pink|rose)(?![\w])"
)


SPELLING = json.loads((REPO / "tests" / "spelling.json").read_text(encoding="utf-8"))
AMERICAN = [re.compile(p, re.I) for p in SPELLING["american"]]


def american_forms(text: str) -> list:
    """The American forms in a text, without its links and the names that keep their spelling."""
    text = re.sub(r"https?://\S+", " ", text)
    for name in SPELLING["names"]:
        text = text.replace(name, " ")
    return [m.group(0) for rx in AMERICAN for m in rx.finditer(text)]


def text_files() -> list:
    """The repository's text files: in a git checkout the tracked ones, so a
    local file that is not part of the repository never adds or removes a
    case; outside one, every file under the tree."""
    paths = REPO.rglob("*")
    if shutil.which("git") and (REPO / ".git").exists():
        listed = subprocess.run(["git", "ls-files", "-z"], cwd=REPO, capture_output=True, text=True)
        if listed.returncode == 0:
            paths = [REPO / p for p in listed.stdout.split("\0") if p]
    out = []
    for path in paths:
        rel = path.relative_to(REPO)
        if any(part in SKIP_DIRS or part.startswith("_") for part in rel.parts[:-1]):
            continue
        if path.is_file() and (path.suffix in TEXT_SUFFIXES or path.name in {".gitignore", ".vercelignore"}):
            out.append(path)
    return sorted(out)


FILES = text_files()


def test_the_sweep_sees_the_repository():
    names = {f.relative_to(REPO).as_posix() for f in FILES}
    assert {"README.md", "prism/config.py", "lib/format.ts", "docs/MODEL.md", ".gitignore"} <= names


@pytest.mark.parametrize("path", FILES, ids=[f.relative_to(REPO).as_posix() for f in FILES])
def test_no_em_dash(path):
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [i for i, line in enumerate(text.splitlines(), 1) if EM_DASH in line]
    assert not lines, f"em dash on line(s) {lines[:10]}"


def test_no_names_of_the_previous_release():
    hits = []
    for path in FILES:
        rel = path.relative_to(REPO).as_posix()
        if rel.startswith(MAY_NAME_THE_PREVIOUS_RELEASE):
            continue
        for i, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            m = PREVIOUS_NAMES.search(line)
            if m:
                hits.append(f"{rel}:{i}: {m.group(0)}")
    assert not hits, "\n".join(hits[:25])


def test_no_tracked_file_is_executable():
    if shutil.which("git") is None or not (REPO / ".git").exists():
        pytest.skip("not a git checkout")
    listing = subprocess.run(["git", "ls-files", "-s"], cwd=REPO, capture_output=True, text=True, check=True).stdout
    executable = [line.split("\t", 1)[1] for line in listing.splitlines() if line.startswith("100755")]
    assert not executable, executable


def test_the_deployment_leaves_out_exactly_what_it_does_not_run(tmp_path):
    """.vercelignore follows .gitignore's rules, where a pattern without a
    leading slash matches at every depth (a bare `_*` would drop
    prism/__init__.py). Git applies the rules here, in an empty repository
    that holds nothing else: of the tracked files only the folders the
    deployment does not run and the environment template (.env.*) are left
    out, and so are secrets and outputs."""
    if shutil.which("git") is None or not (REPO / ".git").exists():
        pytest.skip("not a git checkout")
    tracked = subprocess.run(["git", "ls-files", "-z"], cwd=REPO, capture_output=True, text=True,
                             check=True).stdout.split("\0")
    tracked = [p for p in tracked if p]
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    (tmp_path / ".gitignore").write_text((REPO / ".vercelignore").read_text(encoding="utf-8"), encoding="utf-8")

    def ignored(paths: list) -> set:
        out = subprocess.run(["git", "check-ignore", "--no-index", "-z", "--stdin"], cwd=tmp_path,
                             input="\0".join(paths), capture_output=True, text=True).stdout
        return {p for p in out.split("\0") if p}

    left_out = ("tests/", "docs/", "migrations/", "scripts/", "data/drivers/", "data/parameters/")
    assert ignored(tracked) == {p for p in tracked if p.startswith(left_out)} | {".env.example"}
    secrets_and_outputs = [".env", ".env.production.local", "data/prism.db", "runs/prism_run_1.xlsx",
                           "_NOT_FOR_HANDOVER/notes.md", "prism/__pycache__/config.cpython-312.pyc"]
    assert ignored(secrets_and_outputs) == set(secrets_and_outputs)


def test_colours_come_from_the_theme():
    hits = []
    for path in FILES:
        rel = path.relative_to(REPO).as_posix()
        if (not rel.startswith(("app/", "components/", "hooks/", "lib/")) or rel in COLOUR_HOMES
                or path.suffix not in {".ts", ".tsx", ".css"}):
            continue
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if LITERAL_COLOUR.search(line):
                hits.append(f"{rel}:{i}: {line.strip()[:100]}")
    assert not hits, "\n".join(hits[:25])


DOCUMENTS = [f for f in FILES if f.suffix == ".md"]


@pytest.mark.parametrize("path", DOCUMENTS, ids=[f.relative_to(REPO).as_posix() for f in DOCUMENTS])
def test_documents_spell_the_british_way(path):
    """Code, names of the code and link targets keep their spelling; the prose does not."""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"\]\([^)]*\)", "]", text)
    assert american_forms(text) == []


def test_the_drivers_texts_spell_the_british_way():
    from prism.analysis_texts import TEXTS
    from prism.seed_drivers import DRIVERS
    hits = [f"{d.id} {field}: {form}" for d in DRIVERS for field in ("name", "description")
            for form in american_forms(getattr(d, field))]
    hits += [f"{driver_id} analysis: {form}" for driver_id, text in TEXTS.items() for form in american_forms(text)]
    assert hits == []


def test_the_spelling_check_spares_names_links_and_the_size_family():
    assert american_forms("Optimized cold-wash programs toward lower odor") == [
        "odor", "toward", "programs", "Optimized"]
    assert american_forms("Keratin Color, Colorado, one-size-fits-all, downsizing, a prize, "
                          "https://example.org/hair-color") == []
    assert american_forms("a range that emphasizes scent, oversized packs") == ["emphasizes"]


#: Calls that load or run Python code by a name or a path chosen at run time.
DYNAMIC_LOADERS = {"spec_from_file_location", "SourceFileLoader", "load_module", "import_module", "run_path",
                   "run_module", "__import__", "exec", "execfile"}


def test_no_script_imports_another():
    """Code that two scripts, or a script and the package, need lives in
    prism/; a script that imported another would run that one's module code
    and tie two entry points together."""
    scripts = {p.stem for p in (REPO / "scripts").glob("*.py")}
    entry_points = sorted((REPO / "scripts").glob("*.py")) + sorted((REPO / "migrations").glob("*/*.py"))
    hits = []
    for path in entry_points:
        rel = path.relative_to(REPO).as_posix()
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = ([a.name for a in node.names] if isinstance(node, ast.Import)
                     else [node.module] if isinstance(node, ast.ImportFrom) and node.module else [])
            hits += [f"{rel}: imports {n}" for n in names if n.split(".")[0] in scripts | {"scripts"}]
            if isinstance(node, ast.Call):
                called = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", None)
                if called in DYNAMIC_LOADERS:
                    hits.append(f"{rel}:{node.lineno}: loads code with {called}()")
    assert len(entry_points) >= 7 and hits == []


#: Set by the platform, not by the operator: Vercel marks its deployments,
#: Node its mode.
PLATFORM_VARIABLES = {"VERCEL", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA", "NODE_ENV"}
#: Read by the Clerk library itself rather than by PRISM's own code.
LIBRARY_VARIABLES = {"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"}


def test_the_configuration_names_every_variable_the_code_reads():
    readme = (REPO / "README.md").read_text(encoding="utf-8")
    table = readme.split("\n## Configuration\n", 1)[1].split("\n## ", 1)[0]
    documented = set(re.findall(r"^\| `([A-Z][A-Z0-9_]+)` \|", table, re.M))
    example = set(re.findall(r"^([A-Z][A-Z0-9_]+)=", (REPO / ".env.example").read_text(encoding="utf-8"), re.M))
    assert documented == example
    read = set()
    for path in FILES:
        if path.relative_to(REPO).parts[0] == "tests":
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if path.suffix == ".py":
            read |= set(re.findall(r"os\.(?:environ\.get\(|environ\[|getenv\()\s*['\"]([A-Z][A-Z0-9_]+)['\"]", text))
        elif path.suffix in {".ts", ".tsx", ".js", ".mjs", ".cjs"}:
            read |= set(re.findall(r"process\.env(?:\.|\[['\"])([A-Z][A-Z0-9_]+)", text))
    assert {"DATABASE_URL", "POSTGRES_URL", "PRISM_JWT_SECRET"} <= read
    assert read - documented - PLATFORM_VARIABLES == set(), "read by the code but not documented"
    assert documented - read - LIBRARY_VARIABLES == set(), "documented but read nowhere"


def test_the_tree_passes_the_handover_secret_scan():
    """scripts/package_handover.sh refuses a tree holding a secret-shaped
    string; its own patterns find none in the tracked files, so no test value
    blocks a handover."""
    if shutil.which("git") is None or shutil.which("grep") is None or not (REPO / ".git").exists():
        pytest.skip("not a git checkout")
    script = (REPO / "scripts" / "package_handover.sh").read_text(encoding="utf-8")
    pattern = re.search(r'^SECRET_PATTERN="(.*)"$', script, re.M).group(1).replace('\\"', '"')
    local = re.search(r'^LOCAL_DATABASE="(.*)"$', script, re.M).group(1)
    tracked = [p for p in subprocess.run(["git", "ls-files", "-z"], cwd=REPO, capture_output=True, text=True,
                                         check=True).stdout.split("\0") if p and (REPO / p).is_file()]
    found = subprocess.run(["grep", "-IonE", pattern, "--", *tracked], cwd=REPO, capture_output=True, text=True)
    assert found.returncode in (0, 1), found.stderr
    hits = [line.rsplit(":", 1)[0] for line in found.stdout.splitlines() if not re.search(local, line)]
    assert hits == []
    assert re.search(pattern.replace("[[:space:]]", r"\s"), "PRISM_JWT_SECRET=" + "k" * 40)   # the scan is live


@pytest.mark.parametrize("ranges, pins", [("requirements-dev.in", "requirements-dev.txt"),
                                          ("api/requirements.in", "api/requirements.txt")])
def test_the_python_dependencies_are_pinned_inside_their_ranges(ranges, pins):
    from packaging.requirements import Requirement
    from packaging.utils import canonicalize_name

    def requirements(path):
        lines = (line.split("#", 1)[0].strip() for line in (REPO / path).read_text(encoding="utf-8").splitlines())
        return [Requirement(line) for line in lines if line]

    pinned = {}
    for req in requirements(pins):
        specs = list(req.specifier)
        assert len(specs) == 1 and specs[0].operator == "==", f"{pins}: {req} is not an exact pin"
        pinned[canonicalize_name(req.name)] = specs[0].version
    for req in requirements(ranges):
        name = canonicalize_name(req.name)
        assert name in pinned, f"{req.name} is declared in {ranges} but not pinned in {pins}"
        assert req.specifier.contains(pinned[name], prereleases=True), \
            f"{pins} pins {req.name} {pinned[name]}, outside {ranges}'s {req.specifier}"


def test_next_dev_leaves_the_tracked_files_alone():
    """Next.js writes agent rules into CLAUDE.md on `next dev` unless told not to."""
    assert re.search(r"^\s*agentRules:\s*false,", (REPO / "next.config.js").read_text(encoding="utf-8"), re.M)


def test_every_response_carries_the_security_headers():
    """vercel.json sets them on every path, the API's included: no page may be framed, no response is
    sniffed, the referrer leaves as the origin only, and search engines are asked not to index."""
    config = json.loads((REPO / "vercel.json").read_text(encoding="utf-8"))
    rules = [rule for rule in config.get("headers", []) if rule["source"] == "/(.*)"]
    assert len(rules) == 1
    headers = {h["key"]: h["value"] for h in rules[0]["headers"]}
    assert headers == {
        "Content-Security-Policy": "frame-ancestors 'none'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "X-Robots-Tag": "noindex, nofollow",
    }
