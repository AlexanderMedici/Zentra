'use server';

import { analyzePortfolioFromWatchlist } from '@/lib/actions/portfolio.actions';

export async function recomputePortfolioAnalysis(rfAnnual?: number, marketProxy?: string) {
  const rf = typeof rfAnnual === 'number' && isFinite(rfAnnual) ? rfAnnual : 0;
  const mp = typeof marketProxy === 'string' ? marketProxy : undefined;
  return analyzePortfolioFromWatchlist(252, rf, mp);
}
