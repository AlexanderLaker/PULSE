"""Vercel entry point: the Python runtime serves the ASGI ``app`` of this module.

vercel.json rewrites every /api/v1/* request to this function.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism.api.app import app  # noqa: E402  (needs the repository root on the path)

__all__ = ["app"]
