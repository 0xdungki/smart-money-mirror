// Smart Money Mirror — KOL Live Feed
// Pulls recent trades from top labeled wallets (KOLs, whales, snipers)
// and surfaces tokens where multiple labeled wallets are converging.

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.BIRDEYE_API_KEY;
const CHAIN = process.env.BIRDEYE_CHAIN || 'solana';
const KOL_LIMIT = parseInt(process.env.KOL_LIMIT || '60', 10);
const TXS_PER_WALLET = Math.min(parseInt(process.env.TXS_PER_WALLET || '15', 10), 20);
const BASE = 'https://public-api.birdeye.so';

if (!KEY) { console.error('Missing BIRDEYE_API_KEY in .env'); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function birdeye(endpoint) {
  const res = await fetch(BASE + endpoint, {
    headers: { 'X-API-KEY': KEY, 'x-chain': CHAIN, 'accept': 'application/json' }
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
      console.warn(`[retry] ${label} ${i + 1}/${attempts}: ${e.message} — sleep ${wait}ms`);
      await sleep(wait);
    }
  }
  throw last;
}

// Sort labels by priority: KOL > Whale > Sniper > HighIQ > SmartW > SmartPF > Early > Side > JP > Tagged
const CATEGORY_PRIORITY = { KOL: 10, Whale: 9, Sniper: 8, HighIQ: 7, SmartW: 6, SmartPF: 5, Early: 4, JP: 3, Side: 2, Tagged: 1, '': 0 };

function selectKolWallets(labelsDb, limit) {
  const items = Object.entries(labelsDb)
    .filter(([_, v]) => v.label) // labeled only
    .map(([owner, v]) => ({
      owner,
      label: v.label,
      category: v.category || 'Tagged',
      priority: CATEGORY_PRIORITY[v.category] || 0,
      winrate: v.winrate || 0,
      profit30d: v.realizedProfit30d || 0,
      lastActive: v.lastActive || ''
    }));

  // Score: priority * 100 + winrate + sqrt(profit30d)/100
  for (const it of items) {
    const profitRoot = it.profit30d > 0 ? Math.sqrt(it.profit30d) / 100 : it.profit30d / 1000;
    it.kolScore = it.priority * 100 + it.winrate + profitRoot;
  }
  items.sort((a, b) => b.kolScore - a.kolScore);
  return items.slice(0, limit);
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[kol-feed] Smart Money Mirror — KOL live feed — ${startedAt}`);

  const labelsDb = JSON.parse(await fs.readFile('data/wallet_labels.json', 'utf8'));
  const targets = selectKolWallets(labelsDb, KOL_LIMIT);
  console.log(`[kol-feed] selected ${targets.length} priority wallets out of ${Object.keys(labelsDb).length}`);

  const sinceTs = Math.floor(Date.now() / 1000) - 86400 * 2; // 2-day lookback for activity

  const allTrades = []; // each = { owner, label, category, ...trade fields }

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      const d = await withRetry(
        () => birdeye(`/trader/txs/seek_by_time?address=${t.owner}&offset=0&limit=${TXS_PER_WALLET}`),
        `txs/${t.label.slice(0, 20)}`
      );
      const items = d.items || [];
      let added = 0;
      for (const tx of items) {
        if (tx.tx_type !== 'swap') continue;
        if ((tx.block_unix_time || 0) < sinceTs) continue;
        const base = tx.base || {};
        const quote = tx.quote || {};
        // Determine direction: side="buy" means user receives base (base.type_swap === 'to')
        const baseIsTarget = base.type_swap === 'to';
        const targetSide = baseIsTarget ? 'buy' : 'sell';
        const targetToken = baseIsTarget ? base : quote;
        const otherToken = baseIsTarget ? quote : base;
        // Skip stablecoin/SOL (we want the meme/alt being acquired or dumped)
        const STABLES = new Set([
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT
        ]);
        const tokenAddr = targetToken.address;
        if (!tokenAddr || STABLES.has(tokenAddr)) continue;
        allTrades.push({
          owner: t.owner,
          label: t.label,
          category: t.category,
          winrate: t.winrate,
          profit30d: t.profit30d,
          side: targetSide,
          tokenAddress: tokenAddr,
          tokenSymbol: targetToken.symbol || '?',
          uiAmount: targetToken.ui_amount || 0,
          tokenPrice: targetToken.price || 0,
          counterAddress: otherToken.address,
          counterSymbol: otherToken.symbol || '?',
          counterUiAmount: otherToken.ui_amount || 0,
          volumeUsd: tx.volume_usd || 0,
          source: tx.source || '',
          txHash: tx.tx_hash,
          ts: tx.block_unix_time
        });
        added++;
      }
      console.log(`  [${(i + 1).toString().padStart(2)}/${targets.length}] ${t.label.slice(0, 28).padEnd(28)} ${t.category.padEnd(7)} txs=${items.length}  meme=${added}`);
    } catch (e) {
      console.warn(`  [${i + 1}/${targets.length}] ${t.label.slice(0, 24)} FAILED: ${e.message}`);
    }
    await sleep(700);
  }

  // Aggregate: tokens by KOL convergence
  const tokenAggr = new Map();
  for (const tr of allTrades) {
    const k = tr.tokenAddress;
    const a = tokenAggr.get(k) || {
      tokenAddress: tr.tokenAddress,
      tokenSymbol: tr.tokenSymbol,
      buyers: [], // owners that bought
      sellers: [], // owners that sold
      buyVolume: 0,
      sellVolume: 0,
      buyCount: 0,
      sellCount: 0,
      categories: new Set(),
      latestTs: 0,
      trades: []
    };
    if (tr.side === 'buy') {
      a.buyVolume += tr.volumeUsd;
      a.buyCount += 1;
      if (!a.buyers.find(b => b.owner === tr.owner)) a.buyers.push({ owner: tr.owner, label: tr.label, category: tr.category, volumeUsd: tr.volumeUsd });
    } else {
      a.sellVolume += tr.volumeUsd;
      a.sellCount += 1;
      if (!a.sellers.find(s => s.owner === tr.owner)) a.sellers.push({ owner: tr.owner, label: tr.label, category: tr.category, volumeUsd: tr.volumeUsd });
    }
    a.categories.add(tr.category);
    a.latestTs = Math.max(a.latestTs, tr.ts || 0);
    a.trades.push(tr);
    tokenAggr.set(k, a);
  }

  const aggr = [...tokenAggr.values()].map(a => ({
    ...a,
    categories: [...a.categories],
    uniqueBuyers: a.buyers.length,
    uniqueSellers: a.sellers.length,
    netVolume: a.buyVolume - a.sellVolume,
    buyersList: a.buyers,
    sellersList: a.sellers,
    trades: a.trades.slice(-30) // cap
  })).sort((a, b) => b.uniqueBuyers - a.uniqueBuyers || b.netVolume - a.netVolume);

  // Persist
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('data/kol_feed.json', JSON.stringify({
    startedAt,
    kolCount: targets.length,
    totalTrades: allTrades.length,
    convergedTokens: aggr.filter(a => a.uniqueBuyers >= 2).length,
    tokenAggr: aggr,
    targets: targets.map(t => ({ owner: t.owner, label: t.label, category: t.category }))
  }, null, 2));

  console.log(`\n[kol-feed] saved data/kol_feed.json`);
  console.log(`[kol-feed] ${targets.length} KOLs scanned, ${allTrades.length} meme/alt trades, ${aggr.filter(a => a.uniqueBuyers >= 2).length} converged tokens (2+ KOL buyers)`);

  // Print top converged tokens
  console.log(`\n[kol-feed] Top KOL-converged tokens:`);
  for (const a of aggr.slice(0, 10)) {
    if (a.uniqueBuyers < 2) break;
    console.log(`  ${a.tokenSymbol.padEnd(16)} buyers=${a.uniqueBuyers} sellers=${a.uniqueSellers} net=$${a.netVolume.toFixed(0)}  cats=${a.categories.join(',')}`);
  }
}

main().catch(e => { console.error('[kol-feed] FATAL', e); process.exit(1); });
