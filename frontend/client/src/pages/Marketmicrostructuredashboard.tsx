// ============================================================================
// MARKET MICROSTRUCTURE DASHBOARD - Complete Integration
// Arquivo: src/pages/MarketMicrostructureDashboard.tsx
// ============================================================================

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useEscapeDetection } from '../hooks/useEscape';
import { useOrderbookImbalance, useOrderbookWalls } from '../hooks/useEscape';
import { useLiquidationSummary } from '../hooks/useLiquidations';
import EscapeDetectorCard from '../components/escape/EscapeDetectorCard';
import IcebergDetectorCard from '../components/escape/IcebergDetectorCard';
import OrderbookWallsCard from '../components/orderbook/OrderbookWallsCard';
import OrderbookImbalanceCard from '../components/orderbook/OrderbookImbalanceCard';
import LiquidationEnergyCard from '../components/Liquidationenergycard';

export default function MarketMicrostructureDashboard() {
  const [spotPrice, setSpotPrice] = useState<number | undefined>();
  
  // Fetch all data with different refresh rates
  const { 
    detection, 
    probability, 
    energy: escapeEnergy,
    loading: escapeLoading,
    error: escapeError,
    refetch: refetchEscape
  } = useEscapeDetection(true, 3000); // 3s - fastest

  const {
    imbalance,
    loading: imbalanceLoading,
    error: imbalanceError,
    refetch: refetchImbalance
  } = useOrderbookImbalance(true, 5000); // 5s

  const {
    walls,
    loading: wallsLoading,
    error: wallsError,
    refetch: refetchWalls
  } = useOrderbookWalls(true, 5000); // 5s

  const {
    energy: liqEnergy,
    loading: liqLoading,
    error: liqError,
    refetch: refetchLiq
  } = useLiquidationSummary(true, 10000); // 10s

  // Extract spot price from detection data
  useEffect(() => {
    if (detection?.metrics?.wallInfo) {
      // Calculate approximate spot from wall distance
      const wallPrice = detection.metrics.wallInfo.strike;
      const distance = detection.metrics.wallInfo.distance;
      const calculatedSpot = wallPrice / (1 + distance);
      setSpotPrice(calculatedSpot);
    }
  }, [detection]);

  // Manual refresh all
  const handleRefreshAll = () => {
    refetchEscape();
    refetchImbalance();
    refetchWalls();
    refetchLiq();
  };

  // Loading state
  const isLoading = escapeLoading || imbalanceLoading || wallsLoading || liqLoading;
  
  // Error handling
  const hasError = escapeError || imbalanceError || wallsError || liqError;

  if (isLoading && !detection && !imbalance && !walls && !liqEnergy) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading market microstructure data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">
              Market Microstructure
            </h1>
            <p className="text-slate-400">
              Real-time orderbook dynamics, escape detection & liquidation analysis
            </p>
          </div>

          <button
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center gap-4">
          {spotPrice && (
            <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 mr-2">Spot:</span>
              <span className="text-sm font-bold text-slate-100">
                ${spotPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {detection && (
            <div className={`px-4 py-2 rounded-lg border ${
              detection.type === 'NONE' ? 'bg-slate-800 border-slate-700' :
              detection.type.includes('VACUUM') ? 'bg-rose-500/20 border-rose-500/50 animate-pulse' :
              'bg-purple-500/20 border-purple-500/50'
            }`}>
              <span className="text-xs text-slate-400 mr-2">Escape:</span>
              <span className="text-sm font-bold text-slate-100">
                {detection.type.replace('_', ' ')}
              </span>
            </div>
          )}

          {imbalance && (
            <div className={`px-4 py-2 rounded-lg border ${
              imbalance.direction === 'BULLISH' ? 'bg-emerald-500/20 border-emerald-500/50' :
              imbalance.direction === 'BEARISH' ? 'bg-red-500/20 border-red-500/50' :
              'bg-slate-800 border-slate-700'
            }`}>
              <span className="text-xs text-slate-400 mr-2">Book:</span>
              <span className="text-sm font-bold text-slate-100">
                {imbalance.direction}
              </span>
            </div>
          )}

          {liqEnergy && (
            <div className={`px-4 py-2 rounded-lg border ${
              liqEnergy.level === 'VERY_HIGH' || liqEnergy.level === 'EXTREME' ? 'bg-red-500/20 border-red-500/50' :
              liqEnergy.level === 'HIGH' ? 'bg-orange-500/20 border-orange-500/50' :
              liqEnergy.level === 'MEDIUM' ? 'bg-amber-500/20 border-amber-500/50' :
              'bg-slate-800 border-slate-700'
            }`}>
              <span className="text-xs text-slate-400 mr-2">Liq Energy:</span>
              <span className="text-sm font-bold text-slate-100">
                {liqEnergy.level}
              </span>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {hasError && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-400">Connection Issues</p>
                <p className="text-xs text-slate-300 mt-1">
                  {escapeError || imbalanceError || wallsError || liqError}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="space-y-6">
        {/* Row 1: Escape Detection (Full Width) */}
        {detection && probability && (
          <EscapeDetectorCard 
            detection={detection}
            probability={probability}
          />
        )}

        {/* Row 2: Iceberg + Liquidations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {detection?.metrics?.potential?.components?.iceberg && (
            <IcebergDetectorCard 
              iceberg={detection.metrics.potential.components.iceberg}
            />
          )}

          {liqEnergy && (
            <LiquidationEnergyCard 
              energy={liqEnergy}
            />
          )}
        </div>

        {/* Row 3: Orderbook Walls + Imbalance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {walls && (
            <OrderbookWallsCard 
              walls={walls}
              spotPrice={spotPrice}
            />
          )}

          {imbalance && (
            <OrderbookImbalanceCard 
              imbalance={imbalance}
            />
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center text-sm">
          <div>
            <p className="text-slate-400 mb-1">Escape Detection</p>
            <p className="text-slate-200 font-semibold">3s refresh</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Orderbook</p>
            <p className="text-slate-200 font-semibold">5s refresh</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Liquidations</p>
            <p className="text-slate-200 font-semibold">10s refresh</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Status</p>
            <p className={`font-semibold ${isLoading ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isLoading ? 'Updating...' : 'Live'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}