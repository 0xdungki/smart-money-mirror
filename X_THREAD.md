## X Thread Draft — Smart Money Mirror — Sprint 4 Submission

═══════════════════════════════════════
TWEET 1 (hook — POST FIRST, this is the main post you submit to Superteam)
═══════════════════════════════════════

Most Birdeye dashboards ask "what token is trending?"

That's a lagging signal — by the time you see it, retail is already in.

I built one that asks: "which KOLs are buying right NOW, and where are they converging?"

Live: https://0xdungki.github.io/smart-money-mirror/

Built with @birdeye_data API for Sprint 4 of the BIP Competition 🧵

#BirdeyeAPI #Solana #BuildInPublic

═══════════════════════════════════════
TWEET 2 (the unique input)
═══════════════════════════════════════

The unfair advantage:

A curated database of 687 labeled Solana wallets:
• 102 KOLs (Cented7, Cupsey, Euris, Daumen, fibs…)
• 22 whales
• 168 smart pumpfun wallets  
• 11 high-IQ traders
• 4 snipers
• Plus 286 wallets with full winrate + 30d PnL stats

No other submission has this.

═══════════════════════════════════════
TWEET 3 (the engine)
═══════════════════════════════════════

The engine pulls live data from 5 Birdeye endpoints:

→ /trader/txs/seek_by_time — per-wallet recent trades (the killer endpoint)
→ /defi/token_trending — current heat
→ /defi/v2/tokens/new_listing — fresh launches where snipers operate  
→ /defi/v2/tokens/top_traders — who's actually trading each token
→ /trader/gainers-losers — today's global top-PnL wallets

90+ API calls per refresh.

═══════════════════════════════════════
TWEET 4 (the killer feature)
═══════════════════════════════════════

The KOL Convergence view shows tokens where 2+ labeled wallets are accumulating right now.

Right now (live):
🔥 F.03 — KOL-Gake + KOL-West buying, +$2.3K
🔥 RABBIT — KOLpf-danny + KOL-WaiterG, +$1.95K
🔥 Eagle — KOL-MarvinETH + KOL-xunle, +$943
🔥 DIRECTOR — KOL-fibs single $5.4K buy

═══════════════════════════════════════
TWEET 5 (the smart-money signal on trending)
═══════════════════════════════════════

On every trending token, top traders aren't shown as cryptic addresses anymore.

You see "KOL-Cupsey · 78% WR · 30d +$1.2M" on the row.

Tokens get tagged hot/warm/cold based on which KOLs/whales/snipers are present.

Reading the chart 1 second instead of 5 minutes.

═══════════════════════════════════════
TWEET 6 (open source + close)
═══════════════════════════════════════

100% open source. Read-only. No wallet, no swaps, no private keys.

→ https://github.com/0xdungki/smart-money-mirror
→ Live: https://0xdungki.github.io/smart-money-mirror/

If this saves you from one bad rotation entry, it paid for itself.

Built for @birdeye_data Sprint 4. RT if it helps you 🦅

═══════════════════════════════════════
SUBMISSION FORM (paste into Superteam Earn)
═══════════════════════════════════════

Project name:
Smart Money Mirror

Project link (live):
https://0xdungki.github.io/smart-money-mirror/

GitHub:
https://github.com/0xdungki/smart-money-mirror

X post link:
[paste the URL of TWEET 1 after you post it]

Birdeye endpoints used:
/defi/token_trending, /defi/v2/tokens/new_listing, /defi/v2/tokens/top_traders, /trader/gainers-losers, /trader/txs/seek_by_time

Description:
Smart Money Mirror is a Birdeye-powered Solana smart-money tracker. Instead of asking "what token is trending?" (lagging signal), it tracks 50 priority KOL/whale/sniper wallets from a curated database of 687 labeled Solana wallets and surfaces tokens where multiple KOLs are converging buy pressure in real time. The unique inputs are (1) the curated labeled-wallet database with winrate and 30d realized profit data, and (2) Birdeye's /trader/txs/seek_by_time endpoint used to pull recent trades from each labeled wallet on every refresh. Cross-referencing produces the KOL Convergence view: tokens where 2+ labeled KOLs are buying right now with no sells. Trending tokens additionally get tagged with each top-trader's KOL identity, winrate, and 30d profit instead of an opaque address. Read-only, single-file static dashboard, hostable anywhere.
