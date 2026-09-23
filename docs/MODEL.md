# The model

PRISM answers one question: if the listed drivers play out as scored and
nobody reacts, how much of today's gross profit (GP1) does each category of
Henkel Consumer Brands (HCB) gain or lose by each year from 2026 to 2035? The
answer is a distribution, because every driver's materialisation is
uncertain; PRISM reports its percentiles.

This document describes the engine (`prism/engine.py`) and its configuration
(`prism/config.py`). docs/DRIVERS.md describes the inputs a driver carries,
docs/DRIVER_ANALYSIS.md the per-driver attribution built on the same
arithmetic.

## Reading the output

- **Relative, never absolute.** A shift of -0.058 means 5.8 percent of the
  gross profit of today's business. A reader applies it to their own figures:
  `GP1_2035 = GP1_today x (1 + shift)`.
- **Ceteris paribus.** The engine propagates external drivers only. There is
  no pricing response, no innovation and no competitive reaction by Henkel or
  anyone else, so a negative total means exposure if nothing changes, not a
  forecast that the pool will shrink.
- **Structured judgment, not a validated forecast.** The inputs are expert
  scores and the method has not been tested against history. Nothing in the
  interface or the documentation may claim predictive validity.
- **The cells.** The engine computes 52 composite cells, 13 categories times
  4 regions, and rolls them up to categories and to the portfolio with each
  cell's share of HCB gross profit.

## Parameters

| Parameter | Default | Where it comes from |
|---|---|---|
| Force weights | 1/6 for each of the six forces | Equal by design |
| Attenuation per force | Consumer 0.487, Customer 0.417, Technology 0.412, Government 0.446, Environmental 0.378, Competitive 0.479 | The overlap correction (below), `scripts/compute_overlap_correction.py` |
| Within-force overlap | Consumer 0.100, Customer 0.221, Technology 0.384, Government 0.123, Environmental 0.401, Competitive 0.100 | The same |
| Correlation within a force | 0.3 | Structured judgment |
| Correlation across forces | a 6 x 6 matrix, values 0.04 to 0.22 | Structured judgment; positive definite as entered |
| Cell weights | the estimated HCB gross-profit mix, 13 x 4 | `scripts/build_cell_weights.py`; replaced by the finance file at run time |
| Base year, path | 2025; 2026 to 2035 | |
| Peak-year jitter | on, each driver within the width its uncertainty score sets | `peak_year_jitter`; off, every driver peaks in its own year |
| Iterations | 3 chains x 50,000 in production, master seed 42 | `PRODUCTION_CHAINS`, `PRODUCTION_ITERATIONS`, `PRODUCTION_SEED` |

The configuration is code: changing a parameter is a reviewed change to
`prism/config.py` (or to the generator that writes it) followed by a new
production run. The dashboard shows the configuration read-only.

## One iteration

For every iteration the engine draws each driver's materialisation, turns it
into a signed effect in every cell and year, and compounds the effects of the
six forces. The steps, for driver `j`, category `c`, region `r` and year `y`:

### 1. The probability draw

Each driver has a Beta prior on the probability that its effect materialises,
set from its 1 to 5 probability score `p` and its uncertainty score `u`. The
prior's mean is always `p / 6`; the uncertainty score sets its concentration
`kappa = alpha + beta`:

| Uncertainty `u` | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Concentration `kappa` | 24 | 16 | 10 | 6 | 4 | 3 |
| Peak-year jitter, years | 0 | 1 | 1 | 2 | 3 | 4 |

```
alpha = max(0.5, kappa x p / 6)      beta = max(0.5, kappa - alpha)
```

The prior means by probability score are 0.17, 0.33, 0.50, 0.67 and 0.83.
The priors are structured judgment and are never updated from data.

The draws are correlated through a Gaussian copula. The driver-level
correlation matrix `R` takes the within-force value for two drivers of the
same force and the force-pair value otherwise. Then

```
Z ~ N(0, R)      U = Phi(Z), clipped to [1e-12, 1 - 1e-12]      p_j = BetaInv(U_j; alpha_j, beta_j)
```

The clip is float safety only, so the Beta tails are not cut off. If `R` is
not positive definite the engine repairs it, which weakens every correlation,
and records an integrity event. The production run checks `R` on the loaded
drivers first and refuses to start in that case unless told to go ahead
(`--allow-nonpsd`).

### 2. The signed effect

```
s_j = p_j x g_j x d_j
```

with `g_j` the share of the category's gross profit the driver can move at
full materialisation (in (0, 1]) and `d_j` its direction, +1 for expansion
and -1 for contraction. A driver without `g_j` stops the run: there is no
default. The deterministic counterpart, `E[s_j] = (p / 6) x g_j x d_j`, is the
"Expected effect" column of the Drivers page and the driver's
`expected_effect`.

### 3. Timing

The effect is zero up to and including the onset, the later of the base year
and the driver's start year, and complete from the peak year on. In between
it follows the driver's diffusion curve, with `t` the fraction of the way
from onset to peak:

| Curve | Share materialised at `t` |
|---|---|
| `linear` | `t` |
| `front_loaded` | `sqrt(t)` |
| `back_loaded` | `t^2` |
| `step_function` | 5 percent until `t = 0.8`, then a linear rise to 100 percent |
| `s_curve` | a logistic with slope 12 centred at `t = 0.5`, rescaled to run from 0 to 1 |

Each iteration moves every driver's peak year by an integer offset `k`
between `-w` and `+w`, drawn with weights `w + 1 - |k|` (a symmetric
triangle), where `w` is the driver's jitter width from the table above. A
jittered peak never falls on or before the onset: it stops at the year after
it. This gives the timing bands their meaning, "arrives a year earlier or
later".

Every driver carries its own onset, peak year, curve and uncertainty score,
a score for every category and every region, and a value-chain epicentre.
The engine has no defaults for any of them: a driver that lacks one, or
whose peak does not come after its onset, is refused before the first draw
(`prism/drivers.py`, `simulation_problems`).

### 4. Exposure

```
x_jcr = (category exposure_jc / 5) x (regional exposure_jr / 5)
```

Exposure describes the mechanism: where the driver acts and how strongly.
Whether HCB has business in a cell enters only through the cell weights
(step 7). A score of 0 means the driver does not act there.

### 5. The force sum and the within-force overlap

Drivers of one force often share a mechanism (three retail drivers can
describe one squeeze on the trade margin), and adding their effects in full
would count that mechanism more than once. Per force `f`, cell and year:

```
S_fcr(y) = D_fcr x sum over j in f of  s_j x m_j(y) x x_jcr

D_fcr = clip(1 - ov_f x (n_eff - 1) / n_eff, 0.1, 1)        (1 when n_eff <= 1)
n_eff = (sum of mu)^2 / (sum of mu^2),   mu_j = |E[s_j]| x x_jcr
```

`m_j(y)` is the materialised share from step 3 and `ov_f` the force's
within-force overlap. `n_eff` is the effective number of contributing drivers:
it equals their count when they contribute equally, approaches 1 when one
dominates, and changes in proportion to a driver's size, so a small driver
changes it little. The dampening is set from the score means, and with every
overlap below 0.5 adding a driver moves its force's total at the means in the
driver's own direction: a small tailwind never worsens a cell and a small
headwind never improves it. A single iteration, whose draws differ from the
means, can deviate slightly.

### 6. Compounding across forces

```
F_fcr(y) = max(0, 1 + w_f x a_f x S_fcr(y))
shift_cr(y) = product over the six forces of F_fcr(y)  -  1
```

`w_f` is the force weight and `a_f` its attenuation. A factor at or below
zero (one force removing more than the whole pool of a cell) is floored at
zero, which is -100 percent, and the run counts such cases in an integrity
event.

The product `w_f x a_f` is the force's pass-through: 6.3 percent
(Environmental) to 8.1 percent (Consumer). A driver drawn at probability 1
with a GP1 share of 1 and full exposure moves its force's factor by that much.
This is why a driver's contribution to the portfolio is a small fraction of
its expected effect.

### 7. The roll-up

With `W_cr` each cell's share of HCB gross profit (the 52 shares sum to 1):

```
category shift_c  = sum over r of W_cr x shift_cr  /  sum over r of W_cr
portfolio shift   = sum over c and r of W_cr x shift_cr
```

A cell with no HCB gross profit carries a zero share and contributes nothing.
A category with a zero share in every region is shown as the equal-weight
average of its cells, carries no weight in the portfolio, and the run records
an integrity event.

## After the iterations

- **Percentiles.** Every percentile uses `np.percentile` with linear
  interpolation. Each category, each cell and the portfolio get the P10, P25,
  median, P75, P90, mean and standard deviation per year.
- **Velocity.** The distribution of each iteration's year-on-year change, not
  the difference of two medians.
- **The portfolio band.** The portfolio shift is computed per iteration and
  its percentiles are taken afterwards. Averaging the category bands would
  ignore how the categories partly offset one another and give a band that is
  too wide.
- **The lenses.** The Shift Analysis splits each category's median by force,
  by value-chain stage and by region. A driver's weight in a category is
  `|E[s_j]| x category exposure / 5`; the force lens multiplies it by the
  force weight, the region lens by the regional exposure / 5 and the cell's
  share of the category's gross profit, and the value-chain lens gives it
  wholly to the driver's epicentre stage (propagation along the chain is not
  modelled). Each lens's shares add up to 1, so every lens adds up to the same
  median; a category no driver reaches has a median of zero and no shares. The
  lenses are attributions of one simulated number, not separate simulations,
  and they use magnitudes: a lens shows how much of a median each force, stage
  or region accounts for, not the direction of its own push. The per-driver
  attribution behind the drill-down and the PRISM Analysis
  (docs/DRIVER_ANALYSIS.md) evaluates the engine's arithmetic itself, with
  signs, timing and the overlap correction, so its totals by force or region
  can differ from these lenses.
- **Monte Carlo standard error.** A bootstrap (200 resamples) of each
  category's terminal-year median, P10 and P90. At 3 x 50,000 iterations it is
  0.001 to 0.002 percentage points for the medians and P10s and at most about
  0.003 for the P90s, far below the one-decimal display. It measures sampling
  noise only, never model error. The About this model section of the Shift
  Analysis shows the largest standard error of a category median next to the
  seed stability.
- **Chains and seed stability.** Production runs three chains with seeds
  `42 + i x 1,000,003` and pools them for every published number. The spread
  of the three chains' terminal-year portfolio medians is reported as seed
  stability: again sampling noise only.

## Integrity events

A run records what it had to repair or clip, and what changed in its inputs,
and the dashboard shows the list next to the run.

| Event | Raised when |
|---|---|
| `input_drift` | on every production run after the first: how the drivers' scores changed since the previous run, or that nothing changed |
| `correlation_pd_repair`, `cholesky_repair` | the correlation matrix had to be repaired |
| `compounding_floor` | a compounding factor was floored at -100 percent |
| `cell_weight_zero_row` | a category has a zero gross-profit share in every region |

The input drift compares a fingerprint of every driver's scoring state
(probability, GP1 share, direction, force, uncertainty, onset, peak year,
curve, category and regional exposure, value-chain stage) with the
fingerprint stored with the previous run. It is telemetry, not a gate: a
planned re-scoring should drift, and the point is that drift never goes
unnoticed.

## The overlap correction

Some mechanisms are carried by more than one driver or force: a packaging
levy is both a Government and an Environmental matter. The overlap
correction keeps such a mechanism from being counted twice. It is structured
judgment built on the drivers' category exposure vectors, not a fit to
outcomes. `scripts/compute_overlap_correction.py` computes it in five steps:

1. the weighted Jaccard similarity of every pair of drivers' 13-category
   exposure vectors;
2. the excess over the random-pair baseline, so that breadth shared by chance
   counts as noise;
3. across forces only, an asymmetric force-size factor `sqrt(n_j / n_i)`,
   capped at 1.5;
4. additive mechanism adjustments, per force (to the within-force overlap)
   and per force pair, each with its written reason in the script;
5. clamps: within a force to [0.10, 0.45], across forces to [0.00, 0.45].

The result is the within-force overlap `ov_f` of step 5 above and the
cross-force overlap matrix `O`, where `O[i][j]` is the share of force `i`'s
signal already carried by force `j` (not symmetric by design). The
attenuation of a force is `0.5 x (1 - m)`, where `m` is the mean of its row
in `O` over the five other forces. The record is
`data/parameters/overlap_correction.json`; the script also writes the three
layers to `prism/overlap_correction.py`, which the model's defaults read. The
correction is computed from the driver base, not from the live database: it
is recomputed whenever the categories or the base's exposure scores change
(`--check` fails until it is), and an exposure edit made on the Drivers page
moves it only once the base carries the edit.

## The cell weights

The roll-up weights each of the 52 cells with its share of HCB gross profit.
Until finance provides the real shares, the engine uses an **estimate built
from public reporting and category knowledge. It is not Henkel P&L.** The
Shift Analysis says so under its heading whenever the served run stands on
it, and so do the run details under About this model, Settings and the QA
workbook; the basis line of every PRISM Analysis names the estimated mix.

`scripts/build_cell_weights.py` builds it as

```
share_cr = (category's share of its block) x (block's share of HCB) x (GP1 margin index of the category)
           x (the category's own regional mix), normalised to 1
```

with the blocks Laundry & Home Care (62 percent) and Hair & Body (38
percent). Each category has its own regional mix, so the matrix is not a
region vector times a category vector and regional concentration moves the
category numbers. Every input carries a grade: **B** public reporting
supports it, **E** defensible but unverified, **G** low-confidence guess. The
record is `data/parameters/cell_weight_estimate.json`, the matrix the
model's defaults read `prism/cell_weight_estimate.py`; Settings shows the
whole derivation whenever the served run used this estimate.

The estimate's marginals are: categories Colour 17.1, Care 13.0, Styling 7.1,
Body 8.0, Fabric Clean 24.1, Fabric Care 4.3, Fabric Finishers 6.7, Laundry
Additives 2.6, Hand Dishwash 3.4, Auto Dishwash 6.5, Hard-Surface Cleaner
4.1, Toilet Care 2.5, Insect Control 0.6 percent; regions Europe 51.4, North
America 23.2, Asia 5.6, High Growth 19.8 percent.

The finance shares replace the estimate at run time
(`run_production.py --cell-weights FILE`, docs/OPERATIONS.md). The file is
kept outside the repository; absolute figures in it are divided by their
total before the engine sees them and are never stored. Every run records the
weights it applied and their source.

## Reproducibility

The same drivers, the same configuration and the same seed give the same
result, bit for bit, on the same numerics. The drivers are always loaded in
id order, because the copula pairs draws with drivers by position. Every run
records its seeds and the scipy and numpy versions it computed with. scipy is
a hard requirement: the engine refuses to import without it, and there is no
approximate fallback. `tests/test_golden_pipeline.py` pins the engine's
output on a fixed set of drivers; the pins change only with a deliberate
change of the model (together with a new `MODEL_VERSION`) or of those
drivers, in the same commit.

## The reference result

On the current driver base, the estimated HCB mix and the production recipe
(3 x 50,000 iterations, seed 42), the 2035 portfolio median is -5.58 percent,
with a P10 to P90 band of -6.16 to -4.89 percent. Europe, the most exposed
region and half of the estimated pool, carries 3.65 of the 5.58 points. This
figure rests on the estimated mix, not on Henkel P&L, and it changes when
the finance shares are loaded. `tests/test_driver_analysis.py` checks that
this paragraph states the reference run of the attribution record.

## Known limits

These are properties of the design, stated so that nobody mistakes them for
bugs or reads more into the numbers than they hold.

- **No hindcast.** The method has not been validated against history (see
  the first section).
- **Listed drivers only.** The bands reflect the magnitude and timing
  uncertainty of the drivers in the base. A driver is scored in one direction
  with a probability; the model has no two-sided magnitudes and knows nothing
  about drivers nobody listed.
- **No management response and no competitive position.** Henkel's own
  position in a category (share, price tier, brand strength) is not an input;
  every cell reacts to the drivers as the exposure scores describe them.
- **Dependence.** The copula is Gaussian, so it has no tail dependence, and
  the correlations are restricted to [0, 1] on the latent scale: the model has
  no negative dependence between drivers.
- **Confidence is display only.** A driver's confidence (how well its
  present state is evidenced) is shown on the Drivers page and does not enter
  the simulation; the uncertainty score does.
- **The value chain is an attribution.** The value-chain epicentre feeds the
  value-chain lens only, never the shift, and no effect propagates along the
  chain.
- **Structured-judgment layers.** The overlap correction (every adjustment
  with its written reason), the correlations and the cell-weight estimate
  (every input graded) are judgment, not estimated from data.
