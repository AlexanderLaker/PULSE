"""Vercel entry point: the Python runtime serves the ASGI ``app`` of this module.

vercel.json rewrites every /api/v1/* request to this function.
"""
import sys
from pathlib import Path

# Vercel loads this file from api/; the package lives at the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism.api.app import app

__all__ = ["app"]
