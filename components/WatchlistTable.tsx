'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WATCHLIST_TABLE_HEADER } from '@/lib/constants';
import { Button } from './ui/button';
import WatchlistButton from './WatchlistButton';
import { useRouter } from 'next/navigation';
import { cn, getChangeColorClass, formatPrice, formatChangePercent, formatMarketCapValue } from '@/lib/utils';
import { useState } from 'react';
import AlertModal from '@/components/AlertModal';

type Props = WatchlistTableProps & {
  onWatchlistChange?: (symbol: string, isAdded: boolean) => void;
};

export function WatchlistTable({ watchlist, onWatchlistChange }: Props) {
  const router = useRouter();
  const [alertOpen, setAlertOpen] = useState(false);
  const [selected, setSelected] = useState<{ symbol: string; company: string } | null>(null);

  return (
    <>
      <Table className='scrollbar-hide-default watchlist-table'>
        <TableHeader>
          <TableRow className='table-header-row'>
            {WATCHLIST_TABLE_HEADER.map((label) => (
              <TableHead className='table-header' key={label}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {watchlist.map((item, index) => {
            const priceText =
              typeof item.currentPrice === 'number'
                ? formatPrice(item.currentPrice)
                : item.priceFormatted ?? 'N/A';
            const changeText =
              typeof item.changePercent === 'number'
                ? formatChangePercent(item.changePercent)
                : item.changeFormatted ?? 'N/A';
            const capText =
              typeof (item as any).marketCapUsd === 'number'
                ? formatMarketCapValue((item as any).marketCapUsd as number)
                : item.marketCap ?? 'N/A';
            const peText =
              typeof (item as any).peRatioNumber === 'number'
                ? ((item as any).peRatioNumber as number).toFixed(1)
                : item.peRatio ?? 'N/A';

            return (
              <TableRow
                key={item.symbol + index}
                className='table-row'
                onClick={() =>
                  router.push(`/stocks/${encodeURIComponent(item.symbol)}`)
                }
              >
                <TableCell className='pl-4 table-cell'>{item.company}</TableCell>
                <TableCell className='table-cell'>{item.symbol}</TableCell>
                <TableCell className='table-cell'>
                  {priceText ?? 'N/A'}
                </TableCell>
                <TableCell
                  className={cn(
                    'table-cell',
                    getChangeColorClass(item.changePercent)
                  )}
                >
                  {changeText ?? 'N/A'}
                </TableCell>
                <TableCell className='table-cell'>
                  {capText ?? 'N/A'}
                </TableCell>
                <TableCell className='table-cell'>
                  {peText ?? 'N/A'}
                </TableCell>
                <TableCell>
                  <Button
                    className='add-alert'
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected({ symbol: item.symbol, company: item.company });
                      setAlertOpen(true);
                    }}
                  >
                    Add Alert
                  </Button>
                </TableCell>
                <TableCell>
                  <WatchlistButton
                    symbol={item.symbol}
                    company={item.company}
                    isInWatchlist={true}
                    showTrashIcon={true}
                    type='icon'
                    onWatchlistChange={onWatchlistChange}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {selected && (
        <AlertModal
          open={alertOpen}
          setOpen={setAlertOpen}
          symbol={selected.symbol}
          company={selected.company}
        />
      )}
    </>
  );
}
