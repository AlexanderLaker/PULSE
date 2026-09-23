# The PRISM Analysis

Every driver on the Drivers page carries a card called PRISM Analysis: a
reading of what that driver does to the number on the dashboard. This
document sets out what the reading is, where its figures come from, the rules
it follows and how it is regenerated.

## What it is for

Everything an expert scores is already on the page: the direction, the
probability, the GP1 share, the timing, the uncertainty, the exposures, the
sources. None of it says what the driver does to the dashboard's headline. A
driver with a large Shift value can be a small item in the portfolio because
it acts in a region that holds a twentieth of the pool; a driver with modest
scores can be the largest single headwind because it reaches every cell. The
exposures say where a mechanism acts; only the roll-up says where the gross
profit is.

The reading answers one question per driver, in four labelled paragraphs:

1. **Weight in the answer.** How much of the headline the driver carries, and
   why that much: its Shift value, the pass-through of its force, its reach
   and the overlap correction it faces.
2. **Where it lands.** The cells, regions and categories that carry the
   effect once the gross-profit mix is applied, and the drivers of the same
   force that share those cells (the overlap correction already discounts
   them together, so a reader must not add them up).
3. **When it lands.** The share of the terminal-year effect in the numbers by
   2028 and by 2030, the half-way year, and what the curve does inside the
   horizon. Dated instruments are named with their dates.
4. **What the band hinges on.** The driver's own P10 to P90 range at 2035,
   its share of the portfolio band where that is material, the condition the
   width depends on, the drivers that move with it, and the observable that
   would change the read: a statistical series, a regulatory act or a company
   report its sources already cover.

A basis line closes the reading: "Figures: model attribution on the estimated
HCB gross-profit mix, reconciled to a 2035 portfolio median of -5.6 percent
(3 x 50,000 iterations, seed 42). Read as exposure if nobody acts, not as a
forecast." When the run the dashboard shows has another median, the card says
under the basis line that its figures come from the run the line names.

The reading interprets the model's arithmetic. It does not restate scores,
forecast or recommend: under the ceteris-paribus design every contribution is
exposure if nobody acts, and the response belongs to the reader.

## The figures

The engine compounds, per cell and year, one factor per force (docs/MODEL.md,
steps 5 and 6). Inside a force, each driver adds a term

```
a_jcry = w_f x a_f x D_fcr x E[p_j] x g_j x d_j x E[m_j(y)] x (category exposure / 5) x (regional exposure / 5)
```

Each term is linear in the driver's own probability draw, so the mean of the
Monte Carlo term is the term at the mean: `E[p_j] = probability / 6`, with the
materialisation averaged over the driver's peak-jitter grid.
`prism/attribution.py` evaluates these terms driver by driver and cell by
cell with the engine's own exposure, dampening and schedule functions,
compounds them per cell as the engine does, spreads the
cross-terms of the compounding over the drivers of the cell in proportion to
their terms (so the drivers of a cell add up to the cell's shift), and rolls
the cells up with the run's gross-profit shares.

The 51 contributions then add up to the reference run's terminal-year mean to
a few hundredths of a percent; what remains is the covariance between the
force factors, which the Monte Carlo averages and an evaluation at the means
does not. The dashboard shows the median, and the portfolio distribution is
skewed, so every contribution is scaled by one factor, the reference median
over the sum at the means (1.006 on the current base), and the contributions
add up to the headline a reader sees. The factor is the skew of the
distribution, not an approximation error.

This is an expected-value decomposition of the model, not a fitted
attribution and not a second simulation, and it is labelled attribution
wherever it is shown. The record, `data/drivers/driver_attribution.json`,
holds per driver:

- the terminal-year contribution to the portfolio in points, by year, with
  its rank among all drivers and among the headwinds or tailwinds, its share
  of the gross headwind or tailwind and of its force;
- the contribution by category and by region, and in the driver's six
  largest cells: each cell's share of the pool, the driver's share of the
  cell's shift and up to three drivers of the same force in the cell; and,
  over all 52 cells, the cell where the driver is the largest share of the
  cell's own shift;
- the expected materialisation by year and the share of the terminal-year
  effect present in each year;
- its own P10 to P90 range at 2035 and its share of the portfolio band, an
  Euler allocation `Cov(term, sum) / Var(sum)` over 200,000 draws of the
  engine's own copula and jitter samplers (the shares add up to one; a
  tailwind's share can be negative because its draws move with the headwinds
  of its force);
- the chain from Shift value to portfolio contribution: the force's
  pass-through, the reach (the share of the gross-profit mix the exposures
  cover, the sum over the 52 cells of the cell's share times both exposures
  over 5) and the overlap correction in its cells.

The record also carries its reference run, the production recipe (3 x 50,000
iterations, seed 42) on the committed driver base and the default
configuration, and a digest of everything that run depends on: every
driver's scoring state, the force layers, the cell weights, the path and the
engine version. It records the production run the reference reproduces:
that run's terminal-year P10, median and P90 of each of the 13 categories,
read from its QA workbook (`prism/workbook.py`, `read_workbook`).

## The readings

`data/drivers/driver_analysis.json` holds one template per driver: authored
prose in which every figure the model produces is a named placeholder, such
as `{pp}` for its contribution, `{reach}`, `{peak_year}` or `{pool_europe}`
(`render_fields` in `prism/readings.py` lists them all). The renderer fills
the placeholders from the record and appends the basis line.
The rendered text is stored next to the template, carried into
`prism/seed_drivers.py` by the seed generator, and written into existing
databases by `scripts/sync_analysis.py`. The Drivers page renders the
four labels as small headings, the basis line in small type and a footnote
under the card: "Attribution at the score means, reconciled to the portfolio
median in the basis line; a reading authored on those figures. Read as
exposure if nobody acts, not as a forecast." The card is read-only for every
role.

The Shift Analysis uses the same arithmetic (`lib/driverAttribution.ts`, a
TypeScript port held to the Python decomposition by a parity fixture that
carries the inputs and the unscaled outputs), computed from the live drivers
and the served run's cell weights:

- The category drill-down ranks its contributing drivers with it, so a
  driver's rank there and its reading agree. It scales each category's
  contributions so they add up to that category's own terminal-year median.
  Its bars are shares of the category's gross movement, headwinds and
  tailwinds counted by size, and add up to 100 percent; the readings quote
  shares of the net shift, which are larger where tailwinds offset
  headwinds. The panel's footer says both.
- The Time Path's Expansion drivers and Contraction drivers filters show the
  sums of the expanding and of the contracting drivers' contributions in each
  category and year, scaled the same way, so the two parts add up to the
  cell's median (`signParts`); they are a split of the one simulated number,
  not a separate run.

The scaling factor is the median over the net at the means
(`reconciliationFactor`). On the published base it lies within one percent
of 1 in every category and year. Where expanding and contracting drivers
nearly cancel, or the drivers were edited after the run, the two can differ
in size or sign; a factor that is not positive or lies outside 1/2 to 2 is
not applied, and the contributions keep their values at the means rather
than being turned around or inflated.

Without the model configuration or the drivers there is no attribution: the
drill-down and the two filters name the input that did not load.

### Rules

A reading never contains:

- **a restated score**: no "probability 5 of 5", no GP1 share, no exposure or
  uncertainty value, in numerals or in words;
- **history**: no reference to a review, an earlier base, or what was
  corrected, merged or renamed. The reading describes the driver as it is;
- **a management response**: no "Henkel should", no lever, no mitigation;
- **a model figure typed by hand**: every number the model produces is a
  placeholder, so a re-scored driver, a new overlap correction or new cell
  weights can never leave a stale figure behind. Facts of the driver itself,
  such as the date of a law or a figure its sources report, are typed,
  because they are inputs. The peak year is a score and appears only as
  `{peak_year}`;
- **a fact outside the driver's own description and sources**: the reading
  adds arithmetic and interpretation, not new evidence;
- **rhetorical markers**: no dashes as punctuation, no bullet points inside
  the text, no exclamation marks, no filler words.

Contributions are stated in points of the portfolio shift with two decimals
("0.90 of the 5.6 points"), so that close drivers can be told apart; the
portfolio totals keep the headline's one decimal. Shares are whole
percentages, except a force's pass-through and a cell's share of the pool,
which carry one decimal; ranks are ordinals. Cells and categories are named
with the labels the page shows, in lower case, the hair categories in full
("fabric clean Europe", "hair colour", "body care"). A headwind is
stated against the net exposure the dashboard shows and its force's gross
headwind; a tailwind against the gross headwind it offsets and the gross
tailwind. The width of a driver's own range follows from its probability and
uncertainty scores alone, so the "because" in the band paragraph is the
rationale behind the uncertainty score, not something the model computed.
A reading runs 200 to 600 words whatever the driver's weight, because "why is
it small" needs as much explanation as "why is it large".

`tests/test_driver_analysis.py` enforces what a machine can check: the four
labels in order and the basis line, the length, the forbidden content (a
list of patterns for restated scores in numerals and in words, history,
management response, dashes, filler and the word trend), no unfilled
placeholder, the direction wording, an observable in the band paragraph, and
three template checks against hand-typed model figures (the shapes a model
figure takes in the prose, any rendered value typed into its own template,
and the peak year anywhere but `{peak_year}`). The rule on facts outside the description and sources is held by
the author and by the review of every regeneration.

## Regeneration

The readings depend on the driver base, the overlap correction, the cell
weights and the reference run. `python3 scripts/build_driver_analysis.py
--check` (in CI) recomputes the record and the parity fixture, re-renders
every text and fails when anything differs from the committed files. It also
fails when the inputs digest no longer matches the reference run, so a
re-scored base cannot keep readings reconciled to a median the model no
longer produces, and when the recorded reference run does not reproduce the
production run recorded with it. The check does not repeat the reference
run; `--reference` does. The record's figures may differ from the committed
ones by one unit in the fourth decimal (floating-point differences between
machines), the parity fixture by 1e-12 plus 1e-9 of the value, the reference
from the recorded production run by 1.5e-6 per quantile; the texts must
match exactly.

The build reads the driver base (`data/drivers/driver_base.json`); the
production run reads the database. The reference run reproduces a
production run only when both hold the same scores, and the check fails
otherwise. No tool carries scores between the two: a score changed on the
Drivers page is copied into the base by hand, and a score changed in the base
is entered on the Drivers page.

When the scores or the model's parameters change:

1. make sure the base and every database hold the same scores;
2. run the production run, `python3 scripts/run_production.py`, and rebuild
   the record against it:
   `python3 scripts/build_driver_analysis.py --reference --workbook runs/<its workbook>`.
   The reference run takes about as long as the production run;
3. read the re-rendered texts, in particular every comparative claim ("the
   widest range in the base"): the figures inside a comparative regenerate,
   the comparative itself does not;
4. run `python3 scripts/generate_seed.py` and commit the regenerated files;
5. run `python3 scripts/sync_analysis.py --dry-run`, then without
   `--dry-run`, against each database.

### On the finance shares

The readings are written for the estimated gross-profit mix, and stay on it.
Several templates compare shares of the estimate in words ("a region that
holds a twentieth of the estimated mix", "the two regions that together hold
most of it"), and those words are the author's, not placeholders, so
rendering the same templates on other shares would put the estimate's
comparisons next to the finance figures. The renderer therefore refuses a
record built on any other cell weights, and the build has no option for them.

When the production run uses the finance file, the dashboard's headline moves
away from the median the basis line names, and every card says so under its
basis line. Readings on the finance shares are a decision for the owner:
they need templates rewritten so that no comparison depends on the mix, and
a build that keeps the finance shares out of the repository.

## Limits

- The cross-terms of the compounding are attributed in proportion to the
  drivers' terms. The cell totals themselves are exact at the means.
- The band share is exact for the additive sum of the terms, not for the
  compounded total; the additive band is within 0.06 points of the run's band
  at both ends. It is quoted only where it is material.
- Comparative claims are the author's reading of the record on the day of the
  basis line, which is why every regeneration ends with a read of the texts.
- The readings are written on the estimated HCB gross-profit mix, not on
  Henkel P&L. Where a reading says a cell holds a share of the pool, that is
  the estimate's share (see "On the finance shares").
- A reading describes the driver base, not the live database. An admin edit
  on the Drivers page changes the drill-down at once and the reading only
  when the base carries the edit and the readings are regenerated.
