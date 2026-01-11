/**
 * EntropyHistory.tsx - Historical Entropy Analysis
 * 
 * Long-term entropy analysis with date range selection, statistics,
 * event timeline, and CSV export functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { 
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  ArrowLeft, Calendar, Download, TrendingUp, TrendingDown, 
  Activity, AlertCircle, Filter
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface HistoricalDataPoint {
  timestamp: number;
  bid_entropy: number;
  ask_entropy: number;
  avg_entropy: number;
  price: number;
  volume: number;
}

interface EventRecord {
  timestamp: number;
  type: string;
  bid_entropy: number;
  ask_entropy: number;
  confidence: number;
  signal: string;
}

interface PeriodStats {
  min_entropy: number;
  max_entropy: number;
  avg_entropy: number;
  std_dev: number;
  event_count: number;
  volatility: number;
}

type TimeRange = '24h' | '7d' | '30d' | 'custom';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EntropyHistory() {
  // State
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchHistoricalData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[History] Fetching historical data for range:', timeRange);

      // Calculate time range
      const now = Date.now();
      let startTime = now;
      
      switch (timeRange) {
        case '24h':
          startTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          startTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            startTime = new Date(customStartDate).getTime();
          }
          break;
      }

      // Fetch entropy history
      const entropyRes = await fetch(`http://localhost:3300/api/entropy/history?limit=1000`);
      const entropyData = await entropyRes.json();

      // Fetch events
      const eventsRes = await fetch(`http://localhost:3300/api/entropy/events?limit=100`);
      const eventsData = await eventsRes.json();

      if (entropyData.success && entropyData.data) {
        // Filter by time range
        const filtered = entropyData.data.history
          .filter((point: any) => point.timestamp >= startTime)
          .map((point: any) => ({
            timestamp: point.timestamp,
            bid_entropy: point.bid_entropy,
            ask_entropy: point.ask_entropy,
            avg_entropy: (point.bid_entropy + point.ask_entropy) / 2,
            price: point.price || 0,
            volume: point.volume || 0
          }));

        setHistoricalData(filtered);
      }

      if (eventsData.success && eventsData.data) {
        const filteredEvents = eventsData.data
          .filter((event: any) => event.timestamp >= startTime);
        setEvents(filteredEvents);
      }

      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('[History] Fetch error:', err);
      setError('Failed to fetch historical data');
      toast.error('Failed to fetch historical data');
      setLoading(false);
    }
  }, [timeRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  // ============================================================================
  // STATISTICS CALCULATION
  // ============================================================================

  const calculateStats = (): PeriodStats => {
    if (historicalData.length === 0) {
      return {
        min_entropy: 0,
        max_entropy: 0,
        avg_entropy: 0,
        std_dev: 0,
        event_count: events.length,
        volatility: 0
      };
    }

    const entropies = historicalData.map(d => d.avg_entropy);
    const min_entropy = Math.min(...entropies);
    const max_entropy = Math.max(...entropies);
    const avg_entropy = entropies.reduce((sum, e) => sum + e, 0) / entropies.length;

    // Standard deviation
    const variance = entropies.reduce((sum, e) => sum + Math.pow(e - avg_entropy, 2), 0) / entropies.length;
    const std_dev = Math.sqrt(variance);

    // Volatility (coefficient of variation)
    const volatility = avg_entropy > 0 ? (std_dev / avg_entropy) * 100 : 0;

    return {
      min_entropy,
      max_entropy,
      avg_entropy,
      std_dev,
      event_count: events.length,
      volatility
    };
  };

  const stats = calculateStats();

  // ============================================================================
  // EXPORT FUNCTIONALITY
  // ============================================================================

  const exportToCSV = () => {
    try {
      // CSV header
      const header = 'Timestamp,Date,Bid Entropy,Ask Entropy,Avg Entropy,Price,Volume\n';
      
      // CSV rows
      const rows = historicalData.map(point => {
        const date = new Date(point.timestamp).toISOString();
        return `${point.timestamp},${date},${point.bid_entropy},${point.ask_entropy},${point.avg_entropy},${point.price},${point.volume}`;
      }).join('\n');

      const csv = header + rows;

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entropy_history_${timeRange}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('CSV exported successfully!');
    } catch (err) {
      console.error('[History] Export error:', err);
      toast.error('Failed to export CSV');
    }
  };

  // ============================================================================
  // FILTERED EVENTS
  // ============================================================================

  const filteredEvents = eventFilter === 'all' 
    ? events 
    : events.filter(e => e.type.toLowerCase().includes(eventFilter.toLowerCase()));

  // ============================================================================
  // CHART DATA
  // ============================================================================

  const chartData = historicalData.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    'Bid Entropy': point.bid_entropy.toFixed(2),
    'Ask Entropy': point.ask_entropy.toFixed(2),
    'Avg Entropy': point.avg_entropy.toFixed(2)
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading historical data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchHistoricalData}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/entropy/overview">
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Entropy History</h1>
            <p className="text-slate-400">Long-term entropy analysis and trends</p>
          </div>
        </div>

        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 bg-slate-900 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Calendar className="w-5 h-5 text-cyan-400" />
          <span className="text-slate-400">Time Range:</span>
          
          {(['24h', '7d', '30d', 'custom'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {range === '24h' ? 'Last 24 Hours' :
               range === '7d' ? 'Last 7 Days' :
               range === '30d' ? 'Last 30 Days' :
               'Custom Range'}
            </button>
          ))}

          {timeRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-slate-800 rounded-lg text-white"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-slate-800 rounded-lg text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400 text-sm">Min Entropy</span>
          </div>
          <p className="text-2xl font-bold">{stats.min_entropy.toFixed(2)}</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 text-sm">Max Entropy</span>
          </div>
          <p className="text-2xl font-bold">{stats.max_entropy.toFixed(2)}</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 text-sm">Avg Entropy</span>
          </div>
          <p className="text-2xl font-bold">{stats.avg_entropy.toFixed(2)}</p>
          <p className="text-sm text-slate-400">±{stats.std_dev.toFixed(2)}</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400 text-sm">Events</span>
          </div>
          <p className="text-2xl font-bold">{stats.event_count}</p>
          <p className="text-sm text-slate-400">Volatility: {stats.volatility.toFixed(1)}%</p>
        </div>
      </div>

      {/* Historical Chart */}
      <div className="bg-slate-900 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Entropy Evolution</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="time" 
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8' }}
            />
            <YAxis 
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8' }}
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
              type="monotone" 
              dataKey="Bid Entropy" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="Ask Entropy" 
              stroke="#f43f5e" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="Avg Entropy" 
              stroke="#06b6d4" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Events Timeline */}
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Event Timeline</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-1 bg-slate-800 rounded-lg text-white"
            >
              <option value="all">All Events</option>
              <option value="collapse">Collapse</option>
              <option value="spike">Spike</option>
              <option value="squeeze">Squeeze</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No events in this period</p>
          ) : (
            filteredEvents.map((event, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    event.type.includes('COLLAPSE') ? 'bg-red-400' :
                    event.type.includes('SPIKE') ? 'bg-emerald-400' :
                    'bg-amber-400'
                  }`} />
                  <div>
                    <p className="font-medium">{event.type.replace('_', ' ')}</p>
                    <p className="text-sm text-slate-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Confidence</p>
                  <p className="font-medium">{(event.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
