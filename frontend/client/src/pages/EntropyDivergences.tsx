/**
 * EntropyDivergences.tsx - Price-Entropy Divergence Detection & Analysis
 * 
 * Detects and visualizes divergences between spot price and entropy metrics.
 * Divergences can signal potential trend reversals or continuations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'wouter';
import { 
  ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, 
  Activity, CheckCircle2, XCircle, Clock, Settings as SettingsIcon
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ReferenceLine, Scatter, ComposedChart
} from 'recharts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface EntropyData {
  bid_entropy: number;
  ask_entropy: number;
  ratio: number;
}

interface PivotPoint {
  timestamp: number;
  price: number;
  entropy: number;
  type: 'high' | 'low';
}

interface Divergence {
  id: string;
  timestamp: number;
  type: 'bullish' | 'bearish' | 'hidden_bullish' | 'hidden_bearish';
  strength: number; // 1-5
  priceStart: number;
  priceEnd: number;
  entropyStart: number;
  entropyEnd: number;
  pivotStart: PivotPoint;
  pivotEnd: PivotPoint;
  status: 'pending' | 'confirmed' | 'failed';
  confirmationPrice?: number;
  confirmationTime?: number;
}

interface HistoryPoint {
  timestamp: number;
  price: number;
  bidEntropy: number;
  askEntropy: number;
  avgEntropy: number;
}

interface Settings {
  pivotWindow: number; // Lookback for pivot detection
  minStrength: number; // Minimum strength to display
  confirmationThreshold: number; // % move to confirm
  maxDivergences: number; // Max to store
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EntropyDivergences() {
  // State with localStorage persistence
  const [history, setHistory] = useState<HistoryPoint[]>(() => {
    try {
      const saved = localStorage.getItem('entropy_divergences_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [divergences, setDivergences] = useState<Divergence[]>(() => {
    try {
      const saved = localStorage.getItem('entropy_divergences_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Settings with localStorage persistence
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('divergenceSettings');
      return saved ? JSON.parse(saved) : {
        pivotWindow: 10,
        minStrength: 2,
        confirmationThreshold: 2,
        maxDivergences: 50
      };
    } catch {
      return {
        pivotWindow: 10,
        minStrength: 2,
        confirmationThreshold: 2,
        maxDivergences: 50
      };
    }
  });

  // Refs for stable references
  const historyRef = useRef<HistoryPoint[]>([]);
  const divergencesRef = useRef<Divergence[]>([]);
  const settingsRef = useRef<Settings>(settings);

  // Update refs when state changes
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    divergencesRef.current = divergences;
  }, [divergences]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('divergenceSettings', JSON.stringify(settings));
  }, [settings]);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('entropy_divergences_history', JSON.stringify(history));
    }
  }, [history]);

  // Save divergences to localStorage
  useEffect(() => {
    if (divergences.length > 0) {
      localStorage.setItem('entropy_divergences_data', JSON.stringify(divergences));
    }
  }, [divergences]);

  // ============================================================================
  // PIVOT DETECTION
  // ============================================================================

  const findPivots = useCallback((data: HistoryPoint[], window: number) => {
    const pivots: PivotPoint[] = [];
    
    for (let i = window; i < data.length - window; i++) {
      const current = data[i];
      const leftPrice = data.slice(i - window, i).map(d => d.price);
      const rightPrice = data.slice(i + 1, i + window + 1).map(d => d.price);
      const leftEntropy = data.slice(i - window, i).map(d => d.avgEntropy);
      const rightEntropy = data.slice(i + 1, i + window + 1).map(d => d.avgEntropy);

      // Pivot High (price)
      const isPriceHigh = leftPrice.every(p => p < current.price) && 
                          rightPrice.every(p => p < current.price);
      
      // Pivot Low (price)
      const isPriceLow = leftPrice.every(p => p > current.price) && 
                         rightPrice.every(p => p > current.price);

      if (isPriceHigh) {
        pivots.push({
          timestamp: current.timestamp,
          price: current.price,
          entropy: current.avgEntropy,
          type: 'high'
        });
      }

      if (isPriceLow) {
        pivots.push({
          timestamp: current.timestamp,
          price: current.price,
          entropy: current.avgEntropy,
          type: 'low'
        });
      }
    }

    return pivots;
  }, []);

  // ============================================================================
  // DIVERGENCE DETECTION
  // ============================================================================

  const detectDivergences = useCallback((pivots: PivotPoint[]) => {
    const newDivergences: Divergence[] = [];

    // Look for consecutive pivots of the same type
    for (let i = 0; i < pivots.length - 1; i++) {
      const pivot1 = pivots[i];
      const pivot2 = pivots[i + 1];

      // Only compare same type pivots
      if (pivot1.type !== pivot2.type) continue;

      const priceChange = pivot2.price - pivot1.price;
      const entropyChange = pivot2.entropy - pivot1.entropy;

      let divergenceType: Divergence['type'] | null = null;
      let strength = 0;

      // Bullish Divergence: Price makes lower low, Entropy makes higher low
      if (pivot1.type === 'low' && priceChange < 0 && entropyChange > 0) {
        divergenceType = 'bullish';
        strength = Math.min(5, Math.floor((Math.abs(entropyChange) / Math.abs(priceChange)) * 100) + 1);
      }

      // Bearish Divergence: Price makes higher high, Entropy makes lower high
      if (pivot1.type === 'high' && priceChange > 0 && entropyChange < 0) {
        divergenceType = 'bearish';
        strength = Math.min(5, Math.floor((Math.abs(entropyChange) / Math.abs(priceChange)) * 100) + 1);
      }

      // Hidden Bullish: Price makes higher low, Entropy makes lower low
      if (pivot1.type === 'low' && priceChange > 0 && entropyChange < 0) {
        divergenceType = 'hidden_bullish';
        strength = Math.min(5, Math.floor((Math.abs(entropyChange) / Math.abs(priceChange)) * 50) + 1);
      }

      // Hidden Bearish: Price makes lower high, Entropy makes higher high
      if (pivot1.type === 'high' && priceChange < 0 && entropyChange > 0) {
        divergenceType = 'hidden_bearish';
        strength = Math.min(5, Math.floor((Math.abs(entropyChange) / Math.abs(priceChange)) * 50) + 1);
      }

      if (divergenceType && strength >= settingsRef.current.minStrength) {
        newDivergences.push({
          id: `div-${pivot2.timestamp}`,
          timestamp: pivot2.timestamp,
          type: divergenceType,
          strength,
          priceStart: pivot1.price,
          priceEnd: pivot2.price,
          entropyStart: pivot1.entropy,
          entropyEnd: pivot2.entropy,
          pivotStart: pivot1,
          pivotEnd: pivot2,
          status: 'pending'
        });
      }
    }

    return newDivergences;
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchData = useCallback(async () => {
    try {
      const [entropyRes, binanceRes] = await Promise.all([
        fetch('http://localhost:3300/api/entropy-rsi'),
        fetch('http://localhost:3300/api/binance/stats')
      ]);

      if (!entropyRes.ok || !binanceRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const entropyData = await entropyRes.json();
      const binanceData = await binanceRes.json();

      if (entropyData.success && entropyData.data && binanceData.success && binanceData.data) {
        const newPoint: HistoryPoint = {
          timestamp: Date.now(),
          price: binanceData.data.spotPrice,
          bidEntropy: entropyData.data.entropy.bid_entropy,
          askEntropy: entropyData.data.entropy.ask_entropy,
          avgEntropy: (entropyData.data.entropy.bid_entropy + entropyData.data.entropy.ask_entropy) / 2
        };

        setHistory(prev => {
          const updated = [...prev, newPoint];
          const trimmed = updated.slice(-200); // Keep last 200 points

          // Detect pivots and divergences
          if (trimmed.length >= settingsRef.current.pivotWindow * 2 + 1) {
            const pivots = findPivots(trimmed, settingsRef.current.pivotWindow);
            const newDivergences = detectDivergences(pivots);
            
            setDivergences(prevDiv => {
              const combined = [...prevDiv, ...newDivergences];
              // Remove duplicates by ID
              const unique = combined.filter((div, index, self) => 
                index === self.findIndex(d => d.id === div.id)
              );
              return unique.slice(-settingsRef.current.maxDivergences);
            });
          }

          return trimmed;
        });
      }

      setError(null);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Fetch error:', err);
      setLoading(false);
    }
  }, [findPivots, detectDivergences]);

  // Auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // ============================================================================
  // STATISTICS
  // ============================================================================

  const stats = {
    total: divergences.length,
    bullish: divergences.filter(d => d.type === 'bullish').length,
    bearish: divergences.filter(d => d.type === 'bearish').length,
    hiddenBullish: divergences.filter(d => d.type === 'hidden_bullish').length,
    hiddenBearish: divergences.filter(d => d.type === 'hidden_bearish').length,
    confirmed: divergences.filter(d => d.status === 'confirmed').length,
    pending: divergences.filter(d => d.status === 'pending').length,
    failed: divergences.filter(d => d.status === 'failed').length,
    avgStrength: divergences.length > 0 
      ? (divergences.reduce((sum, d) => sum + d.strength, 0) / divergences.length).toFixed(1)
      : '0'
  };

  // ============================================================================
  // CHART DATA
  // ============================================================================

  const chartData = history.slice(-100).map(point => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    price: point.price,
    entropy: point.avgEntropy
  }));

  // Filter divergences
  const filteredDivergences = selectedType === 'all' 
    ? divergences 
    : divergences.filter(d => d.type === selectedType);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-cyan-400 animate-pulse mx-auto mb-4" />
          <p className="text-slate-400">Loading divergence data...</p>
        </div>
      </div>
    );
  }

  if (error && history.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/entropy">
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">Entropy Divergences</h1>
            <p className="text-slate-400 text-sm mt-1">
              Price-Entropy divergence detection and analysis
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Divergence Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Pivot Window (bars)</label>
                <input
                  type="range"
                  min="5"
                  max="20"
                  value={settings.pivotWindow}
                  onChange={(e) => setSettings(prev => ({ ...prev, pivotWindow: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">{settings.pivotWindow} bars</p>
              </div>

              <div>
                <label className="text-sm text-slate-400">Minimum Strength</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={settings.minStrength}
                  onChange={(e) => setSettings(prev => ({ ...prev, minStrength: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">{settings.minStrength} / 5</p>
              </div>

              <div>
                <label className="text-sm text-slate-400">Confirmation Threshold (%)</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={settings.confirmationThreshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, confirmationThreshold: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">{settings.confirmationThreshold}%</p>
              </div>

              <div>
                <label className="text-sm text-slate-400">Max Divergences Stored</label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="10"
                  value={settings.maxDivergences}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxDivergences: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">{settings.maxDivergences} divergences</p>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <p className="text-slate-400 text-sm">Total Divergences</p>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-slate-400 text-sm">Bullish</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.bullish + stats.hiddenBullish}</p>
          <p className="text-xs text-slate-500">Regular: {stats.bullish} | Hidden: {stats.hiddenBullish}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <p className="text-slate-400 text-sm">Bearish</p>
          </div>
          <p className="text-2xl font-bold text-rose-400">{stats.bearish + stats.hiddenBearish}</p>
          <p className="text-xs text-slate-500">Regular: {stats.bearish} | Hidden: {stats.hiddenBearish}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-slate-400 text-sm">Avg Strength</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.avgStrength} / 5</p>
          <p className="text-xs text-slate-500">Pending: {stats.pending}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">
            📊 Price vs Entropy (Last 100 points)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData}>
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
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="entropy" 
                stroke="#10b981" 
                name="Avg Entropy"
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="price" 
                stroke="#3b82f6" 
                name="Spot Price"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Divergences Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100">Detected Divergences</h2>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-sm"
          >
            <option value="all">All Types</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="hidden_bullish">Hidden Bullish</option>
            <option value="hidden_bearish">Hidden Bearish</option>
          </select>
        </div>

        {filteredDivergences.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No divergences detected yet. Keep monitoring...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Time</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Type</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Strength</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Price Move</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Entropy Move</th>
                  <th className="text-left py-3 px-4 text-sm text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDivergences.slice(-20).reverse().map((div) => {
                  const typeConfig = {
                    bullish: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400', label: 'Bullish' },
                    bearish: { icon: <TrendingDown className="w-4 h-4" />, color: 'text-rose-400', label: 'Bearish' },
                    hidden_bullish: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-600', label: 'Hidden Bullish' },
                    hidden_bearish: { icon: <TrendingDown className="w-4 h-4" />, color: 'text-rose-600', label: 'Hidden Bearish' }
                  };

                  const config = typeConfig[div.type];
                  const priceMove = ((div.priceEnd - div.priceStart) / div.priceStart * 100).toFixed(2);
                  const entropyMove = ((div.entropyEnd - div.entropyStart) / div.entropyStart * 100).toFixed(2);

                  return (
                    <tr key={div.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-sm">
                        {new Date(div.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`flex items-center gap-2 ${config.color}`}>
                          {config.icon}
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div 
                              key={i}
                              className={`w-2 h-4 rounded ${
                                i < div.strength ? 'bg-amber-400' : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={priceMove.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'}>
                          {priceMove}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={entropyMove.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'}>
                          {entropyMove}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {div.status === 'pending' && (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">Pending</span>
                          </div>
                        )}
                        {div.status === 'confirmed' && (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm">Confirmed</span>
                          </div>
                        )}
                        {div.status === 'failed' && (
                          <div className="flex items-center gap-1 text-rose-400">
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm">Failed</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
