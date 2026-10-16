"""The Profit Pool Explorer's views, in the shape the dashboard renders.

lib/profitPoolData.ts defines the shape (PoolView, PoolItem, SourceRef) and
the arithmetic; the content is data/content/profit_pools.json, which
scripts/build_content.py validates with views_problem and writes to
prism/explorer_content.py for the API to serve (GET /api/v1/explorer). The
views never feed the simulation.
"""
import re

#: The views the dashboard offers, by id (lib/profitPoolData.ts PoolViewId);
#: the content holds each of them exactly once.
VIEW_IDS = ("hair_value_chain", "laundry_value_chain", "hair_categories", "hair_core_adjacent",
            "home_care_categories", "laundry_core_adjacent")
#: The industry a view covers (lib/format.ts CategoryGroup).
GROUPS = ("Hair", "LHC")
KINDS = ("ValueChain", "Categories", "CoreAdjacent")
#: The evidence grade of a cited figure (docs/EXPLORER.md).
GRADES = ("reported", "derived", "estimate")
#: The value basis of a cited figure, where it matters for the sizing.
DENOMINATIONS = ("RSP", "MSP", "scanner-POS", "salon-mfr", "model")
#: How far the revenue shares of one view may add up away from 1 (they are
#: rounded to three decimals each).
SHARE_TOLERANCE = 0.02
VIEW_KEYS = ("id", "title", "subtitle", "poolSize", "poolSizeEurBn", "group", "kind", "items", "construction",
             "insights")
ITEM_KEYS = ("id", "label", "revenueShare", "gp1Margin", "revenueCAGR", "gp1DeltaBps", "revenueDriver",
             "marginDriver", "sources")
OPTIONAL_ITEM_KEYS = ("sublabel", "note")
SOURCE_SIDES = ("revenue", "margin")
SOURCE_KEYS = ("label", "url", "grade")
OPTIONAL_SOURCE_KEYS = ("detail", "denomination")
HTTP_URL = re.compile(r"https?://\S+")


def _number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _missing(item: dict, required: tuple) -> list:
    return [k for k in required if k not in item]


def _unknown(item: dict, allowed: tuple) -> list:
    return sorted(set(item) - set(allowed))


def source_problem(source) -> str | None:
    """What in a cited source the dashboard could not show, or None: it needs
    a label, an http(s) url and a grade, may carry a detail and a value basis
    (denomination) from the allowed set, and nothing else."""
    if not isinstance(source, dict):
        return "must be an object"
    missing = _missing(source, SOURCE_KEYS)
    if missing:
        return f"lacks {', '.join(missing)}"
    if not isinstance(source["label"], str) or not source["label"].strip():
        return "needs a label"
    if not isinstance(source["url"], str) or not HTTP_URL.fullmatch(source["url"]):
        return "needs an http(s) url"
    if source["grade"] not in GRADES:
        return f"grade must be one of {', '.join(GRADES)}"
    if "detail" in source and not isinstance(source["detail"], str):
        return "detail must be text"
    if "denomination" in source and source["denomination"] not in DENOMINATIONS:
        return f"denomination must be one of {', '.join(DENOMINATIONS)}"
    unknown = _unknown(source, SOURCE_KEYS + OPTIONAL_SOURCE_KEYS)
    if unknown:
        return f"holds {', '.join(unknown)}, which a source does not have"
    return None


def item_problem(item) -> str | None:
    """What in one row of a view the dashboard could not draw, or None. Its id
    is checked by views_problem, which knows the other rows."""
    if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
        return "must be a row with a string id"
    missing = _missing(item, ITEM_KEYS)
    if missing:
        return f"lacks {', '.join(missing)}"
    for key in ("label", "revenueDriver", "marginDriver"):
        if not isinstance(item[key], str):
            return f"{key} must be text"
    for key in OPTIONAL_ITEM_KEYS:
        if key in item and not isinstance(item[key], str):
            return f"{key} must be text"
    share, margin = item["revenueShare"], item["gp1Margin"]
    if not _number(share) or not 0 < share <= 1:
        return "revenueShare must be a number above 0 and at most 1"
    if not _number(margin) or not 0 < margin < 1:
        return "gp1Margin must be a number between 0 and 1, both excluded"
    if not _number(item["revenueCAGR"]):
        return "revenueCAGR must be a number"
    if not _number(item["gp1DeltaBps"]):
        return "gp1DeltaBps must be a number"
    sources = item["sources"]
    if not isinstance(sources, dict) or set(sources) != set(SOURCE_SIDES) \
            or not all(isinstance(sources[side], list) for side in SOURCE_SIDES):
        return "sources must hold a revenue list and a margin list, and nothing else"
    for side in SOURCE_SIDES:
        for j, source in enumerate(sources[side]):
            problem = source_problem(source)
            if problem:
                return f"sources.{side}[{j}] {problem}"
    unknown = _unknown(item, ITEM_KEYS + OPTIONAL_ITEM_KEYS)
    if unknown:
        return f"holds {', '.join(unknown)}, which a row does not have"
    return None


def views_problem(views) -> str | None:
    """Why a list of views cannot be served, or None.

    The shape is what the dashboard renders: every view of VIEW_IDS exactly
    once, each with a group and a kind from the taxonomy, a string title,
    subtitle, pool size label and construction note, a positive pool size in
    euros, a list of insights and its rows; a view's rows have unique ids,
    each a revenue share in (0, 1] (the shares of a view adding up to 1 within
    SHARE_TOLERANCE), a GP1 margin in (0, 1), the growth figures and sourced
    evidence (item_problem, source_problem).
    """
    if not isinstance(views, list):
        return "views must be a list"
    seen: list = []
    for i, view in enumerate(views):
        where = f"views[{i}]"
        if not isinstance(view, dict) or not isinstance(view.get("id"), str):
            return f"{where} must be a view with a string id"
        if view["id"] not in VIEW_IDS:
            return f"{where} has id {view['id']!r}, which is not a view of the dashboard"
        if view["id"] in seen:
            return f"view {view['id']!r} appears twice"
        seen.append(view["id"])
        missing = _missing(view, VIEW_KEYS)
        if missing:
            return f"view {view['id']!r} lacks {', '.join(missing)}"
        if view["group"] not in GROUPS:
            return f"view {view['id']!r}: group must be one of {', '.join(GROUPS)}"
        if view["kind"] not in KINDS:
            return f"view {view['id']!r}: kind must be one of {', '.join(KINDS)}"
        for key in ("title", "subtitle", "poolSize", "construction"):
            if not isinstance(view[key], str) or not view[key].strip():
                return f"view {view['id']!r}: {key} must be text"
        if not _number(view["poolSizeEurBn"]) or view["poolSizeEurBn"] <= 0:
            return f"view {view['id']!r}: poolSizeEurBn must be a number above 0"
        if not isinstance(view["insights"], list) or not all(isinstance(s, str) for s in view["insights"]):
            return f"view {view['id']!r}: insights must be a list of texts"
        items = view["items"]
        if not isinstance(items, list) or not items:
            return f"view {view['id']!r}: items must be a list of rows"
        ids: set = set()
        for j, item in enumerate(items):
            problem = item_problem(item)
            if problem:
                named = isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"]
                label = f"row {item['id']!r}" if named else f"items[{j}]"
                return f"view {view['id']!r}: {label} {problem}"
            if item["id"] in ids:
                return f"view {view['id']!r}: row id {item['id']!r} appears twice"
            ids.add(item["id"])
        total = sum(item["revenueShare"] for item in items)
        if round(abs(total - 1), 9) > SHARE_TOLERANCE:   # rounded: the sum of three-decimal shares is not exact
            return f"view {view['id']!r}: the revenue shares add up to {total:.3f}, not 1"
        unknown = _unknown(view, VIEW_KEYS)
        if unknown:
            return f"view {view['id']!r} holds {', '.join(unknown)}, which a view does not have"
    absent = [v for v in VIEW_IDS if v not in seen]
    if absent:
        return f"the views {', '.join(absent)} are missing"
    return None
