// Smart Money Mirror — Birdeye fetch pipeline
// Pulls trending tokens, then top traders per token, builds raw dataset.

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.BIRDEYE_API_KEY;
const CHAIN = process.env.BIRDEYE_CHAIN || 'solana';
const TRENDING_LIMIT = Math.min(parseInt(process.env.TRENDING_LIMIT || '20', 10), 20);
const NEW_LISTING_LIMIT = Math.min(parseInt(process.env.NEW_LISTING_LIMIT || '15', 10), 20);
const TOP_TRADERS = Math.min(parseInt(process.env.TOP_TRADERS_PER_TOKEN || '10', 10), 10);
const BASE = 'https://public-api.birdeye.so';

if (!KEY) { console.error('Missing BIRDEYE_API_KEY in .env'); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function birdeye(endpoint) {
  const url = BASE + endpoint;
  const res = await fetch(url, {
    headers: {
      'X-API-KEY': KEY,
      'x-chain': CHAIN,
      'accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${endpoint}`);
  const json = await res.json();
  if (json.success === false) throw new Error(`API err ${endpoint}: ${json.message}`);
  return json.data;
}

async function withRetry(fn, label, attempts = 3, delay = 1500) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const wait = delay * (i + 1);
      console.warn(`[retry] ${label} attempt ${i + 1}/${attempts} failed: ${e.message} — sleep ${wait}ms`);
      await sleep(wait);
    }
  }
  throw last;
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[fetch] Smart Money Mirror — ${startedAt}`);
  console.log(`[fetch] chain=${CHAIN}  trending=${TRENDING_LIMIT}  new=${NEW_LISTING_LIMIT}  top_traders_each=${TOP_TRADERS}`);

  // 1a. Trending tokens
  const trending = await withRetry(
    () => birdeye(`/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=${TRENDING_LIMIT}`),
    'trending'
  );
  const trendingTokens = (trending.tokens || []).map(t => ({ ...t, _source: 'trending' }));
  console.log(`[fetch] trending tokens: ${trendingTokens.length}`);

  // 1b. New listings — where snipers/early wallets show up
  let newTokens = [];
  try {
    const nl = await withRetry(
      () => birdeye(`/defi/v2/tokens/new_listing?limit=${NEW_LISTING_LIMIT}`),
      'new_listing'
    );
    newTokens = (nl.items || []).map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      logoURI: t.logoURI,
      liquidity: t.liquidity,
      decimals: t.decimals,
      _source: 'new_listing',
      _liquidityAddedAt: t.liquidityAddedAt
    }));
    console.log(`[fetch] new listings: ${newTokens.length}`);
  } catch (e) {
    console.warn(`[fetch] new_listing FAILED: ${e.message}`);
  }

  // 1c. Top gainers (today) — pulls top-PnL wallets directly, regardless of token
  let gainers = [];
  try {
    const g = await withRetry(
      () => birdeye(`/trader/gainers-losers?type=today&sort_by=PnL&sort_type=desc&offset=0&limit=10`),
      'gainers'
    );
    gainers = (g.items || []).map(x => ({
      owner: x.address,
      pnl: x.pnl,
      volume: x.volume,
      tradeCount: x.trade_count
    }));
    console.log(`[fetch] today's top gainers: ${gainers.length}`);
  } catch (e) {
    console.warn(`[fetch] gainers FAILED: ${e.message}`);
  }

  // De-dup by address (trending wins over new_listing if overlap)
  const seen = new Set();
  const tokens = [];
  for (const t of [...trendingTokens, ...newTokens]) {
    if (!t.address || seen.has(t.address)) continue;
    seen.add(t.address);
    tokens.push(t);
  }
  console.log(`[fetch] total unique tokens: ${tokens.length}`);

  // 2. Top traders for each token
  const tokenTraders = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    try {
      const td = await withRetry(
        () => birdeye(`/defi/v2/tokens/top_traders?address=${t.address}&time_frame=24h&sort_type=desc&sort_by=volume&offset=0&limit=${TOP_TRADERS}`),
        `top_traders/${t.symbol}`
      );
      tokenTraders.push({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        rank: t.rank,
        source: t._source,
        price: t.price,
        liquidity: t.liquidity,
        volume24hUSD: t.volume24hUSD,
        price24hChangePercent: t.price24hChangePercent,
        volume24hChangePercent: t.volume24hChangePercent,
        marketcap: t.marketcap,
        fdv: t.fdv,
        logoURI: t.logoURI,
        traders: (td.items || []).map(x => ({
          owner: x.owner,
          trade: x.trade,
          tradeBuy: x.tradeBuy,
          tradeSell: x.tradeSell,
          volumeUsd: x.volumeUsd,
          volumeBuyUSD: x.volumeBuyUSD,
          volumeSellUSD: x.volumeSellUSD,
          totalPnl: x.totalPnl,
          realizedPnl: x.realizedPnl,
          unrealizedPnl: x.unrealizedPnl
        }))
      });
      console.log(`  [${i + 1}/${tokens.length}] ${(t.symbol || '?').padEnd(12)} ${t._source.padEnd(11)} traders=${(td.items || []).length}`);
    } catch (e) {
      console.warn(`  [${i + 1}/${tokens.length}] ${t.symbol || '?'} FAILED: ${e.message}`);
      tokenTraders.push({
        address: t.address, symbol: t.symbol || '?', name: t.name || '', rank: t.rank,
        source: t._source,
        price: t.price, liquidity: t.liquidity, volume24hUSD: t.volume24hUSD,
        price24hChangePercent: t.price24hChangePercent,
        volume24hChangePercent: t.volume24hChangePercent,
        marketcap: t.marketcap, fdv: t.fdv, logoURI: t.logoURI,
        traders: [], error: e.message
      });
    }
    await sleep(700); // gentle on rate limits
  }

  // 3. Persist raw
  const outDir = path.resolve('data/raw');
  await fs.mkdir(outDir, { recursive: true });
  const stamp = startedAt.replace(/[:.]/g, '-');
  const payload = { startedAt, gainers, tokenTraders };
  await fs.writeFile(path.join(outDir, `snapshot-${stamp}.json`), JSON.stringify(payload, null, 2));
  await fs.writeFile(path.resolve('data/latest.json'), JSON.stringify(payload, null, 2));
  console.log(`[fetch] saved data/latest.json (${tokenTraders.length} tokens, ${tokenTraders.reduce((a, x) => a + x.traders.length, 0)} trader rows, ${gainers.length} gainer rows)`);
}

main().catch(e => { console.error('[fetch] FATAL', e); process.exit(1); });
