"""Helpers the test modules share."""
import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def load_module(relative_path: str, name: str | None = None):
    """An entry point (a script, the migration, the Vercel function) loaded as a module.

    Entry points live outside the package and are not importable by name, so
    the tests load them from their file; ``relative_path`` is relative to the
    repository root.
    """
    path = REPO / relative_path
    spec = importlib.util.spec_from_file_location(name or path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
