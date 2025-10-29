import { Star } from 'lucide-react';
import { searchStocks, getStocksDetails } from '@/lib/actions/finnhub.actions';
import SearchCommand from '@/components/SearchCommand';
import { getUserWatchlist } from '@/lib/actions/watchlist.actions';
import WatchlistSection from '@/components/WatchlistSection';

const Watchlist = async () => {
  const initialStocks = await searchStocks();
  const watchlist = await getUserWatchlist();

  // Enrich watchlist with live market data for table columns
  const enriched = await Promise.all(
    (watchlist || []).map(async (item: any) => {
      try {
        const d = await getStocksDetails(item.symbol);
        return {
          ...item,
          currentPrice: d.currentPrice,
          changePercent: d.changePercent,
          priceFormatted: d.priceFormatted,
          changeFormatted: d.changeFormatted,
          marketCap: d.marketCapFormatted,
          peRatio: d.peRatio,
        } as StockWithData;
      } catch {
        return item as StockWithData;
      }
    })
  );

  if (!enriched || enriched.length === 0) {
    return (
      <section className="flex watchlist-empty-container">
        <div className="watchlist-empty">
          <Star className="watchlist-star" />
          <h2 className="empty-title">Your watchlist is empty</h2>
          <p className="empty-description">
            Start building your watchlist by searching for stocks and clicking the star icon to add them.
          </p>
        </div>
        <SearchCommand initialStocks={initialStocks} />
      </section>
    );
  }

  return (
    <section className="watchlist">
      <WatchlistSection initialWatchlist={enriched} initialStocks={initialStocks} />
    </section>
  );
};

export default Watchlist;
