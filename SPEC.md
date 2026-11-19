# token-radar-01 — project spec (the entry you are building)

Goal: the best pre-token protocol radar. The AI judge compares entries pairwise on 5 criteria
(most important first): (1) a working radar — watchlist fully covered, an implied value stated,
screenshots and code agree; (2) the value model derives from the snapshot's own figures
(TVL, change_7d, age without token), never a hardcoded name list, and separates protocols whose
token already trades from those still to come; (3) farm plans are concrete steps with costs and
time; (4) the dashboard is sortable, filterable, readable at a glance, with a per-protocol detail
view; (5) it looks deliberately made — chosen palette, consistent spacing, readable type.

## Hard constraints (the gate refuses otherwise)
- main.ts (Node 22, standard library only) reads input/snapshot.json, writes to /output
  (MAKEFUN_OUTPUT_DIR outside the grader): board.json, data.js, dossier.json via
  vendor/makefun-board.ts buildDossier, plus copies of dashboard/ and screenshots/.
- Runs must be deterministic byte-for-byte: no wall-clock, no randomness, no network.
- board.json: 100-4000 rows; cover EVERY protocol in the snapshot's watchlist; 3-12 farm steps
  per row, each 20-600 chars; implied_value_usd <= 1e14.
- dashboard/: static page, no network, <=400 files and <=4 MiB.
- screenshots/: exactly 3 PNGs already exist in screenshots/ — never generate them in code.
- Do not edit vendor/makefun-board.ts or LICENSE. Keep main.ts's CLI/env contract
  (--input, MAKEFUN_OUTPUT_DIR) and its stdout summary line format.

## The value model (rewrite lib/model.ts around this)
implied_value_usd = round(tvl_usd * base_multiple * growth_mult * maturity_mult * chain_mult)
- base_multiple by category (state the table in code): Lending 0.30, Dexs 0.28, CDP 0.25,
  Yield 0.22, Perp DEX 0.35, DEX Aggregator 0.24, Bridge 0.12, Liquid Staking 0.10,
  Liquid Restaking 0.15, Restaked BTC 0.12, RWA 0.20, Risk Curators 0.18, Launchpad 0.30,
  Synthetic 0.22; CEX / Exchange-like 0.05; anything else 0.20.
- growth_mult = clamp(1 + (change_7d / 100) * 2.5, 0.4, 2.2); when change_7d is null use 1.0.
- maturity_mult = 0.55 + 0.45 * min(age_days / 730, 1); when listed_at is null use 0.85.
- chain_mult = 1 + 0.06 * min(chains.length, 5).
- confidence (0-100): start 70; +10 if change_7d present; +10 if listed_at present;
  -15 if age_days < 30; +5 if tvl >= 50e6; cap 100.
- Keep rows for token-bearing protocols (mcap_usd or symbol or gecko_id not null) OUT of the
  ranked pre-token board but expose them as a separate "live set aside" list in the radar data
  (the starter already does this — keep the behavior, refine the wording).
- Rows carry: rank, slug, name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at,
  symbol, token_status, age_days, implied_value_usd, confidence, model {base_multiple,
  growth_mult, maturity_mult, chain_mult}, farm_steps[].

## Farm plans
Per protocol, derive 4-6 steps from its own data (category, chains, tvl): concrete capital
amounts scaled to TVL (small protocol: "$50-100 deposit"; large: "$200-500"), a specific action
per week for its category (provide liquidity on its main DEX / deposit to its vault / borrow
against collateral / open a perp position), a duration ("hold 30+ days across 2+ monthly
snapshots"), a claim-time safety step ("only claim from the protocol's own domain; never pay to
claim"), and a log-keeping step. Each step names its cost and time. No slogans.

## Dashboard (rewrite dashboard/*)
Static, dark "radar" theme: bg #0a0e12, panel #121821, borders #1f2937, accent #34d399, warn
#fbbf24, hot #f87171, text #e5e7eb, muted #9ca3af. System font stack, generous 12px grid.
- Header: title "Pre-Token Radar", a stat strip (watchlist covered X/40, pre-token ranked N,
  total implied value, snapshot date), and a short "How the model thinks" line stating the
  formula in plain words (the judge reads this).
- Board table: rank, name+category, chains (chips), TVL (compact $1.2B), 7d change (green/red),
  age, implied value, confidence bar. Sortable by clicking column headers.
- Filters: category multi-select, chain dropdown, text search, checkbox "watchlist only",
  minimum TVL slider, a reset link.
- Row click opens a detail drawer: full model breakdown (each multiplier explained), confidence
  rationale, farm plan as numbered steps with cost/time badges, and a risk notes line
  (low TVL = higher airdrop uncertainty; audit status unknown).
- Everything renders from data.js only. No network requests of any kind.

## Verification before you finish
Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
It must print the summary line and write out/ with no error. Verify out/board.json has >=100 rows
and every slug of the snapshot's watchlist array is present. Print a one-line report of both.
