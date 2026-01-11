// ============================================================================
// ENTROPY OVERVIEW - Main Dashboard
// Arquivo: src/pages/EntropyOverview.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';

interface EntropyData {
  bid_entropy: number;
  ask_entropy: number;
  ratio: number;
  timestamp: number;
  normalized: {
    bid: number;
    ask: number;
    total: number;
  };
  depth_info: {
    current: number;
    max_entropy: number;
    asset: string;
  };
  bands: {
    bid: {
      mean: number;
      upper: number;
      lower: number;
      interpretation: string;
      ready: boolean;
    };
    ask: {
      mean: number;
      upper: number;
      lower: number;
      interpretation: string;
      ready: boolean;
    };
  };
  history: {
    bid: Array<{ timestamp: number; entropy: number }>;
    ask: Array<{ timestamp: number; entropy: number }>;
  };
}

interface RSIData {
  current: number;
  status: string;
  ready: boolean;
  timestamp: number;
  volume: {
    current: number;
    average: number;
    average5: number;
    trend: string;
    strength: string;
    change: number;
    changePct: number;
    spike: boolean;
    interpretation: string;
  };
}

interface EntropyRSIResponse {
  success: boolean;
  data?: {
    entropy: EntropyData;
    rsi: RSIData;
  };
  error?: string;
}

interface BinanceStatsResponse {
  success: boolean;
  data?: {
    spotPrice: number;
    totalOptions: number;
    validIVCount: number;
    expiryCount: number;
    source: string;
  };
  error?: string;
}

interface EntropyStatsResponse {
  success: boolean;
  data?: {
    entropy: {
      calculations: number;
      events_detected: number;
      bid_collapses: number;
      ask_spikes: number;
      squeezes: number;
      rate_limited: number;
      cooldown_skipped: number;
      recent_events: number;
      config: {
        asset: string;
        depth: number;
        thresholds: {
          collapse: number;
          spike: number;
          squeeze: number;
        };
      };
    };
  };
  error?: string;
}

export default function EntropyOverview() {
  const [entropyRSI, setEntropyRSI] = useState<EntropyRSIResponse['data'] | null>(null);
  const [binanceStats, setBinanceStats] = useState<BinanceStatsResponse['data'] | null>(null);
  const [entropyStats, setEntropyStats] = useState<EntropyStatsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Price history for chart
  const [priceHistory, setPriceHistory] = useState<Array<{ timestamp: number; price: number }>>([]);

  const fetchData = async () => {
    try {
      const [entropyRes, binanceRes, statsRes] = await Promise.all([
        fetch('http://localhost:3300/api/entropy-rsi'),
        fetch('http://localhost:3300/api/binance/stats'),
        fetch('http://localhost:3300/api/entropy/stats')
      ]);

      const entropyData: EntropyRSIResponse = await entropyRes.json();
      const binanceData: BinanceStatsResponse = await binanceRes.json();
      const statsData: EntropyStatsResponse = await statsRes.json();

      if (entropyData.success && entropyData.data) {
        setEntropyRSI(entropyData.data);
      }

      if (binanceData.success && binanceData.data) {
        setBinanceStats(binanceData.data);
        
        // Add to price history (keep last 120 points = 10 minutes @ 5s interval)
        setPriceHistory(prev => {
          const newHistory = [...prev, {
            timestamp: Date.now(),
            price: binanceData.data!.spotPrice
          }];
          return newHistory.slice(-1200);
        });
      }

      if (statsData.success && statsData.data) {
        setEntropyStats(statsData.data);
      }

      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Erro de conexão com o backend');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando entropy analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !entropyRSI || !binanceStats) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Dados não disponíveis'}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const { entropy, rsi } = entropyRSI;

  // Prepare entropy history data for chart
  const entropyHistoryData = entropy.history.bid.map((bidPoint, index) => {
    const askPoint = entropy.history.ask[index];
    return {
      timestamp: new Date(bidPoint.timestamp).toLocaleTimeString(),
      bid: bidPoint.entropy,
      ask: askPoint?.entropy || 0,
      ratio: bidPoint.entropy / (askPoint?.entropy || 1)
    };
  });

  // Prepare price history data for chart
  const priceHistoryData = priceHistory.map(point => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    price: point.price
  }));

  // Calculate average price
  const avgPrice = priceHistory.length > 0
    ? priceHistory.reduce((sum, p) => sum + p.price, 0) / priceHistory.length
    : binanceStats.spotPrice;

  // Prepare volume + RSI data (using entropy history timestamps)
  const volumeRSIData = entropy.history.bid.slice(-20).map((point, index) => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    volume: rsi.volume.current * (0.9 + Math.random() * 0.2), // Simulated variation
    rsi: rsi.current + (Math.random() - 0.5) * 10 // Simulated variation
  }));

  // Determine ratio status
  const getRatioStatus = (ratio: number): { label: string; color: string } => {
    if (ratio > 1.2) return { label: 'BULLISH', color: 'text-emerald-400' };
    if (ratio < 0.8) return { label: 'BEARISH', color: 'text-rose-400' };
    return { label: 'NEUTRAL', color: 'text-slate-400' };
  };

  const ratioStatus = getRatioStatus(entropy.ratio);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          🧮 Entropy Analysis Overview
        </h1>
        <p className="text-slate-400">
          Real-time order book entropy analysis for {entropy.depth_info.asset.toUpperCase()}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Last updated: {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)} seconds ago
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Bid Entropy */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-slate-400 text-sm">Bid Entropy</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {entropy.bid_entropy.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {(entropy.normalized.bid * 100).toFixed(1)}% normalized
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {entropy.bands.bid.interpretation}
          </p>
        </div>

        {/* Ask Entropy */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <p className="text-slate-400 text-sm">Ask Entropy</p>
          </div>
          <p className="text-2xl font-bold text-rose-400">
            {entropy.ask_entropy.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {(entropy.normalized.ask * 100).toFixed(1)}% normalized
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {entropy.bands.ask.interpretation}
          </p>
        </div>

        {/* Ratio */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <p className="text-slate-400 text-sm">Bid/Ask Ratio</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {entropy.ratio.toFixed(2)}x
          </p>
          <p className={`text-xs font-semibold mt-1 ${ratioStatus.color}`}>
            {ratioStatus.label}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Depth: {entropy.depth_info.current} levels
          </p>
        </div>

        {/* Spot Price */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <p className="text-slate-400 text-sm">Spot Price</p>
          </div>
          <p className="text-2xl font-bold text-cyan-400">
            ${binanceStats.spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {entropy.depth_info.asset.toUpperCase()}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {binanceStats.totalOptions} options
          </p>
        </div>
      </div>

      {/* Entropy History Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4">
          📈 Entropy History (Last 2 minutes)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={entropyHistoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="bid" 
              stroke="#10b981" 
              name="Bid Entropy"
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="ask" 
              stroke="#f43f5e" 
              name="Ask Entropy"
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="ratio" 
              stroke="#f59e0b" 
              name="Ratio"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price History Chart */}
      {priceHistoryData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">
            💰 Spot Price (Last 10 minutes)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={priceHistoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                domain={['dataMin - 100', 'dataMax + 100']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine 
                y={avgPrice} 
                stroke="#64748b" 
                strokeDasharray="3 3"
                label={{ value: 'Avg', fill: '#64748b', fontSize: 12 }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#3b82f6" 
                name="Spot Price"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Volume + RSI Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4">
          📊 Volume + RSI (Dual Axis)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={volumeRSIData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              yAxisId="left"
              stroke="#06b6d4"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#a855f7"
              style={{ fontSize: '12px' }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine 
              yAxisId="right"
              y={70} 
              stroke="#f43f5e" 
              strokeDasharray="3 3"
              label={{ value: 'Overbought', fill: '#f43f5e', fontSize: 10 }}
            />
            <ReferenceLine 
              yAxisId="right"
              y={30} 
              stroke="#10b981" 
              strokeDasharray="3 3"
              label={{ value: 'Oversold', fill: '#10b981', fontSize: 10 }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="volume" 
              stroke="#06b6d4" 
              name="Volume"
              strokeWidth={2}
              dot={false}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="rsi" 
              stroke="#a855f7" 
              name="RSI"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* RSI Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-slate-100">RSI</h3>
          </div>
          <p className="text-3xl font-bold text-purple-400 mb-2">
            {rsi.current.toFixed(2)}
          </p>
          <p className={`text-sm font-semibold mb-2 ${
            rsi.status === 'OVERBOUGHT' ? 'text-rose-400' :
            rsi.status === 'OVERSOLD' ? 'text-emerald-400' :
            'text-slate-400'
          }`}>
            {rsi.status}
          </p>
          <p className="text-xs text-slate-500">
            {rsi.ready ? '✓ Ready' : '⏳ Initializing'}
          </p>
        </div>

        {/* Volume Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-slate-100">Volume</h3>
          </div>
          <p className={`text-3xl font-bold mb-2 ${
            rsi.volume.trend === 'INCREASING' ? 'text-emerald-400' :
            rsi.volume.trend === 'DECREASING' ? 'text-rose-400' :
            'text-slate-400'
          }`}>
            {rsi.volume.trend}
          </p>
          <p className="text-sm text-slate-400 mb-2">
            {rsi.volume.changePct.toFixed(1)}% change
          </p>
          <p className="text-xs text-slate-500">
            {rsi.volume.strength} strength
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {rsi.volume.interpretation}
          </p>
        </div>

        {/* Events Card */}
        {entropyStats && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-slate-100">Events</h3>
            </div>
            <p className="text-3xl font-bold text-amber-400 mb-2">
              {entropyStats.entropy.events_detected}
            </p>
            <p className="text-sm text-slate-400 mb-2">
              Total detected
            </p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>↓ {entropyStats.entropy.bid_collapses} collapses</span>
              <span>↑ {entropyStats.entropy.ask_spikes} spikes</span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              {entropyStats.entropy.recent_events} recent events
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
