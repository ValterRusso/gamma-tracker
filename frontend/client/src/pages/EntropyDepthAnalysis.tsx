/**
 * EntropyDepthAnalysis.tsx - Multi-Depth Orderbook Entropy Analysis
 * 
 * Visualizes how entropy changes across different orderbook depths.
 * Helps identify optimal depth levels and liquidity patterns.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'wouter';
import { 
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';
import { ArrowLeft, Settings, Activity, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface DepthSnapshot {
  timestamp: number;
  depths: {
    [key: number]: {
      bid_entropy: number;
      ask_entropy: number;
      avg_entropy: number;
      bid_liquidity: number;
      ask_liquidity: number;
    };
  };
}

interface DepthSettings {
  depths: number[]; // Which depths to track (e.g., [5, 10, 20, 50])
  updateInterval: number; // Seconds between updates
  maxSnapshots: number; // Max historical snapshots
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EntropyDepthAnalysis() {
  // State
  const [snapshots, setSnapshots] = useState<DepthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState<number>(20);
  
  const [settings, setSettings] = useState<DepthSettings>(() => {
    try {
      const saved = localStorage.getItem('depthAnalysisSettings');
      return saved ? JSON.parse(saved) : {
        depths: [5, 10, 20, 50],
        updateInterval: 30,
        maxSnapshots: 100
      };
    } catch {
      return {
        depths: [5, 10, 20, 50],
        updateInterval: 30,
        maxSnapshots: 100
      };
    }
  });

  // Refs for stable references
  const snapshotsRef = useRef<DepthSnapshot[]>([]);
  const settingsRef = useRef<DepthSettings>(settings);

  // Update refs when state changes
  useEffect(() => {
    snapshotsRef.current = snapshots;
  }, [snapshots]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('depthAnalysisSettings', JSON.stringify(settings));
  }, [settings]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchDepthData = useCallback(async () => {
    try {
      console.log('[DepthAnalysis] Fetching data for depths:', settingsRef.current.depths);

      // Fetch entropy data for each depth
      const depthPromises = settingsRef.current.depths.map(async (depth) => {
        const res = await fetch(`http://localhost:3300/api/entropy?depth=${depth}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          return {
            depth,
            bid_entropy: data.data.entropy.bid_entropy,
            ask_entropy: data.data.entropy.ask_entropy,
            avg_entropy: (data.data.entropy.bid_entropy + data.data.entropy.ask_entropy) / 2,
            bid_liquidity: data.data.entropy.bid_liquidity || 0,
            ask_liquidity: data.data.entropy.ask_liquidity || 0
          };
        }
        return null;
      });

      const results = await Promise.all(depthPromises);
      const validResults = results.filter(r => r !== null);

      if (validResults.length > 0) {
        const snapshot: DepthSnapshot = {
          timestamp: Date.now(),
          depths: {}
        };

        validResults.forEach(result => {
          if (result) {
            snapshot.depths[result.depth] = {
              bid_entropy: result.bid_entropy,
              ask_entropy: result.ask_entropy,
              avg_entropy: result.avg_entropy,
              bid_liquidity: result.bid_liquidity,
              ask_liquidity: result.ask_liquidity
            };
          }
        });

        setSnapshots(prev => {
          const updated = [...prev, snapshot];
          return updated.slice(-settingsRef.current.maxSnapshots);
        });

        setError(null);
      }

      setLoading(false);
    } catch (err) {
      console.error('[DepthAnalysis] Fetch error:', err);
      setError('Failed to fetch depth data');
      toast.error('Failed to fetch depth data');
      setLoading(false);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchDepthData();
    const interval = setInterval(fetchDepthData, settings.updateInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchDepthData, settings.updateInterval]);

  // ============================================================================
  // DATA PROCESSING
  // ============================================================================

  // Latest snapshot
  const latestSnapshot = snapshots[snapshots.length - 1];

  // Current depth stats
  const currentStats = latestSnapshot ? {
    bid_entropy: latestSnapshot.depths[selectedDepth]?.bid_entropy || 0,
    ask_entropy: latestSnapshot.depths[selectedDepth]?.ask_entropy || 0,
    avg_entropy: latestSnapshot.depths[selectedDepth]?.avg_entropy || 0,
    bid_liquidity: latestSnapshot.depths[selectedDepth]?.bid_liquidity || 0,
    ask_liquidity: latestSnapshot.depths[selectedDepth]?.ask_liquidity || 0
  } : null;

  // Depth comparison (latest snapshot)
  const depthComparison = latestSnapshot ? settings.depths.map(depth => ({
    depth: `${depth} levels`,
    bid_entropy: latestSnapshot.depths[depth]?.bid_entropy || 0,
    ask_entropy: latestSnapshot.depths[depth]?.ask_entropy || 0,
    avg_entropy: latestSnapshot.depths[depth]?.avg_entropy || 0
  })) : [];

  // Time series for selected depth
  const timeSeries = snapshots.map(snap => ({
    time: new Date(snap.timestamp).toLocaleTimeString(),
    bid_entropy: snap.depths[selectedDepth]?.bid_entropy || 0,
    ask_entropy: snap.depths[selectedDepth]?.ask_entropy || 0,
    avg_entropy: snap.depths[selectedDepth]?.avg_entropy || 0
  }));

  // Liquidity comparison
  const liquidityComparison = latestSnapshot ? settings.depths.map(depth => ({
    depth: `${depth} levels`,
    bid_liquidity: latestSnapshot.depths[depth]?.bid_liquidity || 0,
    ask_liquidity: latestSnapshot.depths[depth]?.ask_liquidity || 0
  })) : [];

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && snapshots.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading depth analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/entropy">
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">Depth Analysis</h1>
            <p className="text-slate-400 text-sm mt-1">
              Multi-depth orderbook entropy visualization
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Update Interval (seconds)</label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="10"
                  value={settings.updateInterval}
                  onChange={(e) => setSettings(prev => ({ ...prev, updateInterval: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">{settings.updateInterval}s</p>
              </div>

              <div>
                <label className="text-sm text-slate-400">Max Snapshots</label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={settings.maxSnapshots}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxSnapshots: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">{settings.maxSnapshots} snapshots</p>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Tracked Depths</label>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 15, 20, 25, 30, 50, 100].map(depth => (
                    <button
                      key={depth}
                      onClick={() => {
                        setSettings(prev => ({
                          ...prev,
                          depths: prev.depths.includes(depth)
                            ? prev.depths.filter(d => d !== depth)
                            : [...prev.depths, depth].sort((a, b) => a - b)
                        }));
                      }}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        settings.depths.includes(depth)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Depth Selector */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm text-slate-400">Selected Depth:</label>
          <div className="flex gap-2">
            {settings.depths.map(depth => (
              <button
                key={depth}
                onClick={() => setSelectedDepth(depth)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDepth === depth
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {depth} levels
              </button>
            ))}
          </div>
        </div>

        {/* Current Stats Cards */}
        {currentStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-slate-400 text-sm">Bid Entropy</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {currentStats.bid_entropy.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <p className="text-slate-400 text-sm">Ask Entropy</p>
              </div>
              <p className="text-2xl font-bold text-rose-400">
                {currentStats.ask_entropy.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <p className="text-slate-400 text-sm">Avg Entropy</p>
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {currentStats.avg_entropy.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <p className="text-slate-400 text-sm">Total Liquidity</p>
              </div>
              <p className="text-2xl font-bold text-purple-400">
                ${((currentStats.bid_liquidity + currentStats.ask_liquidity) / 1000).toFixed(1)}K
              </p>
            </div>
          </div>
        )}

        {/* Time Series Chart */}
        {timeSeries.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">
              Entropy Over Time ({selectedDepth} levels)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeries.slice(-50)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bid_entropy"
                  stroke="#10b981"
                  name="Bid Entropy"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ask_entropy"
                  stroke="#f43f5e"
                  name="Ask Entropy"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="avg_entropy"
                  stroke="#06b6d4"
                  name="Avg Entropy"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Depth Comparison Chart */}
        {depthComparison.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Entropy by Depth (Current)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={depthComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="depth" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                />
                <Legend />
                <Bar dataKey="bid_entropy" fill="#10b981" name="Bid Entropy" />
                <Bar dataKey="ask_entropy" fill="#f43f5e" name="Ask Entropy" />
                <Bar dataKey="avg_entropy" fill="#06b6d4" name="Avg Entropy" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Liquidity Comparison */}
        {liquidityComparison.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Liquidity by Depth (Current)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={liquidityComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="depth" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value: number) => `$${(value / 1000).toFixed(1)}K`}
                />
                <Legend />
                <Bar dataKey="bid_liquidity" fill="#10b981" name="Bid Liquidity" />
                <Bar dataKey="ask_liquidity" fill="#f43f5e" name="Ask Liquidity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-rose-900/20 border border-rose-800 rounded-lg p-4 mb-6">
            <p className="text-rose-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
