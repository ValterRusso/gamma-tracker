// ============================================================================
// ESCAPE DETECTOR CARD - Main Component
// Arquivo: src/components/escape/EscapeDetectorCard.tsx
// ============================================================================

import { Rocket, TrendingUp, TrendingDown, AlertTriangle, Zap, Shield } from 'lucide-react';
import type { EscapeDetectionData, EscapeProbabilityData } from '../../types/api';

interface EscapeDetectorCardProps {
  detection: EscapeDetectionData;
  probability: EscapeProbabilityData;
  className?: string;
}

export default function EscapeDetectorCard({ 
  detection, 
  probability, 
  className = '' 
}: EscapeDetectorCardProps) {
  
  // Escape type color and icon
  const getEscapeInfo = (type: string) => {
    const info: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
      'NONE': {
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/10 border-slate-500/30',
        icon: Shield,
        label: 'No Escape Detected'
      },
      'UPWARD': {
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20 border-emerald-500/50',
        icon: TrendingUp,
        label: 'Upward Escape'
      },
      'DOWNWARD': {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20 border-red-500/50',
        icon: TrendingDown,
        label: 'Downward Escape'
      },
      'VACUUM_UP': {
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20 border-cyan-500/50 animate-pulse',
        icon: Rocket,
        label: 'VACUUM ESCAPE UP!'
      },
      'VACUUM_DOWN': {
        color: 'text-rose-400',
        bgColor: 'bg-rose-500/20 border-rose-500/50 animate-pulse',
        icon: Rocket,
        label: 'VACUUM ESCAPE DOWN!'
      }
    };
    return info[type] || info['NONE'];
  };

  // Probability classification color
  const getProbabilityColor = (classification: string) => {
    const colors: Record<string, string> = {
      'VERY_LOW': 'text-slate-400',
      'LOW': 'text-emerald-400',
      'MEDIUM': 'text-amber-400',
      'HIGH': 'text-orange-400',
      'VERY_HIGH': 'text-red-400',
      'EXTREME': 'text-rose-500'
    };
    return colors[classification] || 'text-slate-400';
  };

  const escapeInfo = getEscapeInfo(detection.type);
  const EscapeIcon = escapeInfo.icon;
  
  const pEscape = (probability.P_escape * 100).toFixed(1);
  const totalEnergy = (detection.metrics.totalEnergy * 100).toFixed(1);
  const potential = (detection.metrics.potential.total * 100).toFixed(1);

  // Regime color
  const getRegimeColor = (regime: string) => {
    const colors: Record<string, string> = {
      'FULL_MARKET': 'text-cyan-400',
      'BOOK_DOMINANT': 'text-amber-400',
      'OPTIONS_DOMINANT': 'text-purple-400',
      'TRANSITION': 'text-slate-400',
      'LOW_LIQUIDITY': 'text-red-400'
    };
    return colors[regime] || 'text-slate-400';
  };

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-linear-to-br from-purple-500/20 to-cyan-500/20 rounded-lg">
            <Rocket className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-100">Escape Detector</h3>
            <p className="text-xs text-slate-400">Breakout Validation System</p>
          </div>
        </div>

        {/* Regime Badge */}
        <div className={`px-3 py-1 rounded-lg border border-slate-700 ${getRegimeColor(detection.metrics.potential.regime)}`}>
          <p className="text-xs font-semibold uppercase">
            {detection.metrics.potential.regime.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Main Detection Status */}
      <div className={`mb-6 p-5 rounded-xl border-2 ${escapeInfo.bgColor}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <EscapeIcon className={`w-8 h-8 ${escapeInfo.color}`} />
            <div>
              <p className={`text-2xl font-bold ${escapeInfo.color}`}>
                {escapeInfo.label}
              </p>
              {detection.confidence > 0 && (
                <p className="text-sm text-slate-300">
                  Confidence: {(detection.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-slate-300 leading-relaxed">
          {detection.interpretation}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Escape Probability */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wide">P(Escape)</p>
          </div>
          <p className={`text-3xl font-bold ${getProbabilityColor(probability.classification)}`}>
            {pEscape}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {probability.classification.replace('_', ' ')}
          </p>
        </div>

        {/* Total Energy */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wide">Energy</p>
          </div>
          <p className="text-3xl font-bold text-emerald-400">
            {totalEnergy}%
          </p>
          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(parseFloat(totalEnergy), 100)}%` }}
            />
          </div>
        </div>

        {/* Potential Barrier */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-red-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wide">Barrier</p>
          </div>
          <p className="text-3xl font-bold text-red-400">
            {potential}%
          </p>
          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all"
              style={{ width: `${Math.min(parseFloat(potential), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Energy Breakdown */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
          Energy Components
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Sustained (Book)</p>
            <p className="text-lg font-bold text-slate-200">
              {(detection.metrics.sustainedEnergy * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Injected (Liq)</p>
            <p className="text-lg font-bold text-slate-200">
              {(detection.metrics.injectedEnergy * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Barrier Components */}
      <div className="mb-6">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
          Barrier Components (Weights: GEX {detection.metrics.potential.weights.gex * 100}% / Iceberg {detection.metrics.potential.weights.iceberg * 100}% / Liquidity {detection.metrics.potential.weights.liquidity * 100}%)
        </p>
        <div className="space-y-2">
          {/* GEX Wall */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">GEX Wall</span>
              <span className="text-slate-200 font-semibold">
                {(detection.metrics.potential.components.gex.value * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500"
                style={{ width: `${detection.metrics.potential.components.gex.value * 100}%` }}
              />
            </div>
          </div>

          {/* Iceberg */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">
                Iceberg Orders {detection.metrics.potential.components.iceberg.detected && '🧊'}
              </span>
              <span className="text-slate-200 font-semibold">
                {(detection.metrics.potential.components.iceberg.value * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500"
                style={{ width: `${detection.metrics.potential.components.iceberg.value * 100}%` }}
              />
            </div>
          </div>

          {/* Liquidity */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Book Liquidity</span>
              <span className="text-slate-200 font-semibold">
                {(detection.metrics.potential.components.liquidity.value * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500"
                style={{ width: `${Math.max(detection.metrics.potential.components.liquidity.value * 100, 0)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Wall Info */}
      {detection.metrics.wallInfo && (
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                Nearest {detection.metrics.wallInfo.type} Wall
              </p>
              <p className="text-2xl font-bold text-slate-100">
                ${detection.metrics.wallInfo.strike.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Distance</p>
              <p className={`text-lg font-semibold ${
                Math.abs(detection.metrics.wallInfo.distance) < 0.5 ? 'text-red-400' : 'text-slate-300'
              }`}>
                {detection.metrics.wallInfo.distance > 0 ? '+' : ''}{(detection.metrics.wallInfo.distance * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Iceberg Detection Alert */}
      {detection.metrics.potential.components.iceberg.detected && (
        <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-cyan-400">Iceberg Orders Detected</p>
              <p className="text-xs text-slate-300 mt-1">
                Hidden: ~{detection.metrics.potential.components.iceberg.estimatedHiddenSize.hidden.toFixed(2)} BTC 
                ({detection.metrics.potential.components.iceberg.estimatedHiddenSize.multiplier}x visible)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}