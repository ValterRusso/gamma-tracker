import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface AnomalyStats {
  total: number;
  byType: {
    ivOutlier: number;
    skewAnomaly: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byPriceType: {
    overpriced: number;
    underpriced: number;
  };
  avgRelevance: number;
}

interface Props {
  stats: AnomalyStats;
}

export default function AnomalyStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="text-slate-400 text-sm mb-1">Total Anomalies</div>
        <div className="text-3xl font-bold text-white">{stats.total}</div>
        <div className="text-xs text-slate-500 mt-1">
          {stats.byType.ivOutlier} IV · {stats.byType.skewAnomaly} Skew
        </div>
      </div>
      
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="text-red-400 text-sm mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Critical + High
        </div>
        <div className="text-3xl font-bold text-red-400">
          {stats.bySeverity.critical + stats.bySeverity.high}
        </div>
        <div className="text-xs text-red-400/70 mt-1">
          {stats.bySeverity.critical} Critical · {stats.bySeverity.high} High
        </div>
      </div>
      
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="text-yellow-400 text-sm mb-1">Medium Severity</div>
        <div className="text-3xl font-bold text-yellow-400">{stats.bySeverity.medium}</div>
        <div className="text-xs text-yellow-400/70 mt-1">Requires monitoring</div>
      </div>
      
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="text-slate-400 text-sm mb-1">Price Type</div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-rose-400" />
            <span className="text-white font-semibold">{stats.byPriceType.overpriced}</span>
            <span className="text-xs text-slate-500">Over</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-semibold">{stats.byPriceType.underpriced}</span>
            <span className="text-xs text-slate-500">Under</span>
          </div>
        </div>
      </div>
    </div>
  );
}
