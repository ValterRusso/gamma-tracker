import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface VolSurfaceData {
  strikes: number[];
  dte: number[];
  points: Array<{
    strike: number;
    dte: number;
    moneyness: number;
    callIV: number | null;
    putIV: number | null;
    avgIV: number | null;
  }>;
  stats: {
    totalPoints: number;
    strikeCount: number;
    expiryCount: number;
    minIV: number;
    maxIV: number;
  };
  spotPrice: number;
}

interface ApiResponse {
  success: boolean;
  data?: VolSurfaceData;
  error?: string;
}

interface SkewDataPoint {
  strike: number;
  moneyness: number;
  callIV: number | null;
  putIV: number | null;
  avgIV: number | null;
  spread: number | null; // Put IV - Call IV
}

export default function VolatilitySkew() {
  const [data, setData] = useState<VolSurfaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDTE, setSelectedDTE] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3300/api/vol-surface');
      const result: ApiResponse = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
        // Auto-select first DTE
        if (!selectedDTE && result.data.dte.length > 0) {
          setSelectedDTE(result.data.dte[0]);
        }
        setError(null);
      } else {
        setError(result.error || 'Erro ao carregar dados');
      }
    } catch (err) {
      setError('Erro de conexão com o backend');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando volatility skew...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
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

  // Get skew data for selected DTE
  const getSkewData = (): SkewDataPoint[] => {
    if (!selectedDTE) return [];
    
    const points = data.points
      .filter(p => p.dte === selectedDTE)
      .sort((a, b) => a.strike - b.strike)
      .map(p => ({
        strike: p.strike,
        moneyness: p.moneyness,
        callIV: p.callIV ? p.callIV * 100 : null,
        putIV: p.putIV ? p.putIV * 100 : null,
        avgIV: p.avgIV ? p.avgIV * 100 : null,
        spread: (p.putIV && p.callIV) ? (p.putIV - p.callIV) * 100 : null
      }));
    
    return points;
  };

  const skewData = getSkewData();
  
  // Calculate skew metrics
  const calculateSkewMetrics = () => {
    if (skewData.length === 0) return null;
    
    const atmPoint = skewData.reduce((prev, curr) => 
      Math.abs(curr.moneyness - 100) < Math.abs(prev.moneyness - 100) ? curr : prev
    );
    
    const otmPuts = skewData.filter(p => p.moneyness < 95 && p.putIV);
    const otmCalls = skewData.filter(p => p.moneyness > 105 && p.callIV);
    
    const avgPutIV = otmPuts.length > 0 
      ? otmPuts.reduce((sum, p) => sum + (p.putIV || 0), 0) / otmPuts.length 
      : null;
    
    const avgCallIV = otmCalls.length > 0
      ? otmCalls.reduce((sum, p) => sum + (p.callIV || 0), 0) / otmCalls.length
      : null;
    
    const skewRatio = (avgPutIV && avgCallIV) ? avgPutIV / avgCallIV : null;
    
    return {
      atmIV: atmPoint.avgIV,
      atmStrike: atmPoint.strike,
      avgPutIV,
      avgCallIV,
      skewRatio,
      putCallSpread: (avgPutIV && avgCallIV) ? avgPutIV - avgCallIV : null
    };
  };

  const metrics = calculateSkewMetrics();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 font-semibold mb-2">
            Strike: ${data.strike.toLocaleString()}
          </p>
          <p className="text-slate-400 text-sm mb-2">
            Moneyness: {data.moneyness.toFixed(1)}%
          </p>
          {data.callIV && (
            <p className="text-cyan-400 text-sm">
              Call IV: {data.callIV.toFixed(2)}%
            </p>
          )}
          {data.putIV && (
            <p className="text-rose-400 text-sm">
              Put IV: {data.putIV.toFixed(2)}%
            </p>
          )}
          {data.avgIV && (
            <p className="text-emerald-400 text-sm">
              Avg IV: {data.avgIV.toFixed(2)}%
            </p>
          )}
          {data.spread !== null && (
            <p className="text-amber-400 text-sm mt-1 pt-1 border-t border-slate-700">
              P-C Spread: {data.spread > 0 ? '+' : ''}{data.spread.toFixed(2)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/volatility-surface">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Back to 3D Surface</span>
            </button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          Volatility Skew Analysis
        </h1>
        <p className="text-slate-400">
          2D view of implied volatility structure by strike for selected expiry
        </p>
      </div>

      {/* Expiry Selector */}
      <div className="mb-6">
        <label className="block text-slate-300 font-medium mb-3">Select Expiry (DTE)</label>
        <div className="flex flex-wrap gap-2">
          {data.dte.map(dte => (
            <button
              key={dte}
              onClick={() => setSelectedDTE(dte)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDTE === dte
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {dte} days
            </button>
          ))}
        </div>
      </div>

      {/* Skew Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">ATM IV</p>
            <p className="text-2xl font-bold text-emerald-400">
              {metrics.atmIV?.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">
              @ ${metrics.atmStrike.toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              OTM Put IV
            </p>
            <p className="text-2xl font-bold text-rose-400">
              {metrics.avgPutIV?.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              OTM Call IV
            </p>
            <p className="text-2xl font-bold text-cyan-400">
              {metrics.avgCallIV?.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Skew Ratio</p>
            <p className="text-2xl font-bold text-amber-400">
              {metrics.skewRatio?.toFixed(2)}x
            </p>
            <p className="text-xs text-slate-500 mt-1">Put/Call</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">P-C Spread</p>
            <p className={`text-2xl font-bold ${
              (metrics.putCallSpread || 0) > 0 ? 'text-rose-400' : 'text-cyan-400'
            }`}>
              {metrics.putCallSpread && metrics.putCallSpread > 0 ? '+' : ''}
              {metrics.putCallSpread?.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Skew Chart */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-4">
          IV Skew Curve - {selectedDTE} DTE
        </h2>
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={skewData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="moneyness" 
              stroke="#94a3b8"
              label={{ value: 'Moneyness (% of Spot)', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            />
            <YAxis 
              stroke="#94a3b8"
              label={{ value: 'Implied Volatility (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <ReferenceLine 
              x={100} 
              stroke="#64748b" 
              strokeDasharray="5 5" 
              label={{ value: 'ATM', fill: '#64748b', fontSize: 12 }}
            />
            <Line 
              type="monotone" 
              dataKey="callIV" 
              stroke="#06b6d4" 
              strokeWidth={2.5}
              dot={{ fill: '#06b6d4', r: 3 }}
              name="Call IV"
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="putIV" 
              stroke="#f43f5e" 
              strokeWidth={2.5}
              dot={{ fill: '#f43f5e', r: 3 }}
              name="Put IV"
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="avgIV" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 2 }}
              name="Avg IV"
              strokeDasharray="5 5"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Spread Chart */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-4">
          Put-Call IV Spread
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={skewData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="moneyness" 
              stroke="#94a3b8"
              label={{ value: 'Moneyness (% of Spot)', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            />
            <YAxis 
              stroke="#94a3b8"
              label={{ value: 'IV Spread (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
            <ReferenceLine 
              x={100} 
              stroke="#64748b" 
              strokeDasharray="5 5" 
              label={{ value: 'ATM', fill: '#64748b', fontSize: 12 }}
            />
            <Line 
              type="monotone" 
              dataKey="spread" 
              stroke="#f59e0b" 
              strokeWidth={2.5}
              dot={{ fill: '#f59e0b', r: 3 }}
              name="Put IV - Call IV"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}