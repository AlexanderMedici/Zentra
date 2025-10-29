'use client';

type Props = {
  rows: PortfolioAssetRow[];
  currentWeights?: Record<string, number>; // optional custom current weights per symbol (sum ~ 1)
  onDownloadCsv?: () => void;
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function RebalanceSuggestions({ rows, currentWeights, onDownloadCsv }: Props) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const n = rows.length;
  const equal = 1 / n;
  const data = rows.map((r) => {
    const current = typeof currentWeights?.[r.symbol] === 'number' ? currentWeights![r.symbol] : equal;
    return {
      symbol: r.symbol,
      current,
      targetMVO: r.weightMVO,
      deltaMVO: r.weightMVO - current,
      targetBL: r.weightBL,
      deltaBL: r.weightBL - current,
    };
  });

  return (
    <div className="alert-item">
      <div className="alert-name">Rebalance Suggestions</div>
      <p className="text-sm text-gray-400 mb-3">Assuming current portfolio is equally weighted. Positive delta means buy, negative means sell.</p>
      <div className="flex items-center justify-between mb-2">
        <div />
        {onDownloadCsv && (
          <button onClick={onDownloadCsv} className="text-yellow-500 hover:text-yellow-400 text-sm">Download CSV</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="table-header-row">
              <th className="table-head pl-4">Symbol</th>
              <th className="table-head">Current</th>
              <th className="table-head">Target (MVO)</th>
              <th className="table-head">Delta (MVO)</th>
              <th className="table-head">Target (BL)</th>
              <th className="table-head">Delta (BL)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={`rb-${d.symbol}`} className="table-row">
                <td className="table-cell pl-4">{d.symbol}</td>
                <td className="table-cell">{pct(d.current)}</td>
                <td className="table-cell">{pct(d.targetMVO)}</td>
                <td className={`table-cell ${d.deltaMVO >= 0 ? 'text-green-500' : 'text-red-500'}`}>{pct(d.deltaMVO)}</td>
                <td className="table-cell">{pct(d.targetBL)}</td>
                <td className={`table-cell ${d.deltaBL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{pct(d.deltaBL)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
