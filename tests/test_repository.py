"""Rules for every text file in the repository.

- No em dash, in code, comments, content or documents.
- None of the names the schema and code before migration 0001 used: the
  migration's folder lists them (previous_names.txt), and only that folder
  and the migration's tests may name them.
- No tracked file is executable: the scripts are run as python3 or bash
  scripts/<name>, as the documents show.
- The dashboard's colours and shadows come from lib/theme.ts (and the force
  and category palettes from lib/format.ts): a literal colour anywhere else in
  its code, a named one or a class of Tailwind's own palette included, is
  either a token that is missing or a copy that will drift.
"""
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


def text_files() -> list:
    out = []
    for path in REPO.rglob("*"):
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
