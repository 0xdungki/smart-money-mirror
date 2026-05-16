// Smart Money Mirror — build dist/data.json from data/latest.json
// Cross-references top traders across trending tokens to surface SMART MONEY:
// wallets that show up in 2+ trending tokens with positive PnL.

import fs from 'node:fs/promises';
import path from 'node:path';

function shortAddr(a) { return a ? a.slice(0, 4) + '…' + a.slice(-4) : ''; }

function classifyTrader(t) {
  const tags = [];
  const totalTrades = (t.tradeBuy || 0) + (t.tradeSell || 0);
  const buyRatio = totalTrades ? (t.tradeBuy || 0) / totalTrades : 0;

  if ((t.totalPnl || 0) > 1000) tags.push('profitable');
  if ((t.totalPnl || 0) > 10000) tags.push('whale-pnl');
  if ((t.totalPnl || 0) < -1000) tags.push('losing');
  if (totalTrades >= 100) tags.push('high-frequency');
  if (totalTrades > 0 && buyRatio >= 0.9) tags.push('accumulating');
  if (totalTrades > 0 && buyRatio <= 0.1) tags.push('distributing');
  if ((t.volumeUsd || 0) > 100000) tags.push('whale-volume');
  return tags;
}

async function loadLabels() {
  try {
    return JSON.parse(await fs.readFile('data/wallet_labels.json', 'utf8'));
  } catch { return {}; }
}

async function loadKolFeed() {
  try {
    return JSON.parse(await fs.readFile('data/kol_feed.json', 'utf8'));
  } catch { return null; }
}

async function main() {
  const raw = JSON.parse(await fs.readFile('data/latest.json', 'utf8'));
  const tokenTraders = raw.tokenTraders || [];
  const labelsDb = await loadLabels();
  const kolFeed = await loadKolFeed();

  // Build wallet index
  const wallets = new Map(); // owner -> { tokens:[{symbol,address,...}], totalPnl, totalVolume, ... }

  for (const tk of tokenTraders) {
    for (const tr of (tk.traders || [])) {
      if (!tr.owner) continue;
      const w = wallets.get(tr.owner) || {
        owner: tr.owner,
        tokenAppearances: [],
        totalPnl: 0,
        totalVolume: 0,
        totalTrades: 0,
        accumulating: 0,
        distributing: 0
      };
      w.tokenAppearances.push({
        symbol: tk.symbol,
        address: tk.address,
        rank: tk.rank,
        price24hChangePercent: tk.price24hChangePercent,
        volume24hUSD: tk.volume24hUSD,
        liquidity: tk.liquidity,
        traderPnl: tr.totalPnl || 0,
        traderVolume: tr.volumeUsd || 0,
        tradeBuy: tr.tradeBuy || 0,
        tradeSell: tr.tradeSell || 0,
        tags: classifyTrader(tr)
      });
      w.totalPnl += (tr.totalPnl || 0);
      w.totalVolume += (tr.volumeUsd || 0);
      w.totalTrades += (tr.tradeBuy || 0) + (tr.tradeSell || 0);
      const total = (tr.tradeBuy || 0) + (tr.tradeSell || 0);
      if (total) {
        const ratio = (tr.tradeBuy || 0) / total;
        if (ratio >= 0.9) w.accumulating += 1;
        if (ratio <= 0.1) w.distributing += 1;
      }
      wallets.set(tr.owner, w);
    }
  }

  // Score wallets
  const scored = [];
  for (const w of wallets.values()) {
    const tokenCount = w.tokenAppearances.length;
    const meta = labelsDb[w.owner] || {};
    const isLabeled = !!meta.label;
    const labelCat = meta.category || '';

    // Smart-money score: rewards multi-token presence + profitable PnL + accumulation behavior
    const pnlScore = Math.min(Math.max(w.totalPnl, -100000), 200000) / 1000; // ~ -100 .. 200
    const breadthScore = tokenCount * 25; // 1 token = 25, 4 tokens = 100
    const accumulationBonus = (w.accumulating - w.distributing) * 8;
    const volumeScore = Math.log10(Math.max(w.totalVolume, 1)) * 6; // 1k=18, 100k=30, 1M=36
    // Track-record bonus from labeled wallets (winrate/30d profit)
    const winrate = meta.winrate || 0;
    const realizedProfit30d = meta.realizedProfit30d || 0;
    const winrateBonus = winrate ? Math.max(0, (winrate - 50)) * 2 : 0; // wr 60 = +20, 70 = +40
    const profit30dBonus = Math.min(Math.max(realizedProfit30d, -50000), 500000) / 5000; // ~ -10 .. 100
    // Label bonus: KOL/Whale/Sniper/SmartW/HighIQ get a flat respect bonus (curated lists)
    const labelBonusMap = { KOL: 30, Whale: 40, SmartW: 25, SmartPF: 22, HighIQ: 35, Sniper: 28, Early: 18, JP: 18, Side: 12, Tagged: 10 };
    const labelBonus = labelBonusMap[labelCat] || 0;

    const score = Math.round(pnlScore + breadthScore + accumulationBonus + volumeScore + winrateBonus + profit30dBonus + labelBonus);

    let tier = 'noise';
    if (isLabeled && tokenCount >= 2) tier = 'alpha';
    else if (tokenCount >= 3 && w.totalPnl > 5000) tier = 'alpha';
    else if (isLabeled) tier = 'labeled';
    else if (tokenCount >= 2 && w.totalPnl > 0) tier = 'smart';
    else if (tokenCount >= 2) tier = 'cross-token';
    else if (w.totalPnl > 5000) tier = 'profit-only';

    scored.push({
      owner: w.owner,
      ownerShort: shortAddr(w.owner),
      tokenCount,
      totalPnl: Math.round(w.totalPnl * 100) / 100,
      totalVolume: Math.round(w.totalVolume * 100) / 100,
      totalTrades: w.totalTrades,
      accumulating: w.accumulating,
      distributing: w.distributing,
      score,
      tier,
      label: meta.label || '',
      category: labelCat,
      winrate: winrate || null,
      realizedProfit7d: meta.realizedProfit7d ?? null,
      realizedProfit30d: realizedProfit30d || null,
      solBalance: meta.solBalance ?? null,
      pnl7dPct: meta.pnl7d ?? null,
      lastActive: meta.lastActive || null,
      appearances: w.tokenAppearances
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Smart-money rotation per token: which tier of money is touching each token
  const tokenView = tokenTraders.map(tk => {
    const enriched = (tk.traders || []).map(tr => {
      const w = scored.find(s => s.owner === tr.owner);
      return {
        owner: tr.owner,
        ownerShort: shortAddr(tr.owner),
        traderPnl: Math.round((tr.totalPnl || 0) * 100) / 100,
        traderVolume: Math.round((tr.volumeUsd || 0) * 100) / 100,
        tradeBuy: tr.tradeBuy || 0,
        tradeSell: tr.tradeSell || 0,
        tier: w ? w.tier : 'noise',
        score: w ? w.score : 0,
        tokenCount: w ? w.tokenCount : 1,
        label: w ? w.label : '',
        category: w ? w.category : '',
        winrate: w ? w.winrate : null,
        realizedProfit30d: w ? w.realizedProfit30d : null,
        crossTokens: w ? w.appearances.filter(a => a.address !== tk.address).map(a => a.symbol) : []
      };
    });
    const alphaCount = enriched.filter(t => t.tier === 'alpha').length;
    const smartCount = enriched.filter(t => t.tier === 'smart').length;
    const labeledCount = enriched.filter(t => t.label).length;
    const kolCount = enriched.filter(t => t.category === 'KOL').length;
    const whaleCount = enriched.filter(t => t.category === 'Whale').length;
    const sniperCount = enriched.filter(t => t.category === 'Sniper').length;
    const crossCount = enriched.filter(t => t.tokenCount >= 2).length;
    const sumPnl = enriched.reduce((a, t) => a + t.traderPnl, 0);
    const labeledPnl = enriched.filter(t => t.label).reduce((a, t) => a + t.traderPnl, 0);
    let signal = 'cold';
    if (alphaCount >= 2 || labeledCount >= 4 || (whaleCount >= 1 && labeledCount >= 2)) signal = 'hot';
    else if (alphaCount >= 1 || labeledCount >= 2 || smartCount >= 2 || crossCount >= 4) signal = 'warm';
    return {
      address: tk.address,
      symbol: tk.symbol,
      name: tk.name,
      rank: tk.rank,
      price: tk.price,
      liquidity: tk.liquidity,
      volume24hUSD: tk.volume24hUSD,
      price24hChangePercent: tk.price24hChangePercent,
      volume24hChangePercent: tk.volume24hChangePercent,
      marketcap: tk.marketcap,
      fdv: tk.fdv,
      logoURI: tk.logoURI,
      traders: enriched,
      alphaCount,
      smartCount,
      labeledCount,
      kolCount,
      whaleCount,
      sniperCount,
      crossCount,
      smartMoneyPnl: Math.round(sumPnl * 100) / 100,
      labeledPnl: Math.round(labeledPnl * 100) / 100,
      signal
    };
  });

  // Sort tokens by signal then alpha+labeled, then smart count
  const signalOrder = { hot: 0, warm: 1, cold: 2 };
  tokenView.sort((a, b) =>
    (signalOrder[a.signal] - signalOrder[b.signal]) ||
    (b.labeledCount - a.labeledCount) ||
    (b.alphaCount - a.alphaCount) ||
    (b.smartCount - a.smartCount));

  // Top wallets — multi-token OR labeled, sorted by score
  const topWallets = scored.filter(w => w.tokenCount >= 2 || w.label).slice(0, 80);
  topWallets.sort((a, b) => b.score - a.score);

  const summary = {
    generatedAt: raw.startedAt,
    totalTokensScanned: tokenTraders.length,
    totalWallets: scored.length,
    multiTokenWallets: scored.filter(w => w.tokenCount >= 2).length,
    labeledTraders: scored.filter(w => w.label).length,
    alphaWallets: scored.filter(w => w.tier === 'alpha').length,
    smartWallets: scored.filter(w => w.tier === 'smart').length,
    kolHits: scored.filter(w => w.category === 'KOL').length,
    whaleHits: scored.filter(w => w.category === 'Whale').length,
    sniperHits: scored.filter(w => w.category === 'Sniper').length,
    hotTokens: tokenView.filter(t => t.signal === 'hot').length,
    warmTokens: tokenView.filter(t => t.signal === 'warm').length,
    totalSmartPnl: Math.round(scored.filter(w => w.tier === 'alpha' || w.tier === 'smart' || w.label).reduce((a, w) => a + w.totalPnl, 0) * 100) / 100,
    labelDbSize: Object.keys(labelsDb).length
  };

  const out = {
    summary,
    tokens: tokenView,
    topWallets,
    allWalletsCount: scored.length,
    kolConvergence: kolFeed ? {
      generatedAt: kolFeed.startedAt,
      kolCount: kolFeed.kolCount,
      totalTrades: kolFeed.totalTrades,
      convergedTokens: kolFeed.convergedTokens,
      tokens: (kolFeed.tokenAggr || []).filter(t => t.uniqueBuyers >= 2 || (t.uniqueBuyers >= 1 && t.netVolume > 5000)).slice(0, 30)
    } : null
  };

  // Write to dist
  await fs.mkdir('dist', { recursive: true });
  await fs.writeFile('dist/data.json', JSON.stringify(out, null, 2));
  // Copy index.html and assets
  await fs.copyFile('public/index.html', 'dist/index.html');
  console.log('[build] dist/data.json + dist/index.html written');
  console.log(`[build] ${summary.totalTokensScanned} tokens, ${summary.totalWallets} wallets, ${summary.alphaWallets} ALPHA, ${summary.smartWallets} smart, ${summary.hotTokens} hot tokens`);
}

main().catch(e => { console.error('[build] FATAL', e); process.exit(1); });
