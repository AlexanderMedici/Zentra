import { analyzePortfolioFromWatchlist } from '@/lib/actions/portfolio.actions';
import PortfolioClient from '@/components/PortfolioClient';

function pct(x: number | undefined | null, digits = 2) {
  if (typeof x !== 'number' || !isFinite(x)) return 'N/A';
  return `${(x * 100).toFixed(digits)}%`;
}

export default async function PortfolioPage() {
  const analysis = await analyzePortfolioFromWatchlist(252);

  if (!analysis || !analysis.rows || analysis.rows.length === 0) {
    return (
      <section className="watchlist-empty-container">
        <div className="watchlist-empty">
          <h2 className="empty-title">Portfolio & Performance</h2>
          <p className="empty-description">Add stocks to your watchlist to analyze a portfolio.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="watchlist">
      <div className="flex items-center justify-between mb-4">
        <h2 className="watchlist-title">Portfolio & Performance Optimization</h2>
      </div>
      <PortfolioClient initialAnalysis={analysis} />
    </section>
  );
}
