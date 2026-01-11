// ============================================================================
// ENTROPY OVERVIEW V2.0 - Enhanced Dashboard
// Arquivo: src/pages/EntropyOverview.tsx
// 
// NEW FEATURES:
// - Dual-axis chart (entropy + price on same chart)
// - Event markers (stars on low entropy events)
// - Volume highlighting (colored bars by event type)
// - Data persistence (localStorage, 1000 points max)
// - Configurable settings (interval, threshold, max points)
// - 30-second collection interval (configurable)
// - Persistence check (N consecutive samples below threshold)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertCircle, Settings, Star, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine, 
  ComposedChart,
  Bar,
  Scatter,
  Cell
} from 'recharts';

// ============================================================================
// INTERFACES
// ============================================================================

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

interface HistoryPoint {
  timestamp: number;
  bid_entropy: number;
  ask_entropy: number;
  ratio: number;
  spotPrice: number;
  volume: number;
  rsi: number;
  bidEvent: boolean;
  askEvent: boolean;
}

interface Settings {
  collectionInterval: number; // seconds
  maxDataPoints: number;
  entropyThreshold: number;
  persistenceSamples: number; // N consecutive samples below threshold
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EntropyOverview() {
  // State
  const [entropyRSI, setEntropyRSI] = useState<EntropyRSIResponse['data'] | null>(null);
  const [binanceStats, setBinanceStats] = useState<BinanceStatsResponse['data'] | null>(null);
  const [entropyStats, setEntropyStats] = useState<EntropyStatsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);

  // Persistent history (localStorage)
  const [history, setHistory] = useState<HistoryPoint[]>(() => {
    try {
      const saved = localStorage.getItem('entropyHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Settings (localStorage)
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('entropySettings');
      return saved ? JSON.parse(saved) : {
        collectionInterval: 30,
        maxDataPoints: 1000,
        entropyThreshold: 0.5,
        persistenceSamples: 3
      };
    } catch {
      return {
        collectionInterval: 30,
        maxDataPoints: 1000,
        entropyThreshold: 0.5,
        persistenceSamples: 3
      };
    }
  });

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('entropyHistory', JSON.stringify(history));
  }, [history]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('entropySettings', JSON.stringify(settings));
  }, [settings]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Use refs to avoid dependency issues
  const historyRef = useRef(history);
  const settingsRef = useRef(settings);

  // Update refs when state changes
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const fetchData = useCallback(async (retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Entropy] Fetch attempt ${attempt}/${retries} at`, new Date().toISOString());
        
        const [entropyRes, binanceRes, statsRes] = await Promise.all([
          fetch('http://localhost:3300/api/entropy-rsi'),
          fetch('http://localhost:3300/api/binance/stats'),
          fetch('http://localhost:3300/api/entropy/stats')
        ]);

        console.log('[Entropy] Response statuses:', {
          entropy: entropyRes.status,
          binance: binanceRes.status,
          stats: statsRes.status
        });

        if (!entropyRes.ok || !binanceRes.ok || !statsRes.ok) {
          throw new Error(`HTTP Error: entropy=${entropyRes.status}, binance=${binanceRes.status}, stats=${statsRes.status}`);
        }

        const entropyData: EntropyRSIResponse = await entropyRes.json();
        const binanceData: BinanceStatsResponse = await binanceRes.json();
        const statsData: EntropyStatsResponse = await statsRes.json();
        
        console.log('[Entropy] Data received:', {
          bid_entropy: entropyData.data?.entropy.bid_entropy,
          ask_entropy: entropyData.data?.entropy.ask_entropy,
          price: binanceData.data?.spotPrice,
          volume: entropyData.data?.rsi.volume.current,
          historyLength: historyRef.current.length
        });

      if (entropyData.success && entropyData.data && binanceData.success && binanceData.data) {
        setEntropyRSI(entropyData.data);
        setBinanceStats(binanceData.data);

        // Detect events (persistence check) using refs
        const bidEvent = detectEvent(
          historyRef.current.map(h => h.bid_entropy),
          entropyData.data.entropy.bid_entropy,
          settingsRef.current.entropyThreshold,
          settingsRef.current.persistenceSamples
        );

        const askEvent = detectEvent(
          historyRef.current.map(h => h.ask_entropy),
          entropyData.data.entropy.ask_entropy,
          settingsRef.current.entropyThreshold,
          settingsRef.current.persistenceSamples
        );

        // Add new data point
        const newPoint: HistoryPoint = {
          timestamp: Date.now(),
          bid_entropy: entropyData.data.entropy.bid_entropy,
          ask_entropy: entropyData.data.entropy.ask_entropy,
          ratio: entropyData.data.entropy.ratio,
          spotPrice: binanceData.data.spotPrice,
          volume: entropyData.data.rsi.volume.current,
          rsi: entropyData.data.rsi.current,
          bidEvent,
          askEvent
        };

        setHistory(prev => {
          const updated = [...prev, newPoint];
          return updated.slice(-settingsRef.current.maxDataPoints);
        });
      }

      if (statsData.success && statsData.data) {
        setEntropyStats(statsData.data);
      }

        setLastUpdate(new Date());
        setError(null);
        console.log('[Entropy] Update successful, history length:', historyRef.current.length);
        return; // Success! Exit retry loop
        
      } catch (err) {
        console.error(`[Entropy] Fetch attempt ${attempt}/${retries} failed:`, err);
        
        if (attempt === retries) {
          // Last attempt failed
          setError(`Failed to fetch data after ${retries} attempts`);
          console.error('[Entropy] All retry attempts exhausted');
        } else {
          // Wait before retrying
          console.log(`[Entropy] Waiting 2s before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } finally {
        if (attempt === retries) {
          setLoading(false);
        }
      }
    }
  }, []); // No dependencies - stable function

  // Auto-refresh with configurable interval
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, settings.collectionInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.collectionInterval, fetchData]); // Only re-run when interval changes

  // Heartbeat monitoring - detect stale data
  useEffect(() => {
    const checkStale = setInterval(() => {
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdate.getTime();
      const expectedInterval = settings.collectionInterval * 1000;
      
      // If no update for 2x the expected interval
      if (timeSinceUpdate > expectedInterval * 2) {
        console.warn('[Entropy] Data stale! Last update:', lastUpdate.toISOString(), 'Time since:', Math.floor(timeSinceUpdate / 1000), 's');
        console.log('[Entropy] Forcing data refresh...');
        fetchData();
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkStale);
  }, [lastUpdate, settings.collectionInterval, fetchData]);

  // ============================================================================
  // EVENT DETECTION
  // ============================================================================

  /**
   * Detects if an event occurred based on persistence check
   * Returns true if last N samples (including current) are below threshold
   */
  const detectEvent = (
    recentValues: number[],
    currentValue: number,
    threshold: number,
    persistenceSamples: number
  ): boolean => {
    const samples = [...recentValues.slice(-(persistenceSamples - 1)), currentValue];
    if (samples.length < persistenceSamples) return false;
    return samples.every(v => v < threshold);
  };

  // ============================================================================
  // SETTINGS HANDLERS
  // ============================================================================

  const updateSettings = (key: keyof Settings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const clearHistory = () => {
    if (confirm('Clear all historical data?')) {
      setHistory([]);
      localStorage.removeItem('entropyHistory');
    }
  };

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

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
            onClick={() => fetchData()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const { entropy, rsi } = entropyRSI;

  // ============================================================================
  // CHART DATA PREPARATION
  // ============================================================================

  // Prepare dual-axis entropy + price data
  const dualAxisData = history.slice(-60).map(point => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    bid: point.bid_entropy,
    ask: point.ask_entropy,
    price: point.spotPrice,
    bidEvent: point.bidEvent,
    askEvent: point.askEvent
  }));

  // Extract event markers for scatter plot
  const bidEventMarkers = dualAxisData
    .filter(d => d.bidEvent)
    .map(d => ({ timestamp: d.timestamp, value: d.bid }));

  const askEventMarkers = dualAxisData
    .filter(d => d.askEvent)
    .map(d => ({ timestamp: d.timestamp, value: d.ask }));

  // Prepare volume data with event highlighting
  const volumeData = history.slice(-60).map(point => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    volume: point.volume,
    rsi: point.rsi,
    bidEvent: point.bidEvent,
    askEvent: point.askEvent,
    bothEvents: point.bidEvent && point.askEvent
  }));

  // Calculate statistics
  const avgPrice = history.length > 0
    ? history.reduce((sum, p) => sum + p.spotPrice, 0) / history.length
    : binanceStats.spotPrice;

  const priceChange = history.length > 1
    ? ((history[history.length - 1].spotPrice - history[0].spotPrice) / history[0].spotPrice) * 100
    : 0;

  // Determine ratio status
  const getRatioStatus = (ratio: number): { label: string; color: string } => {
    if (ratio > 1.2) return { label: 'BULLISH', color: 'text-emerald-400' };
    if (ratio < 0.8) return { label: 'BEARISH', color: 'text-rose-400' };
    return { label: 'NEUTRAL', color: 'text-slate-400' };
  };

  const ratioStatus = getRatioStatus(entropy.ratio);

  // Count events
  const totalBidEvents = history.filter(h => h.bidEvent).length;
  const totalAskEvents = history.filter(h => h.askEvent).length;
  const totalBothEvents = history.filter(h => h.bidEvent && h.askEvent).length;

  // ============================================================================
  // CUSTOM TOOLTIP
  // ============================================================================

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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/">
              <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </Link>
            <h1 className="text-3xl font-bold text-slate-100">
              🧮 Entropy Analysis V2.0
            </h1>
          </div>
          <p className="text-slate-400">
            Real-time order book entropy analysis for {entropy.depth_info.asset.toUpperCase()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Last updated: {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago • 
            {history.length} data points • 
            Interval: {settings.collectionInterval}s
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">⚙️ Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Collection Interval */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Collection Interval: {settings.collectionInterval}s
              </label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={settings.collectionInterval}
                onChange={(e) => updateSettings('collectionInterval', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">
                How often to collect new data points
              </p>
            </div>

            {/* Max Data Points */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Max Data Points: {settings.maxDataPoints}
              </label>
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={settings.maxDataPoints}
                onChange={(e) => updateSettings('maxDataPoints', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">
                Maximum history size (older points are removed)
              </p>
            </div>

            {/* Entropy Threshold */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Entropy Threshold: {settings.entropyThreshold.toFixed(2)}
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={settings.entropyThreshold}
                onChange={(e) => updateSettings('entropyThreshold', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
              />
              <p className="text-xs text-slate-500 mt-1">
                Threshold for detecting low entropy events
              </p>
            </div>

            {/* Persistence Samples */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Persistence Samples: {settings.persistenceSamples}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                value={settings.persistenceSamples}
                onChange={(e) => updateSettings('persistenceSamples', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
              />
              <p className="text-xs text-slate-500 mt-1">
                N consecutive samples below threshold to trigger event
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <button
              onClick={clearHistory}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
            >
              Clear History
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
          <p className={`text-xs font-semibold mt-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {binanceStats.totalOptions} options
          </p>
        </div>
      </div>

      {/* Dual-Axis Chart: Entropy + Price */}
      {dualAxisData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">
            📈 Entropy + Price (Dual Axis) {bidEventMarkers.length + askEventMarkers.length > 0 && '⭐'}
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart 
              key={`entropy-chart-${history.length}`}
              data={dualAxisData.slice(-500)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#10b981"
                style={{ fontSize: '12px' }}
                label={{ value: 'Entropy', angle: -90, position: 'insideLeft', fill: '#64748b' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#3b82f6"
                style={{ fontSize: '12px' }}
                label={{ value: 'Price ($)', angle: 90, position: 'insideRight', fill: '#64748b' }}
                domain={['dataMin - 100', 'dataMax + 100']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Entropy Lines */}
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="bid" 
                stroke="#10b981" 
                name="Bid Entropy"
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="ask" 
                stroke="#f43f5e" 
                name="Ask Entropy"
                strokeWidth={2}
                dot={false}
              />
              
              {/* Price Line */}
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="price" 
                stroke="#3b82f6" 
                name="Spot Price"
                strokeWidth={2}
                dot={false}
              />

              {/* Event Markers */}
              {bidEventMarkers.length > 0 && (
                <Scatter
                  yAxisId="left"
                  data={bidEventMarkers}
                  fill="#fbbf24"
                  shape="star"
                  name="Bid Event"
                />
              )}
              {askEventMarkers.length > 0 && (
                <Scatter
                  yAxisId="left"
                  data={askEventMarkers}
                  fill="#f97316"
                  shape="star"
                  name="Ask Event"
                />
              )}

              {/* Threshold Line */}
              <ReferenceLine 
                yAxisId="left"
                y={settings.entropyThreshold} 
                stroke="#64748b" 
                strokeDasharray="3 3"
                label={{ value: 'Threshold', fill: '#64748b', fontSize: 10 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Volume + RSI with Event Highlighting */}
      {volumeData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">
            📊 Volume + RSI (Event Highlighting)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart 
              key={`volume-chart-${history.length}`}
              data={volumeData.slice(-500)}
            >              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#06b6d4"
                style={{ fontSize: '12px' }}
                label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#64748b' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#a855f7"
                style={{ fontSize: '12px' }}
                domain={[0, 100]}
                label={{ value: 'RSI', angle: 90, position: 'insideRight', fill: '#64748b' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Volume Bars with Event Highlighting */}
              <Bar
                yAxisId="left"
                dataKey="volume"
                name="Volume"
              >
                {volumeData.map((entry, index) => {
                  let fillColor = '#64748b'; // Gray - normal
                  if (entry.bothEvents) fillColor = '#fbbf24'; // Yellow - both events
                  else if (entry.bidEvent) fillColor = '#f43f5e'; // Red - bid event
                  else if (entry.askEvent) fillColor = '#10b981'; // Green - ask event
                  
                  return <Cell key={`cell-${index}`} fill={fillColor} opacity={0.7} />;
                })}
              </Bar>

              {/* RSI Line */}
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="rsi" 
                stroke="#a855f7" 
                name="RSI"
                strokeWidth={2}
                dot={false}
              />

              {/* RSI Reference Lines */}
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
            </ComposedChart>
          </ResponsiveContainer>
          
          {/* Event Legend */}
          <div className="mt-4 flex gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-600 rounded"></div>
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-rose-500 rounded"></div>
              <span>Bid Event</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded"></div>
              <span>Ask Event</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-400 rounded"></div>
              <span>Both Events</span>
            </div>
          </div>
        </div>
      )}

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
        </div>

        {/* Events Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-100">Events Detected</h3>
          </div>
          <p className="text-3xl font-bold text-amber-400 mb-2">
            {totalBidEvents + totalAskEvents}
          </p>
          <div className="flex gap-4 text-xs text-slate-400 mb-2">
            <span className="text-rose-400">↓ {totalBidEvents} bid</span>
            <span className="text-emerald-400">↑ {totalAskEvents} ask</span>
          </div>
          <p className="text-xs text-slate-500">
            ⚡ {totalBothEvents} simultaneous
          </p>
        </div>
      </div>
    </div>
  );
}
