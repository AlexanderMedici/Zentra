'use server';

import { getBatchDailyCloses, pickMarketProxy } from '@/lib/actions/finnhub.actions';
import { getUserWatchlist } from '@/lib/actions/watchlist.actions';

function computeDailyReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (prev > 0 && curr > 0) out.push((curr - prev) / prev);
  }
  return out;
}

function alignByTime(data: Record<string, { t: number[]; c: number[] }>): Record<string, number[]> {
  // Find common timestamps intersection
  const keys = Object.keys(data);
  if (keys.length === 0) return {};
  const sets = keys.map((k) => new Set(data[k].t));
  const common = data[keys[0]].t.filter((ts) => sets.every((s) => s.has(ts)));
  const indexMap = new Map<number, number>();
  common.forEach((ts, idx) => indexMap.set(ts, idx));

  const aligned: Record<string, number[]> = {};
  for (const k of keys) {
    const { t, c } = data[k];
    const mapLocal = new Map<number, number>();
    t.forEach((ts, i) => mapLocal.set(ts, c[i]));
    aligned[k] = common.map((ts) => mapLocal.get(ts) || 0);
  }
  return aligned;
}

function mean(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function variance(arr: number[]): number { const m = mean(arr); return arr.length ? mean(arr.map((x) => (x - m) ** 2)) : 0; }
function covariance(a: number[], b: number[]): number { const ma = mean(a), mb = mean(b); const n = Math.min(a.length, b.length); if (!n) return 0; let s = 0; for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb); return s / n; }

function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => row.concat(...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  // Gauss-Jordan elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let pivot = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
    if (Math.abs(a[pivot][i]) < 1e-12) return null;
    if (pivot !== i) [a[i], a[pivot]] = [a[pivot], a[i]];
    const div = a[i][i];
    for (let j = 0; j < 2 * n; j++) a[i][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = a[r][i];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[i][j];
    }
  }
  return a.map((row) => row.slice(n));
}

function mvOptimalWeights(mu: number[], sigma: number[][]): number[] {
  // Heuristic: w ~ Sigma^{-1} mu, normalized to sum=1 and clipped at 0
<<<<<<< HEAD
  const n = mu.length;
  if (n === 0) return [];
  const inv = invertMatrix(sigma);
  if (!inv) return Array(n).fill(1 / n);
=======
  const n = mu.length || 0;
  const inv = invertMatrix(sigma);
  if (!inv || n === 0) return Array(n).fill(0);
>>>>>>> 4e0b45ed0c0fd763701def808c58ae87a1e46c29
  const raw = mu.map((_, i) => inv[i].reduce((s, v, j) => s + v * mu[j], 0));
  const clipped = raw.map((w) => Math.max(0, w));
  const sum = clipped.reduce((a, b) => a + b, 0);
  if (sum <= 0) return Array(n).fill(1 / n);
  return clipped.map((w) => w / sum);
}

export async function analyzePortfolioFromWatchlist(days: number = 252, rfAnnual: number = 0, marketPref?: string): Promise<PortfolioAnalysis | null> {
  try {
    const wl = await getUserWatchlist();
    const symbols = (Array.isArray(wl) ? wl : []).map((x: any) => String(x.symbol).toUpperCase());
    if (symbols.length === 0) return null;
    const unique = Array.from(new Set(symbols));
    const limited = unique.slice(0, 12); // cap to avoid too many calls
    const chosen = await pickMarketProxy(marketPref ? [marketPref] : undefined);
    const market = chosen === 'COMPOSITE' ? 'COMPOSITE' : (chosen as string);
    const batch = await getBatchDailyCloses(market === 'COMPOSITE' ? [...limited] : [...limited, market], days);
    const aligned = alignByTime(batch);

    // Convert to returns
    const returns: Record<string, number[]> = {};
    for (const k of Object.keys(aligned)) returns[k] = computeDailyReturns(aligned[k]);

    // Align returns length
    const lens = Object.values(returns).map((r) => r.length).filter((n) => n > 0);
    if (lens.length === 0) return null;
    const L = Math.min(...lens);
    for (const k of Object.keys(returns)) returns[k] = returns[k].slice(-L);

    const rf = (rfAnnual || 0) / 252; // daily risk-free approx
    const assetList = limited.filter((s) => returns[s]?.length === L);
    if (assetList.length === 0) return null;
    const muDaily = assetList.map((s) => mean(returns[s]));
    const muAnnual = muDaily.map((m) => m * 252);
    const covDaily: number[][] = assetList.map((_, i) => assetList.map((__, j) => covariance(returns[assetList[i]], returns[assetList[j]])));
    const volDaily = assetList.map((_, i) => Math.sqrt(covDaily[i][i]));
    const volAnnual = volDaily.map((v) => v * Math.sqrt(252));

    const wMVO = mvOptimalWeights(muDaily, covDaily);
    const portMuDaily = wMVO.reduce((s, w, i) => s + w * muDaily[i], 0);
    const portVolDaily = Math.sqrt(wMVO.reduce((s, wi, i) => s + wi * (covDaily[i].reduce((ss, cij, j) => ss + cij * wMVO[j], 0)), 0));
    const portSharpe = portVolDaily > 0 ? (portMuDaily - rf) / portVolDaily : 0;

    // CAPM vs market; fallback to equal-weight composite if market data unavailable
    let marketRet = market === 'COMPOSITE' ? [] : (returns[market] || []);
    if (!Array.isArray(marketRet) || marketRet.length !== L) {
      const n = assetList.length || 1;
      marketRet = Array.from({ length: L }, (_, i) => {
        let s = 0;
        for (const sym of assetList) s += returns[sym][i] || 0;
        return s / n;
      });
    }
    const mMean = mean(marketRet);
    const mVar = variance(marketRet) || 1e-9;
    const betas = assetList.map((s) => covariance(returns[s], marketRet) / mVar);
    const capmExpAnnual = betas.map((b) => (rfAnnual) + b * ((mMean * 252) - (rfAnnual)));

    // Sharpe per asset (annualized)
    const sharpeAssets = assetList.map((_, i) => (volAnnual[i] > 0 ? (muAnnual[i] - (rfAnnual)) / volAnnual[i] : 0));

    // Black–Litterman (simplified)
    // Prior weights equal, tau=0.05, views: none -> posterior ~ prior
    const priorW = Array(assetList.length).fill(1 / assetList.length);
    const lambda = 2.5; // risk aversion
    const tau = 0.05;
    // Implied eq returns: Pi = lambda * Sigma * w
    const pi = covDaily.map((row, i) => lambda * row.reduce((s, v, j) => s + v * priorW[j], 0));
    const blMuDaily = pi.map((p) => p); // no views; using tau not applied for simplicity
    const wBL = mvOptimalWeights(blMuDaily, covDaily);

    const rows: PortfolioAssetRow[] = assetList.map((sym, idx) => ({
      symbol: sym,
      meanReturnAnnual: muAnnual[idx],
      volatilityAnnual: volAnnual[idx],
      beta: betas[idx],
      sharpe: sharpeAssets[idx],
      capmExpectedAnnual: capmExpAnnual[idx],
      weightMVO: wMVO[idx],
      weightBL: wBL[idx],
    }));

    return {
      symbols: assetList,
      market: market,
      rows,
      portfolio: {
        returnDaily: portMuDaily,
        volatilityDaily: portVolDaily,
        sharpeDaily: portSharpe,
      },
    };
  } catch (e) {
    console.error('analyzePortfolioFromWatchlist error:', e);
    return null;
  }
}
