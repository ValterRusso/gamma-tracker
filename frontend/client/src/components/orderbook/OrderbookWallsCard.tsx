// ============================================================================
// ORDERBOOK WALLS CARD
// Arquivo: src/components/orderbook/OrderbookWallsCard.tsx
// ============================================================================

import { Shield, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import type { OrderbookWallsData } from '../../types/api';

interface OrderbookWallsCardProps {
  walls: OrderbookWallsData;
  spotPrice?: number;
  className?: string;
}

export default function OrderbookWallsCard({ 
  walls, 
  spotPrice,
  className = '' 
}: OrderbookWallsCardProps) {
  
  // Wall significance color
  const getSignificanceColor = (significance: string) => {
    const colors: Record<string, string> = {
      'NEGLIGIBLE': 'text-slate-500 bg-slate-500/10 border-slate-500/30',
      'LOW': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      'MEDIUM': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      'HIGH': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      'VERY_HIGH': 'text-red-400 bg-red-500/10 border-red-500/30',
      'EXTREME': 'text-rose-500 bg-rose-500/20 border-rose-500/50'
    };
    return colors[significance] || colors['MEDIUM'];
  };

  const { bidWall, askWall, interpretation } = walls;
  
  // Calculate distance percentages if spotPrice provided
  const bidDistance = spotPrice 
    ? ((bidWall.price - spotPrice) / spotPrice * 100).toFixed(2)
    : bidWall.distance.toFixed(2);
  
  const askDistance = spotPrice
    ? ((askWall.price - spotPrice) / spotPrice * 100).toFixed(2)
    : askWall.distance.toFixed(2);

  // Check if price is between walls (in the zone)
  const inZone = spotPrice 
    ? spotPrice > bidWall.price && spotPrice < askWall.price
    : true;

  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-lg">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-100">Orderbook Walls</h3>
            <p className="text-xs text-slate-400">Large order clusters</p>
          </div>
        </div>

        <div className={`px-4 py-2 rounded-lg border ${getSignificanceColor(interpretation.significance)}`}>
          <p className="text-sm font-bold uppercase">
            {interpretation.significance.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Interpretation Message */}
      <div className="mb-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
        <p className="text-sm text-slate-200 leading-relaxed">
          {interpretation.message}
        </p>
        
        {inZone && spotPrice && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Price currently trapped between walls</span>
          </div>
        )}
      </div>

      {/* Visual Wall Representation */}
      <div className="mb-6 relative">
        {/* Bid Wall (Support) */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400 uppercase font-semibold">Bid Wall (Support)</span>
            </div>
            <span className="text-xs text-emerald-400 font-bold">
              {bidDistance}% below
            </span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min((bidWall.ratio / 2000) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Spot Price Indicator */}
        {spotPrice && (
          <div className="my-3 flex items-center gap-2">
            <div className="flex-1 border-t-2 border-dashed border-slate-600" />
            <span className="text-sm font-bold text-slate-300">
              Spot: ${spotPrice.toLocaleString()}
            </span>
            <div className="flex-1 border-t-2 border-dashed border-slate-600" />
          </div>
        )}

        {/* Ask Wall (Resistance) */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs text-slate-400 uppercase font-semibold">Ask Wall (Resistance)</span>
            </div>
            <span className="text-xs text-red-400 font-bold">
              {askDistance}% above
            </span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all"
              style={{ width: `${Math.min((askWall.ratio / 2000) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Wall Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bid Wall Details */}
        <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400 uppercase">Bid Support</p>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-400">Price Level</p>
              <p className="text-lg font-bold text-slate-100 font-mono">
                ${bidWall.price.toLocaleString()}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-slate-400">Size</p>
              <p className="text-lg font-bold text-emerald-400">
                {bidWall.size.toFixed(3)} BTC
              </p>
            </div>
            
            <div>
              <p className="text-xs text-slate-400">Ratio vs Avg</p>
              <p className="text-lg font-bold text-slate-200">
                {bidWall.ratio.toFixed(1)}x
              </p>
            </div>
          </div>
        </div>

        {/* Ask Wall Details */}
        <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <p className="text-sm font-semibold text-red-400 uppercase">Ask Resistance</p>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-400">Price Level</p>
              <p className="text-lg font-bold text-slate-100 font-mono">
                ${askWall.price.toLocaleString()}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-slate-400">Size</p>
              <p className="text-lg font-bold text-red-400">
                {askWall.size.toFixed(3)} BTC
              </p>
            </div>
            
            <div>
              <p className="text-xs text-slate-400">Ratio vs Avg</p>
              <p className="text-lg font-bold text-slate-200">
                {askWall.ratio.toFixed(1)}x
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Zone Info */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-400 mb-1">Zone Width</p>
            <p className="text-lg font-bold text-slate-200">
              ${Math.abs(askWall.price - bidWall.price).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">
              {(Math.abs(askWall.price - bidWall.price) / ((askWall.price + bidWall.price) / 2) * 100).toFixed(2)}%
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-400 mb-1">Total Wall Size</p>
            <p className="text-lg font-bold text-slate-200">
              {(bidWall.size + askWall.size).toFixed(2)} BTC
            </p>
            <p className="text-xs text-slate-500">
              ${((bidWall.size + askWall.size) * (spotPrice || (bidWall.price + askWall.price) / 2) / 1000).toFixed(0)}K
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-400 mb-1">Pressure Balance</p>
            <p className={`text-lg font-bold ${
              bidWall.size > askWall.size ? 'text-emerald-400' : 
              askWall.size > bidWall.size ? 'text-red-400' : 
              'text-slate-400'
            }`}>
              {bidWall.size > askWall.size ? 'Buy' : askWall.size > bidWall.size ? 'Sell' : 'Balanced'}
            </p>
            <p className="text-xs text-slate-500">
              {(Math.abs(bidWall.size - askWall.size) / Math.max(bidWall.size, askWall.size) * 100).toFixed(0)}% diff
            </p>
          </div>
        </div>
      </div>

      {/* Wall Strength Indicators */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Bid Wall Strength */}
        <div className={`p-3 rounded-lg border ${
          bidWall.ratio > 1000 ? 'bg-emerald-500/10 border-emerald-500/30' :
          bidWall.ratio > 500 ? 'bg-amber-500/10 border-amber-500/30' :
          'bg-slate-800/30 border-slate-700'
        }`}>
          <p className="text-xs text-slate-400 mb-1">Bid Strength</p>
          <p className={`text-sm font-bold ${
            bidWall.ratio > 1000 ? 'text-emerald-400' :
            bidWall.ratio > 500 ? 'text-amber-400' :
            'text-slate-400'
          }`}>
            {bidWall.ratio > 1000 ? 'Very Strong' :
             bidWall.ratio > 500 ? 'Strong' :
             'Moderate'}
          </p>
        </div>

        {/* Ask Wall Strength */}
        <div className={`p-3 rounded-lg border ${
          askWall.ratio > 1000 ? 'bg-red-500/10 border-red-500/30' :
          askWall.ratio > 500 ? 'bg-amber-500/10 border-amber-500/30' :
          'bg-slate-800/30 border-slate-700'
        }`}>
          <p className="text-xs text-slate-400 mb-1">Ask Strength</p>
          <p className={`text-sm font-bold ${
            askWall.ratio > 1000 ? 'text-red-400' :
            askWall.ratio > 500 ? 'text-amber-400' :
            'text-slate-400'
          }`}>
            {askWall.ratio > 1000 ? 'Very Strong' :
             askWall.ratio > 500 ? 'Strong' :
             'Moderate'}
          </p>
        </div>
      </div>
    </div>
  );
}