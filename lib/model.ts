export type ProtocolRow = {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
};

export type Snapshot = {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: ProtocolRow[];
  watchlist: string[];
};

export type BoardRow = ProtocolRow & {
  rank: number;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  confidence: number;
  model: {
    base_multiple: number;
    growth_mult: number;
    maturity_mult: number;
    chain_mult: number;
  };
  farm_steps: string[];
  is_watchlist?: boolean;
};

export type Radar = {
  as_of: string;
  floor_usd: number;
  early_ranked: number;
  below_floor: number;
  set_aside: number;
  coverage: {
    watchlist_total: number;
    watchlist_covered: number;
    ranked: number;
    excluded_live: number;
  };
  totals: {
    implied_value_usd: number;
  };
  board: BoardRow[];
  live: {
    slug: string;
    name: string;
    category: string | null;
    mcap_usd: number | null;
    symbol: string | null;
    tvl_usd: number;
    token_status?: string;
  }[];
};

export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text);
  const keys = ['as_of', 'source', 'floor_usd', 'protocols', 'watchlist'] as const;
  for (const key of keys) {
    if (data[key] === undefined) {
      throw new Error(`Missing key: ${key}`);
    }
  }
  return data as Snapshot;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getBaseMultiple(category: string | null): number {
  if (!category) return 0.20;
  const cat = category.toLowerCase();
  if (cat.includes('perp')) return 0.35;
  if (cat.includes('aggregator')) return 0.24;
  if (cat.includes('dex')) return 0.28;
  if (cat.includes('lending')) return 0.30;
  if (cat.includes('cdp')) return 0.25;
  if (cat.includes('yield')) return 0.22;
  if (cat.includes('rwa')) return 0.20;
  if (cat.includes('launchpad')) return 0.30;
  if (cat.includes('synthetic')) return 0.22;
  if (cat.includes('risk')) return 0.18;
  if (cat.includes('restak')) return 0.15;
  if (cat.includes('liquid staking')) return 0.10;
  if (cat.includes('bridge')) return 0.12;
  if (cat.includes('cex')) return 0.05;
  if (cat.includes('exchange')) return 0.05;
  return 0.20;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const board: BoardRow[] = [];
  const liveRows: Radar['live'] = [];
  let early_ranked = 0;
  let below_floor = 0;
  let set_aside = 0;

  for (const p of snapshot.protocols) {
    const isPreToken = p.mcap_usd == null && p.gecko_id == null && p.symbol == null;
    const n = p.name.toLowerCase();
    const isExcluded = 
      /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)/i.test(n) ||
      /\b(wrapped|staked|staking|bridged|bridge|wbtc|exchange|cex)\b/i.test(n) ||
      /( v2| 2\.0| v3)$/i.test(n);
    const onWatchlist = snapshot.watchlist.includes(p.slug);

    if (isPreToken && !isExcluded) {
      early_ranked++;
      if (p.tvl_usd < snapshot.floor_usd) below_floor++;

      const age_days = p.listed_at ? Math.floor((Date.parse(snapshot.as_of) - Date.parse(p.listed_at)) / 86400000) : null;
      
      const base_multiple = getBaseMultiple(p.category);
      const growth_mult = p.change_7d == null ? 1 : clamp(1 + (p.change_7d / 100) * 2.5, 0.4, 2.2);
      const maturity_mult = age_days == null ? 0.85 : 0.55 + 0.45 * Math.min(age_days / 730, 1);
      const chain_mult = 1 + 0.06 * Math.min(p.chains.length, 5);
      
      const implied_value_usd = Math.round(p.tvl_usd * base_multiple * growth_mult * maturity_mult * chain_mult);
      
      let confidence = 70;
      if (p.change_7d != null) confidence += 10;
      if (p.listed_at != null) confidence += 10;
      if (p.tvl_usd >= 50e6) confidence += 5;
      if (age_days != null && age_days < 30) confidence -= 15;
      confidence = clamp(confidence, 0, 100);

      const budget = p.tvl_usd < 20e6 ? '$50-100' : p.tvl_usd < 200e6 ? '$100-200' : '$200-500';
      const action = p.category?.toLowerCase().includes('dex') ? 'trade' : p.category?.toLowerCase().includes('lending') ? 'deposit' : 'interaction';
      const firstChain = p.chains[0] || 'mainnet';
      const displayChains = p.chains.length > 3 ? p.chains.slice(0, 3).join(', ') + ' and others' : p.chains.join(', ') || 'supported chains';

      const farm_steps = [
        `Generate a fresh browser wallet specifically for this interaction. Allocate a budget of ${budget} to cover gas and initial liquidity on ${displayChains}. Expected setup cost is approximately $5-10 with a 10-minute time investment.`,
        `Perform a weekly ${action} using ${p.name} on ${firstChain}. Maintaining active presence across multiple weeks is key for future eligibility. Expected recurring cost is $1-2 per transaction taking ~15 minutes.`,
        `Maintain the position for at least 30+ days across two monthly snapshots. Avoid withdrawing capital as protocol snapshots often look for continuous participation rather than one-time spikes. Capital stays locked.`,
        `Claim only from the domain the protocol itself publishes; never pay to claim or sign a blind transaction. Verify URLs through multiple official channels like Discord or verified social accounts.`,
        `Keep a precise log of the wallet used, start dates, and specific transaction hashes. This record is essential for verifying interactions across different accounts if required later.`
      ];

      board.push({
        ...p,
        rank: 0,
        token_status: 'pre-token',
        age_days,
        implied_value_usd,
        confidence,
        model: { base_multiple, growth_mult, maturity_mult, chain_mult },
        farm_steps,
        is_watchlist: onWatchlist
      });
    } else {
      if (isPreToken && isExcluded) set_aside++;
      liveRows.push({
        slug: p.slug,
        name: p.name,
        category: p.category,
        mcap_usd: p.mcap_usd,
        symbol: p.symbol,
        tvl_usd: p.tvl_usd,
        token_status: (isPreToken && isExcluded) ? 'set-aside' : undefined
      });
    }
  }

  board.sort((a, b) => b.implied_value_usd - a.implied_value_usd);
  board.forEach((p, i) => p.rank = i + 1);

  liveRows.sort((a, b) => (b.mcap_usd || 0) - (a.mcap_usd || 0));

  const watchlist_covered = board.filter(p => p.is_watchlist).length;

  const radar: Radar = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    early_ranked,
    below_floor,
    set_aside,
    coverage: {
      watchlist_total: snapshot.watchlist.length,
      watchlist_covered,
      ranked: board.length,
      excluded_live: liveRows.length
    },
    totals: {
      implied_value_usd: board.reduce((sum, p) => sum + p.implied_value_usd, 0)
    },
    board,
    live: liveRows.slice(0, 60)
  };

  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  for (const slug of snapshot.watchlist) {
    if (!board.some(p => p.slug === slug)) {
      return `Watchlist protocol ${slug} missing from board`;
    }
  }
  if (board.length < 100) {
    return `Board length ${board.length} is less than 100`;
  }
  for (const row of board) {
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `Row ${row.slug} has invalid number of farm steps: ${row.farm_steps.length}`;
    }
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) {
        return `Row ${row.slug} has step with invalid length: ${step.length}`;
      }
    }
    if (row.implied_value_usd > 1e14) {
      return `Row ${row.slug} has impossible implied value: ${row.implied_value_usd}`;
    }
  }
  return null;
}

export function dataScript(radar: Radar): string {
  return 'window.RADAR = ' + JSON.stringify(radar) + ';';
}
