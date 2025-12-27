import { Filter, Search } from 'lucide-react';

interface Props {
  threshold: number;
  setThreshold: (value: number) => void;
  severityFilter: string;
  setSeverityFilter: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  searchStrike: string;
  setSearchStrike: (value: string) => void;
}

export default function AnomalyFilters({
  threshold,
  setThreshold,
  severityFilter,
  setSeverityFilter,
  typeFilter,
  setTypeFilter,
  searchStrike,
  setSearchStrike
}: Props) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">Filters</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Threshold Slider */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">
            Z-Score Threshold: {threshold.toFixed(1)}σ
          </label>
          <input
            type="range"
            min="1.5"
            max="4.0"
            step="0.1"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>
        
        {/* Severity Filter */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
        
        {/* Type Filter */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Types</option>
            <option value="IV_OUTLIER">IV Outlier</option>
            <option value="SKEW_ANOMALY">Skew Anomaly</option>
          </select>
        </div>
        
        {/* Strike Search */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Search Strike</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="e.g., 95000"
              value={searchStrike}
              onChange={(e) => setSearchStrike(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
