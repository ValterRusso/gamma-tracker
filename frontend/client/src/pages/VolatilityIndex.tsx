/**
 * VolatilityIndex.tsx - Deribit Volatility Index (DVOL) Dashboard
 * 
 * Features:
 * - BTC and ETH volatility gauges (semicircle)
 * - Historical chart (7d/30d/90d)
 * - Statistics cards (percentile, rank, avg)
 * - Real-time updates
 * 
 * Similar to VIX for crypto markets
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 */

import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ArrowLeft, TrendingUp, Activity, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface DVOLData {
  currency: string;
  timestamp: number;
  volatility: number;
  change24h: number;
  changePercent24h: number;
}

interface DVOLStats {
  currency: string;
  current: number;
  percentile: number;
  ivRank: number;
  high52w: number;
  low52w: number;
  avg30d: number;
  change24h: number;
  changePercent24h: number;
}

interface HistoricalPoint {
  timestamp: number;
  volatility: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function VolatilityIndex() {
  // State
  const [btcData, setBtcData] = useState<DVOLData | null>(null);
  const [ethData, setEthData] = useState<DVOLData | null>(null);
  const [btcStats, setBtcStats] = useState<DVOLStats | null>(null);
  const [ethStats, setEthStats] = useState<DVOLStats | null>(null);
  const [historicalBTC, setHistoricalBTC] = useState<HistoricalPoint[]>([]);
  const [historicalETH, setHistoricalETH] = useState<HistoricalPoint[]>([]);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch current DVOL
  const fetchCurrentDVOL = async () => {
    try {
      const response = await fetch('http://localhost:3300/api/dvol/current');
      const data = await response.json();

      if (data.success) {
        setBtcData(data.data.btc);
        setEthData(data.data.eth);
        setLastUpdate(new Date());
      } else {
        throw new Error(data.error || 'Failed to fetch current DVOL');
      }
    } catch (error) {
      console.error('[VolatilityIndex] Error fetching current DVOL:', error);
      toast.error('Failed to load volatility data');
    }
  };

  // Fetch historical DVOL
  const fetchHistoricalDVOL = async (tf: string) => {
    try {
      const response = await fetch(`http://localhost:3300/api/dvol/historical?timeframe=${tf}`);
      const data = await response.json();

      if (data.success) {
        setHistoricalBTC(data.data.btc);
        setHistoricalETH(data.data.eth);
      } else {
        throw new Error(data.error || 'Failed to fetch historical DVOL');
      }
    } catch (error) {
      console.error('[VolatilityIndex] Error fetching historical DVOL:', error);
      toast.error('Failed to load historical data');
    }
  };

  // Fetch stats
  const fetchStats = async (currency: string) => {
    try {
      const response = await fetch(`http://localhost:3300/api/dvol/stats?currency=${currency}`);
      const data = await response.json();

      if (data.success) {
        if (currency === 'BTC') {
          setBtcStats(data.data);
        } else {
          setEthStats(data.data);
        }
      }
    } catch (error) {
      console.error(`[VolatilityIndex] Error fetching ${currency} stats:`, error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCurrentDVOL(),
        fetchHistoricalDVOL(timeframe),
        fetchStats('BTC'),
        fetchStats('ETH')
      ]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchCurrentDVOL();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Reload historical when timeframe changes
  useEffect(() => {
    fetchHistoricalDVOL(timeframe);
  }, [timeframe]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getVolatilityLevel = (vol: number): { label: string; color: string } => {
    if (vol < 0.5) return { label: 'Calm', color: '#10b981' }; // Green
    if (vol < 0.8) return { label: 'Normal', color: '#3b82f6' }; // Blue
    if (vol < 1.2) return { label: 'Elevated', color: '#f59e0b' }; // Orange
    return { label: 'Extreme', color: '#ef4444' }; // Red
  };

  const formatVolatility = (vol: number): string => {
    return `${(vol * 100).toFixed(1)}%`;
  };

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    if (timeframe === '7d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-400" />
              <p className="text-gray-400">Loading volatility data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-400" />
                Volatility Index
              </h1>
              <p className="text-gray-400 mt-1">
                30-day implied volatility (similar to VIX)
              </p>
            </div>
          </div>
          
          {lastUpdate && (
            <div className="text-sm text-gray-400">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Gauges Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BTC Gauge */}
          <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2 text-purple-400">BTC DVOL</h3>
              
              {btcData && (
                <>
                  <div className="text-5xl font-bold my-4">
                    {formatVolatility(btcData.volatility)}
                  </div>
                  
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    btcData.changePercent24h >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {btcData.changePercent24h >= 0 ? '↑' : '↓'} {Math.abs(btcData.changePercent24h).toFixed(2)}% (24h)
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" 
                         style={{ backgroundColor: `${getVolatilityLevel(btcData.volatility).color}20`, 
                                  color: getVolatilityLevel(btcData.volatility).color }}>
                      <AlertCircle className="w-4 h-4" />
                      {getVolatilityLevel(btcData.volatility).label}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ETH Gauge */}
          <div className="bg-slate-900/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2 text-blue-400">ETH DVOL</h3>
              
              {ethData && (
                <>
                  <div className="text-5xl font-bold my-4">
                    {formatVolatility(ethData.volatility)}
                  </div>
                  
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    ethData.changePercent24h >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {ethData.changePercent24h >= 0 ? '↑' : '↓'} {Math.abs(ethData.changePercent24h).toFixed(2)}% (24h)
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" 
                         style={{ backgroundColor: `${getVolatilityLevel(ethData.volatility).color}20`, 
                                  color: getVolatilityLevel(ethData.volatility).color }}>
                      <AlertCircle className="w-4 h-4" />
                      {getVolatilityLevel(ethData.volatility).label}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {btcStats && (
            <>
              <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">BTC IV Percentile</div>
                <div className="text-2xl font-bold text-purple-400">{btcStats.percentile.toFixed(1)}%</div>
              </div>
              
              <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">BTC IV Rank</div>
                <div className="text-2xl font-bold text-purple-400">{btcStats.ivRank.toFixed(1)}%</div>
              </div>
            </>
          )}
          
          {ethStats && (
            <>
              <div className="bg-slate-900/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">ETH IV Percentile</div>
                <div className="text-2xl font-bold text-blue-400">{ethStats.percentile.toFixed(1)}%</div>
              </div>
              
              <div className="bg-slate-900/50 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">ETH IV Rank</div>
                <div className="text-2xl font-bold text-blue-400">{ethStats.ivRank.toFixed(1)}%</div>
              </div>
            </>
          )}
        </div>

        {/* Historical Chart */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Historical Volatility</h3>
            
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatTimestamp}
                stroke="#9ca3af"
              />
              <YAxis 
                tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                stroke="#9ca3af"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                labelFormatter={(val) => new Date(val).toLocaleString()}
                formatter={(val: number) => [`${(val * 100).toFixed(2)}%`, '']}
              />
              <Legend />
              <Line
                data={historicalBTC}
                type="monotone"
                dataKey="volatility"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                name="BTC DVOL"
              />
              <Line
                data={historicalETH}
                type="monotone"
                dataKey="volatility"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="ETH DVOL"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <strong className="text-blue-400">What is DVOL?</strong> Deribit Volatility Index measures the 30-day 
              implied volatility from at-the-money options, similar to VIX for traditional markets. Higher values 
              indicate higher expected volatility (fear/uncertainty), while lower values suggest calm markets.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
