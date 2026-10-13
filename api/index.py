"""Vercel entry point: the Python runtime serves the ASGI ``app`` of this module.

vercel.json rewrites every /api/v1/* request to this function.
"""
import logging
import sys
from pathlib import Path

# Vercel loads this file from api/; the package lives at the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# The function's log (Vercel's runtime logs) gets PRISM's own messages from
# INFO up and everything else from WARNING up, each with its level and source;
# without this, only warnings would reach it, as bare text.
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("prism").setLevel(logging.INFO)

from prism.api.app import app  # noqa: E402

__all__ = ["app"]
