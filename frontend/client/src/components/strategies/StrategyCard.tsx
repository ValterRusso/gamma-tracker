// ============================================================================
// STRATEGY CARD COMPONENT
// ============================================================================

import { TrendingUp, TrendingDown, Minus, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { StrategyRecommendation } from '../types/api';

interface StrategyCardProps {
  strategy: StrategyRecommendation;
  onClick?: () => void;
  showScore?: boolean;
}

export default function StrategyCard({ 
  strategy, 
  onClick, 
  showScore = true 
}: StrategyCardProps) {
  
  // Bias icon
  const getBiasIcon = (bias: string) => {
    const icons: Record<string, any> = {
      'BULLISH': TrendingUp,
      'BEARISH': TrendingDown,
      'NEUTRAL': Minus
    };
    return icons[bias] || Minus;
  };

  // Bias color
  const getBiasColor = (bias: string) => {
    const colors: Record<string, string> = {
      'BULLISH': 'text-emerald-400 bg-emerald-500/10',
      'BEARISH': 'text-red-400 bg-red-500/10',
      'NEUTRAL': 'text-amber-400 bg-amber-500/10'
    };
    return colors[bias] || 'text-slate-400 bg-slate-500/10';
  };

  // Market fit color
  const getFitColor = (fit: string) => {
    const colors: Record<string, string> = {
      'EXCELLENT': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      'GOOD': 'text-sky-400 bg-sky-500/10 border-sky-500/30',
      'FAIR': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      'POOR': 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    };
    return colors[fit] || colors['FAIR'];
  };

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-sky-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-slate-400';
  };

  const BiasIcon = getBiasIcon(strategy.bias);

  return (
    <div
      onClick={onClick}
      className={`
        bg-slate-900/50 border border-slate-800 rounded-lg p-5
        hover:border-cyan-500/50 hover:bg-slate-900/70
        transition-all duration-200
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${getBiasColor(strategy.bias)}`}>
              <BiasIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {strategy.namePt || strategy.name}
              </h3>
              <p className="text-xs text-slate-400 uppercase tracking-wide">
                {strategy.category}
              </p>
            </div>
          </div>
        </div>

        {showScore && (
          <div className="text-right">
            <div className={`text-3xl font-bold ${getScoreColor(strategy.score)}`}>
              {strategy.score}
            </div>
            <div className={`text-xs font-semibold px-2 py-1 rounded border ${getFitColor(strategy.marketFit)}`}>
              {strategy.marketFit}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-4">
        {strategy.description}
      </p>

      {/* Strategy Legs */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
          Structure
        </p>
        <div className="flex flex-wrap gap-2">
          {strategy.legs.map((leg, idx) => (
            <div
              key={idx}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium border
                ${leg.action === 'BUY' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }
              `}
            >
              {leg.action} {leg.type} {leg.moneyness}
            </div>
          ))}
        </div>
      </div>

      {/* Risk Profile */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Max Loss</p>
          <p className="text-sm font-semibold text-slate-200">
            {strategy.risk.maxLoss}
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Max Profit</p>
          <p className="text-sm font-semibold text-slate-200">
            {strategy.risk.maxProfit}
          </p>
        </div>
      </div>

      {/* Reasoning */}
      {strategy.reasoning && strategy.reasoning.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
            Why Now?
          </p>
          <div className="space-y-1">
            {strategy.reasoning.slice(0, 3).map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-300">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Greeks Summary */}
      <div className="pt-4 border-t border-slate-800">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Delta</p>
            <p className={`text-sm font-semibold ${
              strategy.greeks.delta.target > 0 ? 'text-emerald-400' : 
              strategy.greeks.delta.target < 0 ? 'text-red-400' : 
              'text-slate-400'
            }`}>
              {strategy.greeks.delta.target > 0 ? '+' : ''}{strategy.greeks.delta.target.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Theta</p>
            <p className={`text-sm font-semibold ${
              strategy.greeks.theta === 'POSITIVE' ? 'text-emerald-400' : 
              strategy.greeks.theta === 'NEGATIVE' ? 'text-red-400' : 
              'text-slate-400'
            }`}>
              {strategy.greeks.theta === 'POSITIVE' ? '+' : strategy.greeks.theta === 'NEGATIVE' ? '-' : '~'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Vega</p>
            <p className={`text-sm font-semibold ${
              strategy.greeks.vega === 'POSITIVE' ? 'text-emerald-400' : 
              strategy.greeks.vega === 'NEGATIVE' ? 'text-red-400' : 
              'text-slate-400'
            }`}>
              {strategy.greeks.vega === 'POSITIVE' ? '+' : strategy.greeks.vega === 'NEGATIVE' ? '-' : '~'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Gamma</p>
            <p className={`text-sm font-semibold ${
              strategy.greeks.gamma === 'POSITIVE' ? 'text-emerald-400' : 
              strategy.greeks.gamma === 'NEGATIVE' ? 'text-red-400' : 
              'text-slate-400'
            }`}>
              {strategy.greeks.gamma === 'POSITIVE' ? '+' : strategy.greeks.gamma === 'NEGATIVE' ? '-' : '~'}
            </p>
          </div>
        </div>
      </div>

      {/* Click indicator */}
      {onClick && (
        <div className="flex items-center justify-center mt-4 pt-4 border-t border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            Click for details <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </div>
  );
}
