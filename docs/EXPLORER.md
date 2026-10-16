# The Profit Pool Explorer

The Profit Pool Explorer (a beta view) shows where the profit sits in the
Hair and the Laundry & Home Care industries and how each pool is developing.
It is separate from the simulation: nothing in it feeds the Shift Matrix, and
it is the one view built on amounts of money (elsewhere a figure in euros
appears only as quoted evidence in a text: a driver's description or sources,
or a Consumer Journey tile). Its figures are confidential and live in
`data/content/profit_pools.json`, which `scripts/build_content.py` validates
(`prism/explorer.py`: every view of the dashboard once, unique row ids,
revenue shares in (0, 1] that add up to 1 within 0.02 per view, GP1 margins
in (0, 1), every source with an http(s) link, a label, a grade and, where
given, a value basis from the allowed set) and writes to
`prism/explorer_content.py`; the API serves them to a signed-in user with a
role (`GET /api/v1/explorer`), and the view fetches them when it opens,
showing a skeleton until then and an unavailable notice with "Try again"
when the call fails. Nothing of them is in the dashboard's code. The
arithmetic is `lib/profitPoolData.ts`, which runs on the fetched views;
`tests/frontend/profitPoolData.test.ts` checks it on the views of the JSON,
and `tests/test_content.py` the validator and the generated module.

## The views

| View | What a bar is | Pool |
|---|---|---|
| Hair: value chain | one tier of the industry, from raw materials through brand owners and professional products to wholesale, store retail and e-commerce, sized on its own revenue | about €153bn of tier revenue; end-consumer retail about €82bn |
| Laundry: value chain | one tier from raw materials through brand owners to wholesale, store retail and e-commerce, plus laundry services and appliance makers, each sized on its own revenue | about €277bn of tier revenue; end-consumer retail about €87bn |
| Hair: categories | one Euromonitor Passport hair category | about €82bn at retail value |
| Home Care: categories | one Passport home-care category, eleven rows | about €186bn at retail value |
| Hair: core and adjacent | branded retail hair against adjacent pools: salon services, professional products, tools and appliances, scalp care, subscription and direct-to-consumer, supplements | about €254bn |
| Laundry: core and adjacent | branded laundry against adjacent pools: laundry services, appliance makers, surface care, on-demand laundry apps, hand and automatic dishwashing, air care, connected washing | about €315bn |

A view can cover less than the group it is chosen under, so its title says
what it covers: under Laundry & Home Care, the value chain is that of Laundry
Care, the core-and-adjacent view sets Laundry Care against the pools next to
it (surface care, dishwashing and air care among them), and the categories
view covers all of Home Care.

In the value-chain views the tiers deliberately count the same consumer euro
more than once, because each bar is that tier's own revenue; the subtitle
gives the end-consumer total next to the chain total.

A bar's width is its share of the view's revenue pool, its height the GP1
margin, so its area is the GP1 pool. The arrows show how that pool develops
over five years (FY2025 to 2030):

```
pool growth = (1 + revenue growth) x (1 + margin growth) - 1
margin growth = (GP1 in 2030 / GP1 today)^(1/5) - 1
```

where the 2030 margin is today's plus the row's drift in basis points. A
click on a bar splits its growth into the revenue and the margin part, with
the pools in euros.

## Grades and sources

Every figure links to a page that shows it, and every figure has a grade:

- **reported**: as published at the link;
- **derived**: arithmetic on published figures, with the basis stated;
- **estimate**: structured judgment, with the basis stated.

GP1 (net sales less direct cost of goods) is not disclosed by any company at
tier level, so the tier margins are PRISM estimates calibrated against the
companies' reported gross margins (the latest filings, mostly FY2025; GAAP
gross margin rather than adjusted figures). They are graded derived or
estimate, never reported, unless the company-level figure itself is shown.

Sizes come from the highest source on this ladder that has the figure:

1. Euromonitor Passport (retail selling price, all channels);
2. Kline, for professional hair only (manufacturer-level salon sales);
3. Circana or NielsenIQ (scanner sales in tracked channels, mostly US);
4. company filings (manufacturer net sales);
5. other research firms, only where all of the above are silent.

Each cited market size whose basis matters for the sizing carries its value
basis (`denomination`): `RSP` (retail selling price), `MSP` (manufacturer net
sales), `scanner-POS`, `salon-mfr` or `model`. Figures of different bases are
never added up in one bar. Retail value is roughly 1.8 to 2.2 times
manufacturer net sales, which is the value chain's "brand-owner net sales are
about half of retail value" bridge.

Amounts are shown in euros, converted from dollar sources at a planning rate
of 1.15; the source citations keep the figures exactly as published.

## The category views and Passport

The category views follow Euromonitor Passport's category tree, so an
internal Passport extract drops in row for row: Hair has the eight Passport
hair categories (Shampoos, Conditioners & Treatments, Colourants, Styling
Agents, Salon Professional, 2-in-1, Hair Loss Treatments, Perms & Relaxants),
Home Care the Passport home-care categories (laundry detergents, fabric
softeners and laundry aids; hand and automatic dishwashing; surface care,
toilet care, bleach and polishes; home insecticides; air care).

Passport values are licensed and cannot be copied into the tool, so every
category size is a public triangulation at retail value, graded derived or
estimate, with its full derivation in the source label and in the hover of its
source chip; the view's construction note gives the method, and its key
insights the error band (about 10 to 15 percent, insecticides about 25
percent). Once the sizes are checked against Passport internally, the anchors
in `data/content/profit_pools.json` are updated, their grades change to
reported and `python3 scripts/build_content.py` regenerates the module.

How the Passport rows relate to PRISM's categories is stated in each view's
construction note: laundry detergents cover Fabric Clean and Fabric Care
(Passport does not split them), fabric softeners are Fabric Finishers, laundry
aids are Laundry Additives, hand and automatic dishwashing map one to one,
surface care, bleach and polishes are the Hard-Surface Cleaner cluster, toilet
care is Toilet Care, home insecticides are Insect Control; salon professional
and air care have no PRISM category. Hair body care (Fa, Dial) sits in
Passport's bath and shower and deodorant categories, outside the hair view.
