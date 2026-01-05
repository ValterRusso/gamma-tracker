// ============================================================================
// ORDERBOOK IMBALANCE CARD
// Arquivo: src/components/orderbook/OrderbookImbalanceCard.tsx
// ============================================================================

import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle } from 'lucide-react';
import type { OrderbookImbalanceData } from '../../types/api';

interface OrderbookImbalanceCardProps {
  imbalance: OrderbookImbalanceData;
  className?: string;
}

export default function OrderbookImbalanceCard({ 
  imbalance, 
  className = '' 
}: OrderbookImbalanceCardProps) {
  
  // Direction color and icon
  const getDirectionInfo = (direction: string) => {
    const info: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
      'BULLISH': {
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10 border-emerald-500/30',
        icon: TrendingUp,
        label: 'Bullish Pressure'
      },
      'BEARISH': {
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/30',
        icon: TrendingDown,
        label: 'Bearish Pressure'
      },
      'NEUTRAL': {
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/10 border-slate-500/30',
        icon: Minus,
        label: 'Neutral / Balanced'
      }
    };
    return info[direction] || info['NEUTRAL'];
  };

  // Strength color
  const getStrengthColor = (strength: string) => {
    const colors: Record<string, string> = {
      'VERY_WEAK': 'text-slate-500',
      'WEAK': 'text-slate-400',
      'MODERATE': 'text-amber-400',
      'STRONG': 'text-orange-400',
      'VERY_STRONG': 'text-red-400'
    };
    return colors[strength] || colors['WEAK'];
  };

  // Confidence color
  const getConfidenceColor = (confidence: string) => {
    const colors: Record<string, string> = {
      'LOW': 'text-slate-400 bg-slate-500/10 border-slate-500/30',
      'MEDIUM': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      'HIGH': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    };
    return colors[confidence] || colors['LOW'];
  };

  const directionInfo = getDirectionInfo(imbalance.direction);
  const DirectionIcon = directionInfo.icon;
  
  // Calculate BI percentage (0.5 = neutral, >0.5 = bullish, <0.5 = bearish)
  const biPercent = (imbalance.BI * 100).toFixed(1);
  const biNormalized = ((imbalance.BI - 0.5) * 200).toFixed(0); // -100 to +100 scale

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${directionInfo.bgColor}`}>
            <Activity className={`w-6 h-6 ${directionInfo.color}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-100">Book Imbalance</h3>
            <p className="text-xs text-slate-400">Bid/Ask pressure</p>
          </div>
        </div>

        <div className={`px-4 py-2 rounded-lg border ${getConfidenceColor(imbalance.interpretation.confidence)}`}>
          <p className="text-sm font-bold uppercase">
            {imbalance.interpretation.confidence} Confidence
          </p>
        </div>
      </div>

      {/* Main BI Display */}
      <div className="mb-6">
        <div className="flex items-end gap-4 mb-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">BI Ratio</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${directionInfo.color}`}>
                {biPercent}
              </span>
              <span className="text-2xl text-slate-400 mb-1">%</span>
            </div>
          </div>
          
          <div className={`px-4 py-2 rounded-lg border-2 ${directionInfo.bgColor}`}>
            <div className="flex items-center gap-2">
              <DirectionIcon className={`w-5 h-5 ${directionInfo.color}`} />
              <p className={`text-sm font-bold ${directionInfo.color}`}>
                {directionInfo.label}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Bar (centered at 50%) */}
        <div className="relative">
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
            {/* Bearish side (0-50%) */}
            <div className="absolute left-0 top-0 h-full w-1/2 bg-red-500/20" />
            {/* Bullish side (50-100%) */}
            <div className="absolute right-0 top-0 h-full w-1/2 bg-emerald-500/20" />
            {/* Center line */}
            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-slate-600" />
            {/* Current position */}
            <div 
              className={`absolute top-0 h-full w-1 transition-all ${
                imbalance.BI > 0.5 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ left: `${imbalance.BI * 100}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>100% Sell</span>
            <span>Neutral</span>
            <span>100% Buy</span>
          </div>
        </div>

        {/* Normalized scale */}
        <div className="mt-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Normalized (-100 to +100)</p>
          <p className={`text-2xl font-bold ${
            parseInt(biNormalized) > 20 ? 'text-emerald-400' :
            parseInt(biNormalized) < -20 ? 'text-red-400' :
            'text-slate-400'
          }`}>
            {biNormalized > '0' ? '+' : ''}{biNormalized}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Strength */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Strength</p>
          <p className={`text-lg font-bold ${getStrengthColor(imbalance.strength)}`}>
            {imbalance.strength.replace('_', ' ')}
          </p>
        </div>

        {/* Persistence */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Persistence</p>
          <p className={`text-lg font-bold ${
            imbalance.persistence > 0.7 ? 'text-emerald-400' :
            imbalance.persistence > 0.3 ? 'text-amber-400' :
            'text-slate-400'
          }`}>
            {(imbalance.persistence * 100).toFixed(0)}%
          </p>
        </div>

        {/* 60s Average */}
        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">60s Avg</p>
          <p className="text-lg font-bold text-slate-200">
            {(imbalance.avg_60s * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Interpretation */}
      <div className={`p-4 rounded-lg border ${
        imbalance.interpretation.confidence === 'HIGH' ? 'bg-emerald-500/5 border-emerald-500/20' :
        imbalance.interpretation.confidence === 'MEDIUM' ? 'bg-amber-500/5 border-amber-500/20' :
        'bg-slate-800/30 border-slate-700'
      }`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 mt-0.5 ${
            imbalance.interpretation.confidence === 'HIGH' ? 'text-emerald-400' :
            imbalance.interpretation.confidence === 'MEDIUM' ? 'text-amber-400' :
            'text-slate-400'
          }`} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200 mb-1">
              {imbalance.interpretation.message}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {imbalance.interpretation.recommendation}
            </p>
          </div>
        </div>
      </div>

      {/* Delta from 60s Average */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Delta from 60s Avg
          </span>
          <span className={`text-sm font-bold ${
            Math.abs(imbalance.BI - imbalance.avg_60s) > 0.05 ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {imbalance.BI > imbalance.avg_60s ? '+' : ''}
            {((imbalance.BI - imbalance.avg_60s) * 100).toFixed(2)}%
          </span>
        </div>
        
        {Math.abs(imbalance.BI - imbalance.avg_60s) > 0.05 && (
          <p className="text-xs text-amber-400 mt-2">
            ⚠️ Significant deviation from average - momentum shift
          </p>
        )}
      </div>

      {/* Persistence Warning */}
      {imbalance.persistence < 0.3 && imbalance.strength !== 'VERY_WEAK' && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Low Persistence Warning</p>
              <p className="text-xs text-slate-300 mt-1">
                Imbalance is not sustained - direction may reverse quickly
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}