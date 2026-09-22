"""
Render the PRISM Analysis readings from their templates and the attribution
record. Pure functions, no engine import, so the seed generator, the build
script and the tests share one renderer.

A template is prose with named placeholders in braces. Every figure in a
reading comes from a placeholder; the rendered text is what
`prism/seed_drivers.py` carries as `analysis` and what the
Drivers page shows. The vocabulary is documented in
docs/DRIVER_ANALYSIS_CONCEPT.md and enumerated by `render_fields`.

Paragraph convention (the Drivers page renders it): paragraphs are separated
by a blank line; a paragraph that starts with one of the fixed labels followed
by a colon ("Weight in the answer:", "Where it lands:", "When it lands:",
"What the band hinges on:") gets the label set as a small heading; the
renderer appends the basis line ("Figures: ...") itself from the record.
"""
from __future__ import annotations

import re

LABELS = ("Weight in the answer", "Where it lands", "When it lands", "What the band hinges on")
BASIS_LABEL = "Figures"

#: Category names in the texts: the labels the page shows (lib/format.ts
#: CATEGORY_DISPLAY), in lower case, so a cell reads "fabric clean Europe"
#: and the reader can find it in the Shift Matrix without a second table.
CATEGORY_SHORT = {
    "Hair: Color": "hair colour", "Hair: Care": "hair care",
    "Hair: Styling": "hair styling", "Hair: Body": "body care",
    "LHC: FCN": "fabric clean", "LHC: FCA": "fabric care",
    "LHC: FFI": "fabric finishers", "LHC: LAD": "laundry additives",
    "LHC: HDW": "hand dishwash", "LHC: ADW": "auto dishwash",
    "LHC: HSC": "hard-surface cleaner", "LHC: TOI": "toilet care",
    "LHC: IC": "insect control",
}
TOP_CELLS = 6
#: The diffusion curves as the readings name them.
CURVE_NAMES = {"front_loaded": "front-loaded", "s_curve": "s-curve", "linear": "linear",
               "back_loaded": "back-loaded", "step_function": "step"}

_ORDINALS = {1: "largest", 2: "second largest", 3: "third largest", 4: "fourth largest",
             5: "fifth largest", 6: "sixth largest", 7: "seventh largest", 8: "eighth largest",
             9: "ninth largest", 10: "tenth largest", 11: "eleventh largest", 12: "twelfth largest"}


def fmt_pp(x: float) -> str:
    """Magnitude in points, two decimals ("0.90 of the 5.6 points"), so that
    drivers a few hundredths apart can be told apart and the ranks checked."""
    return f"{abs(float(x)):.2f}"


def fmt_total(x: float) -> str:
    """A portfolio total in points, one decimal (the headline's precision)."""
    return f"{abs(float(x)):.1f}"


def fmt_pp2(x: float) -> str:
    """Magnitude in points with two decimals (cells are small)."""
    return f"{abs(float(x)):.2f}"


def ordinal(n) -> str:
    if not n:
        return ""
    n = int(n)
    if n in _ORDINALS:
        return _ORDINALS[n]
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix} largest"


def pct(x: float, nd: int = 0) -> str:
    return f"{abs(float(x)) * 100:.{nd}f}"


def cell_label(cat: str, region: str) -> str:
    return f"{CATEGORY_SHORT.get(cat, cat)} {region}"


def basis_line(rec: dict) -> str:
    """One sentence naming what the figures reconcile to, in terms a reader can
    check against the dashboard headline."""
    ref = rec.get("reference_run", {})
    version = rec.get("basis", {}).get("model_version") or ref.get("model_version") or ""
    source = str(rec.get("basis", {}).get("cell_weights_source", ""))
    basis = ("estimated HCB gross-profit mix" if source.upper().startswith("ESTIMATE")
             else "finance cell weights" if source else "the configured cell weights")
    median = float(ref.get("portfolio_terminal", {}).get("median", 0.0)) * 100
    chains = ref.get("chains", "")
    iters = ref.get("iterations", "")
    recipe = f"{chains} x {iters:,} iterations, seed {ref.get('seed', '')}" if chains and iters else "reference run"
    return (f"{BASIS_LABEL}: model attribution on the {version} base, {basis}, reconciled to a "
            f"2035 portfolio median of {median:+.1f} percent ({recipe}). Read as exposure if "
            f"nobody acts, not as a forecast.")


def render_fields(rec: dict, drv: dict) -> dict:
    """The placeholders a template may use. Every value is a string."""
    years = list(drv["portfolio_pp"].keys())
    last = years[-1]
    pp = drv["portfolio_pp"][last]
    cells = drv["cells"]
    band = drv["band"]
    t = drv["timing"]
    st = drv["structure"]
    tot = rec["totals"]
    is_hw = drv["direction"] == "Contraction"
    n_dir = tot["headwinds"] if is_hw else tot["tailwinds"]
    force = drv["force"]
    force_same = tot["by_force_headwind_pp"][force] if is_hw else tot["by_force_tailwind_pp"][force]
    sr = t["share_realised"]
    full_year = next((y for y in years if sr[y] >= 0.99), None)
    f = {
        "code": drv["code"],
        "pp": fmt_pp(pp),
        "net": fmt_total(tot["net_pp"]),
        "gross_hw": fmt_total(tot["gross_headwind_pp"]),
        "gross_tw": fmt_total(tot["gross_tailwind_pp"]),
        "share_gross": pct(drv["share_of_gross"]),
        "share_net": pct(drv["share_of_net"]),
        "rank_abs": ordinal(drv["rank_abs"]),
        "rank_abs_n": str(drv["rank_abs"]),
        "rank_dir": ordinal(drv["rank_in_direction"]),
        "rank_dir_n": str(drv["rank_in_direction"] or ""),
        "n_dir": str(n_dir),
        "force": force,
        "force_lower": force.lower(),
        "force_share": pct(drv["force_share"]),
        "force_same": fmt_total(force_same),
        "force_net": fmt_total(tot["by_force_pp"][force]),
        "force_rank": ordinal(drv["force_rank"]),
        "by2027": pct(sr["2027"]),
        "by2028": pct(sr["2028"]),
        "by2029": pct(sr["2029"]),
        "by2030": pct(sr["2030"]),
        "by2031": pct(sr["2031"]),
        "by2032": pct(sr["2032"]),
        "by2033": pct(sr["2033"]),
        "half_year": str(t["half_year"] or ""),
        "full_year": str(full_year or ""),
        "mat2035": pct(t["expected_materialisation"]["2035"]),
        "p10": fmt_pp(band["p10_pp"]),
        "p90": fmt_pp(band["p90_pp"]),
        "lo": fmt_pp2(min(abs(band["p10_pp"]), abs(band["p90_pp"]))),
        "hi": fmt_pp2(max(abs(band["p10_pp"]), abs(band["p90_pp"]))),
        "band_share": pct(band["band_share"]),
        "pass_through": pct(st["pass_through"], 1),
        "reach": pct(st["reach"]),
        "damp_loss": pct(1 - st["effective_dampening"]),
        "eu": pct(drv["region_split"]["Europe"]),
        "na": pct(drv["region_split"]["North America"]),
        "asia": pct(drv["region_split"]["Asia"]),
        "hg": pct(drv["region_split"]["High Growth"]),
        "eu_na": pct(drv["region_split"]["Europe"] + drv["region_split"]["North America"]),
        "asia_hg": pct(drv["region_split"]["Asia"] + drv["region_split"]["High Growth"]),
        "eu_pp": fmt_pp(drv["region_pp"]["Europe"]),
        "na_pp": fmt_pp(drv["region_pp"]["North America"]),
        "asia_pp": fmt_pp(drv["region_pp"]["Asia"]),
        "hg_pp": fmt_pp(drv["region_pp"]["High Growth"]),
        "top2_share": pct(sum(c["share_of_driver"] for c in cells[:2])),
        "top3_share": pct(sum(c["share_of_driver"] for c in cells[:3])),
        "top4_share": pct(sum(c["share_of_driver"] for c in cells[:4])),
    }
    # Structural constants of the base: the pass-through of every force and
    # the regional shares of the pool, so a reading can compare without a
    # hand-typed figure.
    basis = rec.get("basis", {})
    fw, att = basis.get("force_weights", {}), basis.get("per_force_attenuation", {})
    for name in fw:
        f[f"pt_{name.lower()}"] = pct(fw[name] * att.get(name, 0.0), 1)
    pool = rec.get("totals", {}).get("pool_region_shares", {})
    for region, share in pool.items():
        f[f"pool_{region.lower().replace(' ', '_')}"] = pct(share)
    if pool:
        f["pool_eu_na"] = pct(pool.get("Europe", 0) + pool.get("North America", 0))
        f["pool_asia_hg"] = pct(pool.get("Asia", 0) + pool.get("High Growth", 0))
    cat_pool = rec.get("totals", {}).get("pool_category_shares", {})
    if cat_pool:
        f["pool_lhc"] = pct(sum(v for k, v in cat_pool.items() if k.startswith("LHC")))
        f["pool_hair"] = pct(sum(v for k, v in cat_pool.items() if k.startswith("Hair")))
    for i, c in enumerate(cells[:TOP_CELLS], start=1):
        f[f"cell{i}"] = cell_label(c["category"], c["region"])
        f[f"cell{i}_pp"] = fmt_pp2(c["pp"])
        f[f"cell{i}_share"] = pct(c["share_of_driver"])
        f[f"cell{i}_pool"] = pct(c["cell_share_of_pool"], 1)
        f[f"cell{i}_of_cell"] = pct(c["share_of_cell"])
        f[f"cell{i}_damp"] = pct(1 - c["dampening"])
        f[f"cell{i}_partners"] = ", ".join(p["code"] for p in c["same_force_partners"])
    # The timing scores: the peak year and onset are numbers the reader sees
    # on the page and a template names them only through these, never typed.
    sc = drv.get("scoring") or {}
    if sc.get("peak_year"):
        f["peak_year"] = str(sc["peak_year"])
    if sc.get("start_year"):
        f["onset_year"] = str(sc["start_year"])
    curve = str(sc.get("diffusion_curve") or "")
    if curve:
        f["curve"] = CURVE_NAMES.get(curve, curve.replace("_", " "))
    # The cell, over all 52, where the driver is the largest share of the
    # cell's own shift (the six cells above are the largest by points).
    m = drv.get("max_share_cell")
    if m:
        f["max_cell"] = cell_label(m["category"], m["region"])
        f["max_cell_share"] = pct(m["share_of_cell"])
        f["max_cell_pp"] = fmt_pp2(m["pp"])
    cats_sorted = sorted(drv["category_pp"].items(), key=lambda kv: -abs(kv[1]))
    for i, (cat, v) in enumerate(cats_sorted[:4], start=1):
        f[f"cat{i}"] = CATEGORY_SHORT.get(cat, cat)
        f[f"cat{i}_pp"] = fmt_pp(v)
        f[f"cat{i}_share"] = pct(drv["category_share"][cat])
    share_sorted = sorted(drv["category_share"].items(), key=lambda kv: -abs(kv[1]))
    for i, (cat, v) in enumerate(share_sorted[:3], start=1):
        f[f"catshare{i}"] = CATEGORY_SHORT.get(cat, cat)
        f[f"catshare{i}_share"] = pct(v)
        f[f"catshare{i}_pp"] = fmt_pp(drv["category_pp"][cat])
    return f


class _Strict(dict):
    def __missing__(self, key):
        raise KeyError(key)


_SENTENCE_START = re.compile(r"(^|[.!?]\s+|^[^\n:]{1,40}:\s+)([a-z])", re.M)


def _capitalise(text: str) -> str:
    """A cell label such as "laundry detergents Europe" is lower case; when a
    placeholder opens a sentence (or follows the paragraph label) the first
    letter is set upper case, as a writer would."""
    return _SENTENCE_START.sub(lambda m: m.group(1) + m.group(2).upper(), text)


def render_text(rec: dict, drv: dict, template: str) -> str:
    """Fill a template, set sentence-initial capitals and append the basis line."""
    try:
        body = template.format_map(_Strict(render_fields(rec, drv)))
    except KeyError as e:
        raise KeyError(f"{drv['code']}: unknown placeholder {e}") from e
    return _capitalise(body.rstrip()) + "\n\n" + basis_line(rec)


def render_all(rec: dict, analysis: dict) -> dict:
    """{trend id: rendered text} for every driver of the record. Raises when a
    driver has no template or a template names a driver the record lacks."""
    by_code = {d["code"]: (tid, d) for tid, d in rec["drivers"].items()}
    templates = analysis.get("drivers", {})
    missing = [c for c in by_code if c not in templates]
    unknown = [c for c in templates if c not in by_code]
    if missing or unknown:
        raise ValueError(f"analysis templates: missing {missing}, unknown {unknown}")
    return {tid: render_text(rec, drv, templates[code]["template"]) for code, (tid, drv) in by_code.items()}


def split_paragraphs(text: str) -> list:
    """[(label or None, body)] as the Drivers page renders it."""
    out = []
    for para in re.split(r"\n\s*\n", (text or "").strip()):
        para = para.strip()
        if not para:
            continue
        m = re.match(r"^(%s|%s):\s*(.*)$" % ("|".join(re.escape(l) for l in LABELS), BASIS_LABEL), para, re.S)
        if m:
            out.append((m.group(1), m.group(2).strip()))
        else:
            out.append((None, para))
    return out
