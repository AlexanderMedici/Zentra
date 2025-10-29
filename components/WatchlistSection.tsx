'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WatchlistTable } from '@/components/WatchlistTable';
import SearchCommand from '@/components/SearchCommand';

type WatchlistSectionProps = {
  initialWatchlist: StockWithData[];
  initialStocks: StockWithWatchlistStatus[];
};

export default function WatchlistSection({ initialWatchlist, initialStocks }: WatchlistSectionProps) {
  const router = useRouter();

  const handleWatchlistChange = useCallback((_symbol: string, _isAdded: boolean) => {
    // Refresh server data so the watchlist updates immediately
    router.refresh();
  }, [router]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h2 className="watchlist-title">Watchlist</h2>
        <SearchCommand initialStocks={initialStocks} onWatchlistChange={handleWatchlistChange} />
      </div>
      <WatchlistTable watchlist={initialWatchlist} onWatchlistChange={handleWatchlistChange} />
    </div>
  );
}

