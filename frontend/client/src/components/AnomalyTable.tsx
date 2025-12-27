import { TrendingUp, Activity } from 'lucide-react';

interface Anomaly {
  type: 'IV_OUTLIER' | 'SKEW_ANOMALY';
  strike: number;
  dte: number;
  moneyness: number;
  iv?: number;
  callIV?: number;
  putIV?: number;
  expectedIV?: number;
  deviation?: number;
  deviationPct?: number;
  spread?: number;
  spreadPct?: number;
  expectedSpread?: number;
  zScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priceType?: 'OVERPRICED' | 'UNDERPRICED';
  skewType?: 'PUT_PREMIUM' | 'CALL_PREMIUM';
  isWing?: boolean;
  relevanceScore: number;
  volume: number;
  openInterest: number;
  expiryDate: number;
}

interface Props {
  anomalies: Anomaly[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    case 'LOW': return 'text-green-500 bg-green-500/10 border-green-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
};

const getTypeIcon = (type: string) => {
  return type === 'IV_OUTLIER' ? <TrendingUp className="w-4 h-4" /> : <Activity className="w-4 h-4" />;
};

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(2)}%`;
};

export default function AnomalyTable({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-8 text-center">
        <p className="text-slate-500">No anomalies found with current filters</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Strike</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">DTE</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Moneyness</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Details</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Z-Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Severity</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Volume/OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {anomalies.map((anomaly, index) => (
              <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(anomaly.type)}
                    <span className="text-sm text-white font-medium">
                      {anomaly.type === 'IV_OUTLIER' ? 'IV Outlier' : 'Skew'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white font-mono font-semibold">
                    ${anomaly.strike.toLocaleString()}
                  </div>
                  {anomaly.isWing && (
                    <span className="text-xs text-amber-400">WING</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-white">{anomaly.dte}d</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-300 font-mono text-sm">
                    {(anomaly.moneyness * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  {anomaly.type === 'IV_OUTLIER' ? (
                    <div className="text-sm space-y-1">
                      <div className="text-white">
                        IV: {formatPercent(anomaly.iv!)} 
                        <span className="text-slate-500 mx-1">vs</span>
                        Exp: {formatPercent(anomaly.expectedIV!)}
                      </div>
                      <div className={anomaly.deviationPct! > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {anomaly.deviationPct! > 0 ? '+' : ''}{anomaly.deviationPct!.toFixed(1)}%
                        <span className="text-xs text-slate-500 ml-1">
                          ({anomaly.priceType})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm space-y-1">
                      <div className="text-white">
                        Put: {formatPercent(anomaly.putIV!)} 
                        <span className="text-slate-500 mx-1">|</span>
                        Call: {formatPercent(anomaly.callIV!)}
                      </div>
                      <div className="text-amber-400">
                        Spread: {formatPercent(anomaly.spread!)}
                        <span className="text-xs text-slate-500 ml-1">
                          ({anomaly.skewType})
                        </span>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-white font-mono font-semibold">
                    {anomaly.zScore.toFixed(2)}σ
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${getSeverityColor(anomaly.severity)}`}>
                    {anomaly.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm space-y-1">
                    <div className="text-slate-300">Vol: {anomaly.volume}</div>
                    <div className="text-slate-400 text-xs">OI: {anomaly.openInterest}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
