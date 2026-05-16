# Smart Money Mirror — Sprint 4 Submission

## Project name
Smart Money Mirror

## Live demo
https://0xdungki.github.io/smart-money-mirror/

## GitHub
https://github.com/0xdungki/smart-money-mirror

## Short description
A Birdeye-powered Solana smart-money tracker. Instead of asking "what token is trending" (a lagging signal), it tracks **50 priority KOL/whale/sniper wallets** from a curated database of 687 labeled wallets and surfaces tokens where multiple KOLs are converging buy pressure right now — a leading signal.

## What makes it different from every other Birdeye Sprint submission

Most submissions answer "which token is trending?" — but trending = retail is already in.

Smart Money Mirror answers **"which wallets are accumulating right now, and what are they buying?"** — that's where smart money goes BEFORE the chart moves.

It pairs two unique inputs:
1. **A curated database of 687 labeled Solana wallets** (KOLs like Cented7, Cupsey, Euris, Daumen; whales; snipers; high-IQ traders; smart pumpfun wallets) with winrate and 30d realized profit data.
2. **Birdeye's `/trader/txs/seek_by_time` endpoint** to pull recent trades from each labeled wallet in real time.

Cross-referencing produces the **KOL Convergence** view: tokens where 2+ labeled KOLs are buying right now, with no sells. Plus a **Trending Token Smart-Money Signal** view that tags each top-trader with their KOL identity, winrate, and 30d profit instead of just an opaque address.

## Birdeye API endpoints used

| Endpoint | Purpose |
|---|---|
| `GET /defi/token_trending` | Discover trending Solana tokens |
| `GET /defi/v2/tokens/new_listing` | Pull fresh listings (where snipers operate) |
| `GET /defi/v2/tokens/top_traders` | Top traders per token, with PnL + buy/sell volume |
| `GET /trader/gainers-losers` | Today's top global gainers (PnL) |
| `GET /trader/txs/seek_by_time` | **Per-wallet recent trades — the KOL feed engine** |

Each refresh uses 90+ API calls (well above the 50 minimum).

## Real signal captured at submission time

From this morning's auto-scan:
- **F.03** — KOL-Gake + KOL-West buying, +$2.32K net
- **RABBIT** — KOLpf-danny + KOL-WaiterG, +$1.95K net
- **Eagle** — KOL-MarvinETH + KOL-xunle, +$943 net
- **DIRECTOR** — KOL-fibs single buy $5.4K
- **SPCX** — KOLpf-paingelz buying into trending pump

Every result is on-chain verifiable, with one-click links to Birdeye + Dexscreener + copy-CA on every card.

## Key features

- **KOL Convergence panel** — labeled wallets buying same token (the unique value)
- **Trending tokens with smart-money tags** — top traders shown with their KOL identity ("KOL-Cupsey 78% WR · 30d +$1.2M") instead of `Cyae…6cFx`
- **Top wallets leaderboard** — 40 best-scored wallets sorted by smart-money score that combines: multi-token presence, PnL, accumulation behavior, log-volume, winrate, 30d profit, and label-category bonus
- **Per-token signal classification** — hot / warm / cold based on KOL/whale/sniper presence
- **One-click Birdeye + Dexscreener** for every token, **Birdeye profile** for every wallet
- **Filter by signal · search by symbol/name · click-to-copy** addresses
- **Read-only** — no wallet, no swaps, no private keys

## Stack

- Node.js fetch pipeline (no backend, no DB) → static `dist/data.json`
- Single-file vanilla HTML/CSS/JS dashboard — works offline once `data.json` is loaded
- Hosted on GitHub Pages, refresh by re-running `npm run all`
- Drop-in for any cron / GitHub Action / Hermes-style automation
