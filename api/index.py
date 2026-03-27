"""Vercel serverless entry point for PULSE FastAPI backend.

Vercel's Python runtime looks for an `app` variable that is an ASGI application.
This module imports and re-exports the FastAPI app from the pulse package.
"""
import sys
from pathlib import Path

# Ensure the project root is on the Python path so `pulse` is importable
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from pulse.api.app import create_app

# Vercel expects an `app` variable — ASGI handler
app = create_app()
