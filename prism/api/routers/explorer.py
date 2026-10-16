"""Profit Pool Explorer content: the sourced views of the Hair and the Laundry
& Home Care industries (docs/EXPLORER.md).

The views are prism/explorer_content.py (generated from
data/content/profit_pools.json; confidential, so they never ship with the
dashboard's code), served to a signed-in user with a role. Nothing here is
edited through the API or read from the database, and nothing feeds the
simulation; the Explorer's arithmetic runs in the dashboard
(lib/profitPoolData.ts) on what this route answers.
"""
from fastapi import APIRouter, Depends

from prism.api.auth import require_auth
from prism.explorer_content import VIEWS

router = APIRouter()


@router.get("/api/v1/explorer")
def get_explorer_views(user: dict = Depends(require_auth)):
    """{"views": [...]}: the Explorer's views, in the authored order."""
    return {"views": VIEWS}
