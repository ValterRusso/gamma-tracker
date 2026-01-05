// ============================================================================
// ICEBERG DETECTOR CARD
// Arquivo: src/components/escape/IcebergDetectorCard.tsx
// ============================================================================

import { Snowflake, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { IcebergComponent } from '../../types/api';

interface IcebergDetectorCardProps {
  iceberg: IcebergComponent;
  className?: string;
}

export default function IcebergDetectorCard({ iceberg, className = '' }: IcebergDetectorCardProps) {
  
  // Confidence color
  const getConfidenceColor = (confidence: string) => {
    const colors: Record<string, string> = {
      'VERY_LOW': 'text-slate-400 bg-slate-500/10 border-slate-500/30',
      'LOW': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      'MEDIUM': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      'HIGH': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      'VERY_HIGH': 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    };
    return colors[confidence] || colors['VERY_LOW'];
  };

  const signals = iceberg.signals;
  const estimatedSize = iceberg.estimatedHiddenSize;

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${iceberg.detected ? 'bg-cyan-500/20' : 'bg-slate-700/50'}`}>
            <Snowflake className={`w-6 h-6 ${iceberg.detected ? 'text-cyan-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-100">Iceberg Detection</h3>
            <p className="text-xs text-slate-400">Hidden order analyzer</p>
          </div>
        </div>

        {iceberg.detected && (
          <div className={`px-4 py-2 rounded-lg border ${getConfidenceColor(iceberg.confidence)}`}>
            <p className="text-sm font-bold uppercase">
              {iceberg.confidence} CONFIDENCE
            </p>
          </div>
        )}
      </div>

      {/* Detection Status */}
      <div className={`mb-6 p-5 rounded-xl border-2 ${
        iceberg.detected 
          ? 'bg-cyan-500/10 border-cyan-500/30' 
          : 'bg-slate-800/30 border-slate-700'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {iceberg.detected ? (
              <AlertTriangle className="w-7 h-7 text-cyan-400 animate-pulse" />
            ) : (
              <CheckCircle className="w-7 h-7 text-slate-400" />
            )}
            <div>
              <p className={`text-2xl font-bold ${iceberg.detected ? 'text-cyan-400' : 'text-slate-400'}`}>
                {iceberg.detected ? 'Iceberg Detected!' : 'No Icebergs Detected'}
              </p>
              <p className="text-sm text-slate-300">
                Score: {(iceberg.score * 100).toFixed(0)}% | 
                {iceberg.detected ? ` ${iceberg.details.signalCount} Active Signals` : ' Clean orderbook'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Estimated Hidden Size */}
      {iceberg.detected && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Visible</p>
            <p className="text-2xl font-bold text-slate-200">
              {estimatedSize.visible.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">BTC</p>
          </div>

          <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <p className="text-xs text-cyan-400 uppercase tracking-wide mb-1">Hidden</p>
            <p className="text-2xl font-bold text-cyan-400">
              {estimatedSize.hidden.toFixed(2)}
            </p>
            <p className="text-xs text-cyan-500">BTC (~{estimatedSize.multiplier}x)</p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Est.</p>
            <p className="text-2xl font-bold text-slate-200">
              {estimatedSize.total.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">BTC</p>
          </div>

          <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <p className="text-xs text-amber-400 uppercase tracking-wide mb-1">Multiplier</p>
            <p className="text-2xl font-bold text-amber-400">
              {estimatedSize.multiplier}x
            </p>
            <p className="text-xs text-amber-500">hidden/visible</p>
          </div>
        </div>
      )}

      {/* Signal Detection */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
          Detection Signals
        </p>
        <div className="space-y-2">
          {/* Refilling Orders */}
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              {signals.refillingOrders.detected ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-200">Refilling Orders</p>
                {signals.refillingOrders.detected && (
                  <p className="text-xs text-slate-400">
                    {signals.refillingOrders.refillingLevels} levels refilling
                  </p>
                )}
              </div>
            </div>
            {signals.refillingOrders.detected && (
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">
                  {(signals.refillingOrders.score * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>

          {/* Volume Anomaly */}
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              {signals.volumeAnomaly.detected ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-200">Volume Anomaly</p>
                {!signals.volumeAnomaly.detected && signals.volumeAnomaly.reason && (
                  <p className="text-xs text-slate-500">{signals.volumeAnomaly.reason}</p>
                )}
              </div>
            </div>
          </div>

          {/* Price Rejection */}
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              {signals.priceRejection.detected ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-200">Price Rejection</p>
                {signals.priceRejection.detected && (
                  <p className="text-xs text-slate-400">
                    {signals.priceRejection.rejectionLevels.length} rejection levels
                  </p>
                )}
              </div>
            </div>
            {signals.priceRejection.detected && (
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">
                  {(signals.priceRejection.score * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>

          {/* Depth Regeneration */}
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              {signals.depthRegeneration.detected ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-200">Depth Regeneration</p>
                {!signals.depthRegeneration.detected && signals.depthRegeneration.reason && (
                  <p className="text-xs text-slate-500">{signals.depthRegeneration.reason}</p>
                )}
              </div>
            </div>
          </div>

          {/* Consistent Size */}
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              {signals.consistentSize.detected ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-200">Consistent Size</p>
                {signals.consistentSize.detected && (
                  <p className="text-xs text-slate-400">
                    Most common: {signals.consistentSize.mostCommonSize.size} BTC 
                    ({signals.consistentSize.mostCommonSize.occurrences} times)
                  </p>
                )}
              </div>
            </div>
            {signals.consistentSize.detected && (
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">
                  {(signals.consistentSize.score * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Signals Breakdown */}
      {iceberg.detected && iceberg.details.activeSignals.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
            Active Signal Contributions
          </p>
          <div className="space-y-2">
            {iceberg.details.weightedContributions.map((contrib, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-slate-300 capitalize">
                  {contrib.signal.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500"
                      style={{ width: `${parseFloat(contrib.contribution) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-cyan-400 w-12 text-right">
                    {(parseFloat(contrib.contribution) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refilling Levels Detail */}
      {iceberg.detected && signals.refillingOrders.detected && signals.refillingOrders.detectedLevels.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
            Top Refilling Levels (showing {Math.min(5, signals.refillingOrders.detectedLevels.length)})
          </p>
          <div className="space-y-2">
            {signals.refillingOrders.detectedLevels.slice(0, 5).map((level, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/20 rounded border border-slate-700/50">
                <span className="text-sm font-mono text-slate-300">
                  ${level.price.toLocaleString()}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Avg: {level.avgSize.toFixed(3)} BTC
                  </span>
                  <span className="text-xs text-cyan-400 font-semibold">
                    {level.occurrences}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}