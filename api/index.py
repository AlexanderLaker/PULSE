"""Vercel entry point: the Python runtime serves the ASGI ``app`` of this module.

vercel.json rewrites every /api/v1/* request to this function.
"""
import logging
import sys
from pathlib import Path

# Vercel loads this file from api/; the package lives at the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# PRISM's own messages reach the function's log from INFO up (a new database
# seeded, a failed connection). Vercel's Python runtime sets up the log
# handler before it loads this module, and basicConfig then leaves it alone;
# a host that sets up none gets lines with their level and source, and the
# libraries' messages from WARNING up.
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("prism").setLevel(logging.INFO)

from prism.api.app import app  # noqa: E402

__all__ = ["app"]
