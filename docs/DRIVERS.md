# The drivers

A Profit Pool Driver is one external development that moves the gross profit
of Henkel Consumer Brands' categories: a regulation, a shift in retail, a
consumer behaviour, a technology, a competitor's move, an environmental
pressure. The dashboard says "Drivers" in menus and headers; in full they are
Profit Pool Drivers. The base has 51 of them:

| Force | Letter | Drivers |
|---|---|---|
| Consumer | C | 20 |
| Customer (retail and trade) | K | 7 |
| Technology | T | 6 |
| Government | G | 10 |
| Environmental | E | 4 |
| Competitive | X | 4 |

33 drivers contract the pool and 18 expand it. Each driver describes one
mechanism.

## Identity

Every driver has an id of the form `<force>_r<two digits>` (`consumer_r01`)
and a display code of the force letter and the same number (`C-01`). The
code map `data/driverCodeMap.ts` is generated from the base; the Consumer
Journey cites drivers by code.

An id is never given to another driver. Stored runs (their fingerprints),
expert proposals, the audit log and the journey content refer to drivers by
id or code, so a driver that leaves the base takes its id with it. A new
driver takes a number above the highest its force has ever used: C-37, K-13,
T-19, G-17, E-12 and X-18 so far. The gaps in the numbering belong to drivers
that left and are never filled.

## Fields

The scores feed the model (docs/MODEL.md shows how); the texts and sources
explain them.

| Field | Values | Meaning |
|---|---|---|
| `name` | text | A one-line statement of the mechanism |
| `description` | text | The evidence and the reasoning, with dated figures |
| `direction` | Expansion, Contraction | Whether the driver grows or shrinks the pool |
| `probability` | 1 to 5 | How likely the effect is to materialise as described. The prior's mean is probability / 6: a 5 means five in six, not certainty |
| `gp1_pct_affected` | (0, 1] | The share of a category's gross profit the driver can move at full materialisation |
| `start_year` | 2025 to 2034 | The onset: no effect up to and including this year |
| `peak_year` | after the onset, at most 2035 | The year by which the full effect has materialised |
| `diffusion_curve` | `s_curve`, `linear`, `front_loaded`, `back_loaded`, `step_function` | The shape of the ramp from onset to peak |
| `uncertainty` | 0 to 5 | How far the size and timing of the effect could differ from the modelled values (scale below) |
| `confidence` | High, Medium, Low | How well the present state is evidenced. Shown on the page; not a model input |
| `category_exposure` | 0 to 5 per category | How strongly the mechanism acts on each of the 13 categories |
| `regional_exposure` | 0 to 5 per region | How strongly it acts in each of the four regions |
| value-chain epicentre | one of eight stages | The stage where the impact centres (below) |
| `sources` | list | The evidence: title, link, tier and a note (in the base, the month of publication) |

The uncertainty score is one number per driver for the dispersion around the
modelled size and timing, given the direction. It is neither the probability
(how likely the effect is at all) nor the confidence:

| Score | Meaning |
|---|---|
| 0 | fixed by law or contract, no material dispersion |
| 1 | size within about 25 percent either way, timing dated or within a year |
| 2 | well-evidenced mechanism, size within about 50 percent, timing within one to two years |
| 3 | the size could be half or double, or the onset depends on an undated trigger |
| 4 | the size could be near zero or more than double (decisions not yet taken) |
| 5 | the sign could differ across scenarios, or the effect may not materialise at all |

The engine turns it into the width of the probability prior and of the
peak-year jitter (docs/MODEL.md, step 1).

### Categories and regions

The 13 categories, in the engine's order, with the labels the dashboard shows:

| Key | Label | Covers (HCB brands as examples) |
|---|---|---|
| `Hair: Color` | Colour | Retail and professional hair colour (Palette, Syoss, Live) |
| `Hair: Care` | Care | Hair care (Gliss, Schauma, Syoss, professional care) |
| `Hair: Styling` | Styling | Styling (Taft, got2b, Osis) |
| `Hair: Body` | Body | Body care and deodorants (Fa, Dial, Right Guard) |
| `LHC: FCN` | Fabric Clean | Heavy-duty detergents (Persil, Weisser Riese, Spee, all, Purex) |
| `LHC: FCA` | Fabric Care | Specialty fabric care (Perwoll) |
| `LHC: FFI` | Fabric Finishers | Softeners and finishers (Vernel, Silan, Snuggle) |
| `LHC: LAD` | Laundry Additives | Additives and stain removal (Sil, boosters) |
| `LHC: HDW` | Hand Dishwash | Hand dishwashing (Pril) |
| `LHC: ADW` | Auto Dishwash | Automatic dishwashing (Somat) |
| `LHC: HSC` | Hard-Surface Cleaner | Surface, bathroom, kitchen, floor and glass cleaning, bleach, polishes (Bref surface, Biff, Sidolin, Danklorix) |
| `LHC: TOI` | Toilet Care | Toilet cleaners, rim blocks, toilet gels (WC-Frisch, Bref WC) |
| `LHC: IC` | Insect Control | Insect control, a small line for HCB |

The four regions are Europe, North America, Asia and High Growth (the growth
markets; Türkiye is scored in High Growth). Exposure describes only where the
mechanism acts. Whether HCB has business in a category and region enters the
model through the cell weights (docs/MODEL.md), never through the exposures.

### The value chain

Experts place each driver at one of eight value-chain stages: Raw Materials,
Formulation, Manufacturing, Packaging, Supply Chain, Marketing, Commercial,
Consumer. The driver stores the stage's name (`vc_epicentre`). The stage
feeds the value-chain lens of the Shift Analysis only; it never changes a
shift. Under Review & Endorse the experts' stages are counted as votes, never
averaged: a Supply Chain vote and two Commercial votes do not make Marketing,
and a tie leaves the choice to the admin.

### Sources

Every source has a tier, from S (the most authoritative) to E, as the base
grades its sources and the Drivers page describes them:

| Tier | Source kind |
|---|---|
| S | Statute, regulator, official statistics, peer-reviewed research |
| A | Analyst, consulting or market-measurement research (Circana, NielsenIQ, BCG); a major poll or major press; a company's reports, results and published positions |
| B | Specialist research firms and trade press (Kline, Happi); earnings-call transcripts; surveys |
| C | General business press |
| D | Aggregator or forecast |
| E | Social media or unverified |

A-, B+ and B- move a source a little down from A, up from B or down from B;
its note says why. The base uses S, A and B only.

Every driver of the base needs at least one source of tier S, A or B; a base
that lacks one is refused before anything is generated from it. The Drivers page sums up a
driver's first three sources in one evidence line, each as its publisher
(the title up to its first colon) with the note, as in "Circana (Apr 2026)".

## Where the base lives

The driver base is `data/drivers/driver_base.json`. Besides the fields
above, each entry carries a classification (theme, foresight tier, scope,
megatrend, the year first observed, the mechanism); the model and the
dashboard do not use it.

`prism/driver_base.py` reads and validates the base (known forces and
taxonomy keys, scores in range, an onset before the peak, a known epicentre,
an S, A or B source behind every driver) for everything built from it: the
seed, the overlap correction and the PRISM Analysis. `scripts/generate_seed.py`
writes two files from it that are never edited by hand:

- `prism/seed_drivers.py`: the drivers a new database is seeded with,
  including each driver's PRISM Analysis text (docs/DRIVER_ANALYSIS.md) and
  its baseline, the scores the Edited chip compares against;
- `data/driverCodeMap.ts`: display code to driver id, with each driver's
  name, force, direction and the first sentence of its description.

`generate_seed.py --check` fails when either file differs from what the base
produces; CI runs it.

## Changing a driver

In production the database holds the live scores. An admin changes a driver on
the Drivers page: the edit is written at once, every changed field goes to the
audit log in the same transaction, and a changed score marks the driver as
Edited against its baseline. The name, the force and the onset come from the
base and are not edited on the page, and a peak year must fall after the
onset. An exposure edit sends only the cells that changed. PRISM stores only
complete drivers, every score present and on its scale, with a score for
every category and every region and no name outside the taxonomy, so a
stored driver can always be simulated. Every driver carries a revision
number that each save raises; an edit names the revision it was made on, so
when two admins (or two tabs) edit the same driver, the second save is
refused with a request to reload instead of silently undoing the first.

Experts propose scores under Expert Rating; a proposal never changes a
driver and may leave any field unscored. The proposal saves as it is edited,
one request at a time per driver with the newest draft. Admins see the
proposals aggregated under Review & Endorse: the mean of the probability, the
GP1 share and each exposure cell, the median of the peak year and the
uncertainty, and the curve and the value-chain stage as majority votes. They
choose per field between keeping the current value, the baseline, the expert
aggregate and a manual value: a field with an aggregate starts on it, and a
field nobody scored, or a vote without a majority, starts on its current
value. Endorsing saves the chosen values as an ordinary edit. The next
production run reports every change as input drift.

The base file changes when a review changes the reference scores or the
texts. After an edit to `driver_base.json`:

1. run `scripts/generate_seed.py`;
2. if category exposures changed, or drivers were added or removed (the
   correction depends on how many drivers each force has), give
   `scripts/compute_attenuation.py` a new `CALIBRATION_VERSION` and run it;
   it writes the record and `prism/overlap_correction.py`, which
   `prism/config.py` reads. The new correction moves the model's numbers, so
   the same commit carries a new `MODEL_VERSION` and the regenerated golden
   pins (docs/adr/0014);
3. regenerate the PRISM Analysis as docs/DRIVER_ANALYSIS.md describes;
4. until migration 0001 has run on every database, it is what carries a
   changed description to them: the new text becomes the `text` of the
   driver's entry in `migrations/0001_driver_schema/descriptions.json` (an
   entry is added where the driver has none) and the SHA-256 of the text it
   replaces joins `previous_sha256`. A changed Consumer Journey tile text or
   stage label goes into `journey_edits.json` the same way. The migration's
   tests check that every entry ends on the shipped text;
5. commit the regenerated files; CI checks all of them.

A new database picks up the base when it is seeded. An existing database
keeps its own drivers: a changed analysis text reaches it through
`scripts/sync_analysis.py`, which writes nothing else; scores, descriptions
and sources are changed on the Drivers page. Adding or removing drivers, or
making changed scores the new baseline of an existing database, is a
database migration: a new folder under `migrations/`, built like
`0001_driver_schema`.
