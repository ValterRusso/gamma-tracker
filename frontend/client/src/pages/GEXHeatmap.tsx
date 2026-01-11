/**
 * GEXHeatmap.tsx - SpotGamma-style GEX Heatmap Visualization
 * 
 * Features:
 * - Heatmap: GEX by strike + time with color gradient
 * - Strike Panel: Horizontal bars showing GEX by strike
 * - Time Slider: Navigate through historical snapshots
 * - Model Toggle: Gamma / Delta Pressure / Charm Pressure
 * 
 * Inspired by SpotGamma TRACE interface
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { 
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ScatterChart, Scatter
} from 'recharts';
import { 
  ArrowLeft, Clock, Layers, TrendingUp, Activity,
  Settings, Play, Pause, SkipBack, SkipForward
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface GEXDataPoint {
  timestamp: number;
  strike: number;
  totalGex: number;
  callGex: number;
  putGex: number;
  callOi: number;
  putOi: number;
  totalOi: number;
  spotPrice: number;
}

interface HeatmapSettings {
  timeframe: '1h' | '4h' | '1d' | '7d';
  model: 'gamma' | 'delta' | 'charm';
  colorScheme: 'purple' | 'blue' | 'green';
  showPrice: boolean;
  autoPlay: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GEXHeatmap() {
  // State
  const [heatmapData, setHeatmapData] = useState<GEXDataPoint[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [playing, setPlaying] = useState(false);
  
  const [settings, setSettings] = useState<HeatmapSettings>(() => {
    try {
      const saved = localStorage.getItem('gexHeatmapSettings');
      return saved ? JSON.parse(saved) : {
        timeframe: '1h',
        model: 'gamma',
        colorScheme: 'purple',
        showPrice: true,
        autoPlay: false
      };
    } catch {
      return {
        timeframe: '1h',
        model: 'gamma',
        colorScheme: 'purple',
        showPrice: true,
        autoPlay: false
      };
    }
  });

  // Save settings
  useEffect(() => {
    localStorage.setItem('gexHeatmapSettings', JSON.stringify(settings));
  }, [settings]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchHeatmapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[GEXHeatmap] Fetching data for timeframe:', settings.timeframe);

      // Fetch heatmap data
      const heatmapRes = await fetch(
        `http://localhost:3300/api/gex/heatmap?timeframe=${settings.timeframe}`
      );
      const heatmapResponse = await heatmapRes.json();

      if (!heatmapResponse.success) {
        throw new Error(heatmapResponse.error || 'Failed to fetch heatmap data');
      }

      // Fetch timestamps
      const timestampsRes = await fetch(
        `http://localhost:3300/api/gex/timestamps?timeframe=${settings.timeframe}`
      );
      const timestampsResponse = await timestampsRes.json();

      if (!timestampsResponse.success) {
        throw new Error(timestampsResponse.error || 'Failed to fetch timestamps');
      }

      const data = heatmapResponse.data.heatmap || [];
      const times = timestampsResponse.data.timestamps || [];

      setHeatmapData(data);
      setTimestamps(times);

      // Set current timestamp to latest
      if (times.length > 0) {
        setCurrentTimestamp(times[times.length - 1]);
      }

      setLoading(false);
      console.log('[GEXHeatmap] Data loaded:', data.length, 'points,', times.length, 'timestamps');

    } catch (err: any) {
      console.error('[GEXHeatmap] Fetch error:', err);
      setError(err.message);
      setLoading(false);
      toast.error('Failed to load heatmap data');
    }
  }, [settings.timeframe]);

  // Initial fetch
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHeatmapData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchHeatmapData]);

  // ============================================================================
  // TIME SLIDER CONTROLS
  // ============================================================================

  const handleTimestampChange = (index: number) => {
    if (timestamps[index]) {
      setCurrentTimestamp(timestamps[index]);
    }
  };

  const handlePrevious = () => {
    const currentIndex = timestamps.indexOf(currentTimestamp!);
    if (currentIndex > 0) {
      setCurrentTimestamp(timestamps[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    const currentIndex = timestamps.indexOf(currentTimestamp!);
    if (currentIndex < timestamps.length - 1) {
      setCurrentTimestamp(timestamps[currentIndex + 1]);
    }
  };

  const togglePlayPause = () => {
    setPlaying(!playing);
  };

  // Auto-play animation
  useEffect(() => {
    if (!playing || timestamps.length === 0) return;

    const interval = setInterval(() => {
      const currentIndex = timestamps.indexOf(currentTimestamp!);
      if (currentIndex < timestamps.length - 1) {
        setCurrentTimestamp(timestamps[currentIndex + 1]);
      } else {
        // Loop back to start
        setCurrentTimestamp(timestamps[0]);
      }
    }, 1000); // 1 second per frame

    return () => clearInterval(interval);
  }, [playing, currentTimestamp, timestamps]);

  // ============================================================================
  // DATA PROCESSING
  // ============================================================================

  // Get current snapshot data
  const currentData = heatmapData.filter(d => d.timestamp === currentTimestamp);

  // Get strike panel data (aggregate across time)
  const strikePanelData = currentData.reduce((acc, point) => {
    const existing = acc.find(d => d.strike === point.strike);
    if (existing) {
      existing.totalGex += point.totalGex;
      existing.callGex += point.callGex;
      existing.putGex += point.putGex;
    } else {
      acc.push({
        strike: point.strike,
        totalGex: point.totalGex,
        callGex: point.callGex,
        putGex: point.putGex,
        totalOi: point.totalOi
      });
    }
    return acc;
  }, [] as any[]).sort((a, b) => b.strike - a.strike); // Sort descending

  // Get spot price from current data
  const spotPrice = currentData.length > 0 ? currentData[0].spotPrice : null;

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && heatmapData.length === 0) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Activity className="w-12 h-12 text-purple-400 animate-pulse mx-auto mb-4" />
              <p className="text-slate-400">Loading GEX Heatmap...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <p className="text-red-400">Error: {error}</p>
            <button
              onClick={fetchHeatmapData}
              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-450 mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Layers className="w-8 h-8 text-purple-400" />
                GEX Heatmap
              </h1>
              <p className="text-slate-400 mt-1">
                SpotGamma-style visualization • {timestamps.length} snapshots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timeframe Selector */}
            <select
              value={settings.timeframe}
              onChange={(e) => setSettings({ ...settings, timeframe: e.target.value as any })}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            >
              <option value="1h">1 Hour</option>
              <option value="4h">4 Hours</option>
              <option value="1d">1 Day</option>
              <option value="7d">7 Days</option>
            </select>

            {/* Model Selector */}
            <select
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value as any })}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
            >
              <option value="gamma">Gamma</option>
              <option value="delta">Delta Pressure</option>
              <option value="charm">Charm Pressure</option>
            </select>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-[300px_1fr] gap-6">
          
          {/* Strike Panel (Left) */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">GEX by Strike</h3>
            
            {strikePanelData.length > 0 ? (
              <div className="space-y-2">
                {strikePanelData.slice(0, 20).map((strike) => (
                  <div key={strike.strike} className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 w-20">${strike.strike.toFixed(0)}</span>
                    <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-purple-500 to-pink-500"
                        style={{
                          width: `${Math.min(100, Math.abs(strike.totalGex) / 1000000)}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-16 text-right">
                      {(strike.totalGex / 1000000).toFixed(1)}M
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No data available</p>
            )}

            {spotPrice && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Spot Price</span>
                  <span className="text-lg font-semibold text-green-400">
                    ${spotPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Heatmap (Right) */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Heatmap Visualization
              {currentTimestamp && (
                <span className="text-sm text-slate-400 ml-3">
                  {new Date(currentTimestamp).toLocaleString()}
                </span>
              )}
            </h3>
            
            <div className="h-125 flex items-center justify-center border border-white/5 rounded-lg">
              <p className="text-slate-500">Heatmap visualization coming soon...</p>
            </div>
          </div>
        </div>

        {/* Time Slider */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevious}
              disabled={timestamps.indexOf(currentTimestamp!) === 0}
              className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-5 h-5 text-slate-400" />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-2 hover:bg-white/5 rounded-lg"
            >
              {playing ? (
                <Pause className="w-5 h-5 text-purple-400" />
              ) : (
                <Play className="w-5 h-5 text-purple-400" />
              )}
            </button>

            <button
              onClick={handleNext}
              disabled={timestamps.indexOf(currentTimestamp!) === timestamps.length - 1}
              className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-5 h-5 text-slate-400" />
            </button>

            <input
              type="range"
              min={0}
              max={timestamps.length - 1}
              value={timestamps.indexOf(currentTimestamp!)}
              onChange={(e) => handleTimestampChange(parseInt(e.target.value))}
              className="flex-1"
            />

            <span className="text-sm text-slate-400">
              {timestamps.indexOf(currentTimestamp!) + 1} / {timestamps.length}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
