"""Rules for every text file in the repository.

- No em dash, in code, comments, content or documents.
- None of the previous release's names: the old package and product name,
  the renamed modules and components, the trend-named keys and columns. Only
  the migration that moves a database of that release, and its tests, may
  name them.
"""
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".css",
                 ".sh", ".txt", ".toml", ".ini", ".example", ".html", ".svg"}
SKIP_DIRS = {"node_modules", ".git", ".next", ".vercel", "__pycache__", ".venv", "venv", ".pytest_cache",
             ".hypothesis", "runs", "archive"}
EM_DASH = chr(0x2014)

#: Names only the previous release used, and the places allowed to name them.
PREVIOUS_NAMES = re.compile(
    r"\bPULSE\b|\bpulse[./]\w|\b(?:from|import) pulse\b|Trends2|ProfitPoolAnalysis2|ConsumerJourney2|"
    r"seed_trends|trendCodeMap|run_50k_prod|trend_fingerprint|trend_count|strategic_implication|"
    r"probability_posterior|ai_suggestion|user_override|trend_base_2026")
MAY_NAME_THE_PREVIOUS_RELEASE = ("migrations/0001_driver_schema/", "tests/test_migration.py")


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
        if rel.startswith(MAY_NAME_THE_PREVIOUS_RELEASE) or rel == "tests/test_repository.py":
            continue
        for i, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            m = PREVIOUS_NAMES.search(line)
            if m:
                hits.append(f"{rel}:{i}: {m.group(0)}")
    assert not hits, "\n".join(hits[:25])
