// ============================================================================
// LIQUIDATION ENERGY CARD COMPONENT
// Arquivo: src/components/liquidations/LiquidationEnergyCard.tsx
// ============================================================================

import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { LiquidationEnergyData } from '../types/api';

interface LiquidationEnergyCardProps {
  energy: LiquidationEnergyData;
  className?: string;
}

export default function LiquidationEnergyCard({ energy, className = '' }: LiquidationEnergyCardProps) {
  
  // Energy level color
  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      'VERY_LOW': 'text-slate-400 bg-slate-500/10 border-slate-500/30',
      'LOW': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      'MEDIUM': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      'HIGH': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      'VERY_HIGH': 'text-red-400 bg-red-500/10 border-red-500/30',
      'EXTREME': 'text-rose-500 bg-rose-500/20 border-rose-500/50'
    };
    return colors[level] || colors['VERY_LOW'];
  };

  // Direction icon and color
  const getDirectionInfo = (direction: string) => {
    const info: Record<string, { icon: any; color: string; label: string }> = {
      'BULLISH': {
        icon: TrendingUp,
        color: 'text-emerald-400',
        label: 'Bullish (Shorts Liquidated)'
      },
      'BEARISH': {
        icon: TrendingDown,
        color: 'text-red-400',
        label: 'Bearish (Longs Liquidated)'
      },
      'NEUTRAL': {
        icon: Minus,
        color: 'text-slate-400',
        label: 'Neutral (Balanced)'
      }
    };
    return info[direction] || info['NEUTRAL'];
  };

  // Score display (0-1 scale, show as percentage)
  const scorePercent = (energy.score * 100).toFixed(1);
  
  // Component breakdown
  const components = energy.components;
  const directionInfo = getDirectionInfo(energy.direction);
  const DirectionIcon = directionInfo.icon;

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Liquidation Energy</h3>
            <p className="text-xs text-slate-400">Market stress indicator</p>
          </div>
        </div>
        
        {energy.rawData.cascade && (
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-sm text-rose-400 font-semibold">CASCADE!</span>
          </div>
        )}
      </div>

      {/* Main Score */}
      <div className="mb-6">
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
              Energy Score
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-purple-400">
                {scorePercent}
              </span>
              <span className="text-2xl text-slate-400 mb-1">%</span>
            </div>
          </div>
          
          <div className={`px-4 py-2 rounded-lg border ${getLevelColor(energy.level)}`}>
            <p className="text-sm font-bold uppercase tracking-wide">
              {energy.level.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-3 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              energy.level === 'EXTREME' ? 'bg-rose-500' :
              energy.level === 'VERY_HIGH' ? 'bg-red-500' :
              energy.level === 'HIGH' ? 'bg-orange-500' :
              energy.level === 'MEDIUM' ? 'bg-amber-500' :
              energy.level === 'LOW' ? 'bg-emerald-500' :
              'bg-slate-500'
            }`}
            style={{ width: `${Math.min(energy.score * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Direction */}
      <div className="mb-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DirectionIcon className={`w-6 h-6 ${directionInfo.color}`} />
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Direction
              </p>
              <p className={`text-sm font-semibold ${directionInfo.color}`}>
                {directionInfo.label}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-slate-400">Imbalance Ratio</p>
            <p className="text-lg font-bold text-slate-200">
              {energy.rawData.imbalance1h.ratio.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">
          Energy Components
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Value</p>
            <p className="text-lg font-bold text-slate-200">
              {(components.value * 100).toFixed(2)}%
            </p>
          </div>
          
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Frequency</p>
            <p className="text-lg font-bold text-slate-200">
              {(components.frequency * 100).toFixed(0)}%
            </p>
          </div>
          
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Cascade</p>
            <p className="text-lg font-bold text-slate-200">
              {components.cascade === 0 ? 'No' : 'Yes'}
            </p>
          </div>
          
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Imbalance</p>
            <p className="text-lg font-bold text-slate-200">
              {(components.imbalance * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-400 mb-1">1h Volume</p>
          <p className="text-sm font-semibold text-slate-200">
            ${(energy.rawData.totalValue.last1h / 1000).toFixed(0)}K
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Liq Count</p>
          <p className="text-sm font-semibold text-slate-200">
            {energy.rawData.count.last1h}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Largest</p>
          <p className="text-sm font-semibold text-slate-200">
            ${(energy.rawData.largestLiquidation.value / 1000).toFixed(0)}K
          </p>
        </div>
      </div>
    </div>
  );
}