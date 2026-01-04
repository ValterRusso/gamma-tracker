// ============================================================================
// MARKET STATE CARD COMPONENT
// Este arquivo vai para: src/components/strategies/MarketStateCard.tsx
// ============================================================================

import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { MarketState } from '../../types/api';

interface MarketStateCardProps {
  state: MarketState;
  className?: string;
}

export default function MarketStateCard({ state, className = '' }: MarketStateCardProps) {
  // Map regime to display info
  const getRegimeInfo = (regime: string) => {
    const regimeMap: Record<string, { label: string; color: string; icon: any }> = {
      'POSITIVE_GAMMA_ABOVE': {
        label: 'Positive Gamma (Above Flip)',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        icon: TrendingUp
      },
      'POSITIVE_GAMMA_BELOW': {
        label: 'Positive Gamma (Below Flip)',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        icon: TrendingUp
      },
      'NEGATIVE_GAMMA_ABOVE': {
        label: 'Negative Gamma (Above Flip)',
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
        icon: TrendingDown
      },
      'NEGATIVE_GAMMA_BELOW': {
        label: 'Negative Gamma (Below Flip)',
        color: 'text-red-400 bg-red-500/10 border-red-500/30',
        icon: TrendingDown
      },
      'NEUTRAL': {
        label: 'Neutral',
        color: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
        icon: Minus
      }
    };

    return regimeMap[regime] || regimeMap['NEUTRAL'];
  };

  const regimeInfo = getRegimeInfo(state.regime);
  const RegimeIcon = regimeInfo.icon;

  // Volatility color
  const getVolColor = (vol: string) => {
    const colors: Record<string, string> = {
      'LOW': 'text-emerald-400',
      'MEDIUM': 'text-amber-400',
      'HIGH': 'text-red-400'
    };
    return colors[vol] || 'text-slate-400';
  };

  // GEX color
  const getGexColor = (gex: string) => {
    const colors: Record<string, string> = {
      'POSITIVE': 'text-emerald-400',
      'NEGATIVE': 'text-red-400',
      'NEUTRAL': 'text-slate-400'
    };
    return colors[gex] || 'text-slate-400';
  };

  // Skew interpretation
  const getSkewLabel = (skew: string) => {
    const labels: Record<string, string> = {
      'FLAT': 'Flat (Neutral)',
      'PUT_SKEW': 'Put Skew (Defensive)',
      'CALL_SKEW': 'Call Skew (Bullish)'
    };
    return labels[skew] || skew;
  };

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-100">Current Market State</h3>
        {state.anomalies.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">
              {state.anomalies.length} Anomalies
            </span>
          </div>
        )}
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Regime */}
        <div className={`p-4 rounded-lg border ${regimeInfo.color}`}>
          <div className="flex items-center gap-2 mb-2">
            <RegimeIcon className="w-5 h-5" />
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">Regime</p>
          </div>
          <p className="text-sm font-semibold">{regimeInfo.label}</p>
        </div>

        {/* Volatility */}
        <div className="p-4 rounded-lg border bg-slate-800/30 border-slate-700">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
            Volatility
          </p>
          <p className={`text-lg font-bold ${getVolColor(state.volatility)}`}>
            {state.volatility}
          </p>
        </div>

        {/* GEX */}
        <div className="p-4 rounded-lg border bg-slate-800/30 border-slate-700">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
            GEX
          </p>
          <p className={`text-lg font-bold ${getGexColor(state.gex)}`}>
            {state.gex}
          </p>
        </div>

        {/* Skew */}
        <div className="p-4 rounded-lg border bg-slate-800/30 border-slate-700">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
            Skew
          </p>
          <p className="text-sm font-semibold text-slate-200">
            {getSkewLabel(state.skew)}
          </p>
        </div>
      </div>

      {/* Sentiment Section */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
              Put/Call Ratio
            </p>
            <p className="text-2xl font-bold text-slate-100">
              {state.sentiment.putCallRatio.toFixed(2)}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
              Max Pain Distance
            </p>
            <p className="text-2xl font-bold text-slate-100">
              {state.maxPainDistance.toFixed(1)}%
            </p>
          </div>

          {state.sentiment.divergence && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-sm text-rose-400 font-medium">
                OI/Vol Divergence
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
