'use client';

import { useMemo, useState, useTransition } from 'react';
import RebalanceSuggestions from '@/components/RebalanceSuggestions';
import { recomputePortfolioAnalysis } from '@/lib/actions/portfolio.ui.actions';

function pct(x: number | undefined | null, digits = 2) {
  if (typeof x !== 'number' || !isFinite(x)) return 'N/A';
  return `${(x * 100).toFixed(digits)}%`;
}

export default function PortfolioClient({ initialAnalysis }: { initialAnalysis: PortfolioAnalysis }) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [rfAnnual, setRfAnnual] = useState<number>(0);
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [marketProxy, setMarketProxy] = useState<string>('SPY');
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  const { rows = [], market } = analysis || { rows: [], market: 'SPY' } as any;

  const totalCustom = useMemo(() => Object.values(customWeights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0), [customWeights]);

  const onChangeWeight = (symbol: string, value: string) => {
    const v = parseFloat(value) / 100; // input in %
    setCustomWeights((w) => ({ ...w, [symbol]: Number.isFinite(v) ? v : 0 }));
  };

  const onRecompute = () => {
    startTransition(async () => {
      const res = await recomputePortfolioAnalysis(rfAnnual, marketProxy);
      if (res) setAnalysis(res);
    });
  };

  const downloadCsv = () => {
    const headers = ['Symbol','Current','Target (MVO)','Delta (MVO)','Target (BL)','Delta (BL)'];
    const n = rows.length || 1;
    const equal = 1 / n;
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      const curr = mode === 'custom' && typeof customWeights[r.symbol] === 'number' ? customWeights[r.symbol] : equal;
      const row = [
        r.symbol,
        curr.toFixed(6),
        r.weightMVO.toFixed(6),
        (r.weightMVO - curr).toFixed(6),
        r.weightBL.toFixed(6),
        (r.weightBL - curr).toFixed(6),
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rebalance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="alert-item">
        <div className="flex items-center justify-between">
          <div className="alert-name">Settings</div>
          <div className="text-sm text-gray-500">{isPending ? 'Recomputing…' : ''}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <label className="text-sm text-gray-300">
            Risk-free rate (annual %)
            <input
              type="number"
              step="0.1"
              placeholder="0.0"
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full mt-1"
              value={rfAnnual}
              onChange={(e) => setRfAnnual(parseFloat(e.target.value) || 0)}
            />
          </label>
          <div className="text-sm text-gray-300">
            Current weights
            <div className="mt-1 flex gap-2">
              <button className={`px-3 py-2 rounded ${mode==='equal' ? 'bg-yellow-600 text-black' : 'bg-gray-700 text-gray-200'}`} onClick={() => setMode('equal')}>Equal</button>
              <button className={`px-3 py-2 rounded ${mode==='custom' ? 'bg-yellow-600 text-black' : 'bg-gray-700 text-gray-200'}`} onClick={() => setMode('custom')}>Custom</button>
            </div>
          </div>
          <label className="text-sm text-gray-300">
            Market proxy
            <select
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full mt-1"
              value={marketProxy}
              onChange={(e) => setMarketProxy(e.target.value)}
            >
              <option value="SPY">SPY (S&P 500)</option>
              <option value="QQQ">QQQ (Nasdaq 100)</option>
              <option value="VOO">VOO (S&P 500)</option>
              <option value="COMPOSITE">Composite (Equal-Weight Watchlist)</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="add-alert" onClick={onRecompute}>Recompute</button>
          </div>
        </div>

        {mode === 'custom' && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="table-header-row">
                  <th className="table-head pl-4">Symbol</th>
                  <th className="table-head">Current Weight (%)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`cw-${r.symbol}`} className="table-row">
                    <td className="table-cell pl-4">{r.symbol}</td>
                    <td className="table-cell">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-1 w-28"
                        value={typeof customWeights[r.symbol] === 'number' ? (customWeights[r.symbol] * 100).toFixed(1) : ''}
                        onChange={(e) => onChangeWeight(r.symbol, e.target.value)}
                        placeholder={(100 / (rows.length || 1)).toFixed(1)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={`mt-2 text-sm ${Math.abs(totalCustom - 1) < 1e-6 || mode==='equal' ? 'text-gray-400' : 'text-red-400'}`}>
              Total: {(totalCustom * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="alert-item">
          <div className="alert-name">Markowitz MVO (weights)</div>
          <ul className="text-gray-400 text-sm">
            {rows.map((r) => (
              <li key={`mvo-${r.symbol}`}>{r.symbol}: {pct(r.weightMVO)}</li>
            ))}
          </ul>
        </div>
        <div className="alert-item">
          <div className="alert-name">Sharpe Ratio (annualized)</div>
          <ul className="text-gray-400 text-sm">
            {rows.map((r) => (
              <li key={`sharpe-${r.symbol}`}>{r.symbol}: {r.sharpe.toFixed(2)}</li>
            ))}
          </ul>
        </div>
        <div className="alert-item">
          <div className="alert-name">CAPM Expected Returns (annual)</div>
          <ul className="text-gray-400 text-sm">
            {rows.map((r) => (
              <li key={`capm-${r.symbol}`}>{r.symbol}: {pct(r.capmExpectedAnnual)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="alert-item mb-6">
        <div className="alert-name">Black–Litterman (weights)</div>
        <ul className="text-gray-400 text-sm">
          {rows.map((r) => (
            <li key={`bl-${r.symbol}`}>{r.symbol}: {pct(r.weightBL)}</li>
          ))}
        </ul>
      </div>

      <RebalanceSuggestions
        rows={rows}
        currentWeights={mode === 'custom' ? customWeights : undefined}
        onDownloadCsv={downloadCsv}
      />
    </div>
  );
}
