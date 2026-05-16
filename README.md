# Smart Money Mirror

> Find Solana smart-money wallets **early to rotation** by cross-referencing top traders across every trending token. Powered by [Birdeye](https://birdeye.so).

**Live demo:** [0xdungki.github.io/smart-money-mirror](https://0xdungki.github.io/smart-money-mirror/)

## Why this is different

Most Birdeye tools answer **"which token is trending?"** — a lagging signal. By the time you see a token trending, retail is already in.

Smart Money Mirror answers a different question: **"which wallets are touching multiple trending tokens at once, and are they making money doing it?"**

That's the *leading* signal. When the same wallet shows up in 3+ trending tokens with positive PnL, that wallet is a real rotation player. Following them is more useful than following the tokens.

## How it works

1. Pull current trending tokens from Birdeye (`/defi/token_trending`).
2. For each trending token, pull top 10 traders by volume from Birdeye (`/defi/v2/tokens/top_traders`).
3. Build a wallet-centric index: every wallet → list of trending tokens it appears in.
4. Score each wallet on a smart-money index combining:
   - **Breadth** — how many trending tokens it touched (multi-token presence)
   - **PnL** — total realized + unrealized profit across those positions
   - **Behavior** — accumulating vs. distributing (buy/sell ratio)
   - **Volume** — log-weighted USD volume
5. Tier wallets: **alpha** (3+ tokens, profitable), **smart** (2+ tokens, profitable), **cross-token** (2+ tokens), **profit-only** (1 token, profitable).
6. Tier each token by smart-money signal: **hot** (multiple alpha/smart wallets present) → **warm** → **cold**.

## Features

- **Token cards with smart-money signal badge** — instantly see which trending tokens have alpha money flowing in
- **Cross-token reveal** — every trader row shows which other trending tokens that wallet is also in
- **Alpha wallet leaderboard** — top 30 multi-token wallets, sortable by smart-money score
- **One-click Birdeye + Dexscreener links** for every token
- **One-click wallet → Birdeye profile** for every smart-money wallet
- **Filter by signal tier** (hot / warm / cold) + **search by symbol or name**
- **Read-only** — no wallet connect, no swaps, no private keys

## Birdeye endpoints used

| Endpoint | Purpose |
|---|---|
| `GET /defi/token_trending` | Discover currently trending Solana tokens |
| `GET /defi/v2/tokens/top_traders` | Pull top traders per token with PnL + buy/sell volume |

Both endpoints are read-only. Min 50 API calls per refresh (well above qualification).

## Quick start

```bash
git clone https://github.com/0xdungki/smart-money-mirror
cd smart-money-mirror
cp .env.example .env  # add your BIRDEYE_API_KEY
npm install
npm run all     # fetch + build → dist/
npm run serve   # http://localhost:4173
```

## Architecture

```
scripts/fetch.js  → Birdeye API → data/latest.json (raw)
scripts/build.js  → cross-reference → dist/data.json (scored)
public/index.html → dist/index.html  (static dashboard)
```

Static-first by design: dashboard is a single HTML file reading one JSON. Hostable anywhere (GitHub Pages, Vercel, IPFS). No backend required.

## Refresh cadence

Each `npm run all` ≈ 22 API calls (1 trending + 20 top_traders per snapshot, with retry budget). At 50 RPS rate limit you can refresh every minute comfortably.

For automated refresh + alerts, drop this into a cron / GitHub Action and have it write `dist/data.json` on a schedule.

## Roadmap (post-sprint)

- Wallet-PnL track-record over multiple refreshes (alpha wallet *consistency* score)
- Telegram alert: "wallet X just appeared in token Y" when an existing alpha wallet enters a new trending token
- Per-wallet drilldown page with token-by-token PnL history
- Optional integration with `gainers-losers` endpoint to enrich wallet score with global PnL rank

## License

MIT
