import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

interface VolSurfaceData {
  strikes: number[];
  dte: number[];
  expiries: number[];
  spotPrice: number;
  atmStrike: number;
  atmIV: number;
  skew: {
    putSkew: number | null;
    callSkew: number | null;
    totalSkew: number | null;
  };
  iv: (number | null)[][];
  callIV: (number | null)[][];
  putIV: (number | null)[][];
  stats: {
    totalPoints: number;
    strikeCount: number;
    expiryCount: number;
    minIV: number;
    maxIV: number;
  };
}

interface ApiResponse {
  success: boolean;
  data?: VolSurfaceData;
  error?: string;
}

export default function VolatilitySurface() {
  const [data, setData] = useState<VolSurfaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surfaceType, setSurfaceType] = useState<'avg' | 'call' | 'put'>('avg');

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3300/api/vol-surface');
      const result: ApiResponse = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Erro ao carregar dados');
      }
    } catch (err) {
      setError('Erro de conexão com API');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Carregando superfície de volatilidade...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400 text-xl">{error || 'Dados não disponíveis'}</div>
      </div>
    );
  }

  // Preparar dados para o gráfico 3D
  const getSurfaceData = () => {
    switch (surfaceType) {
      case 'call':
        return data.callIV;
      case 'put':
        return data.putIV;
      default:
        return data.iv;
    }
  };

  // Converter strikes para moneyness (% do spot)
  const moneyness = data.strikes.map(strike => (strike / data.spotPrice) * 100);

  const plotData = [
    {
      type: 'surface' as const,
      x: moneyness, // Moneyness (% do spot)
      y: data.dte, // Days to Expiration
      z: getSurfaceData(), // IV matrix
      colorscale: [
        [0, '#1e293b'],      // slate-900
        [0.2, '#334155'],    // slate-700
        [0.4, '#3b82f6'],    // blue-500
        [0.6, '#22c55e'],    // green-500
        [0.8, '#eab308'],    // yellow-500
        [1, '#ef4444']       // red-500
      ] as any,
      colorbar: {
        title: { text: 'IV' },
        titleside: 'right',
        tickformat: '.1%',
        thickness: 20,
        len: 0.7,
        bgcolor: 'rgba(15, 23, 42, 0.8)',
        bordercolor: '#334155',
        borderwidth: 1,
        tickfont: { color: '#94a3b8', size: 11 }
      },
      hovertemplate: 
        '<b>Moneyness:</b> %{x:.1f}%<br>' +
        '<b>DTE:</b> %{y} days<br>' +
        '<b>IV:</b> %{z:.2%}<br>' +
        '<extra></extra>'
    }
  ];

  const layout = {
    title: {
      text: `Superfície de Volatilidade Implícita (${surfaceType.toUpperCase()})`,
      font: { color: '#e2e8f0', size: 20, family: 'Inter, sans-serif' },
      x: 0.5,
      xanchor: 'center' as const
    },
    scene: {
      xaxis: {
        title: { text: 'Moneyness (% Spot)' },
        titlefont: { color: '#94a3b8', size: 13 },
        tickfont: { color: '#64748b', size: 10 },
        gridcolor: '#1e293b',
        showbackground: true,
        backgroundcolor: '#0f172a'
      },
      yaxis: {
        title: { text: 'Days to Expiration' },
        titlefont: { color: '#94a3b8', size: 13 },
        tickfont: { color: '#64748b', size: 10 },
        gridcolor: '#1e293b',
        showbackground: true,
        backgroundcolor: '#0f172a'
      },
      zaxis: {
        title: { text: 'Implied Volatility' },
        titlefont: { color: '#94a3b8', size: 13 },
        tickfont: { color: '#64748b', size: 10 },
        tickformat: '.0%',
        gridcolor: '#1e293b',
        showbackground: true,
        backgroundcolor: '#0f172a'
      },
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.3 }
      },
      bgcolor: '#020617'
    },
    paper_bgcolor: '#020617',
    plot_bgcolor: '#020617',
    margin: { l: 0, r: 0, t: 60, b: 0 },
    autosize: true,
    hovermode: 'closest' as const
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['toImage' as const, 'sendDataToCloud' as const, 'lasso2d' as const, 'select2d' as const]
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Back to Gamma</span>
            </button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          Superfície de Volatilidade Implícita
        </h1>
        <p className="text-slate-400">
          Visualização 3D da estrutura de volatilidade por strike e vencimento
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Spot Price</div>
          <div className="text-slate-100 text-xl font-bold">
            ${data.spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">ATM IV</div>
          <div className="text-blue-400 text-xl font-bold">
            {data.atmIV ? (data.atmIV * 100).toFixed(1) + '%' : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">IV Range</div>
          <div className="text-slate-100 text-xl font-bold">
            {(data.stats.minIV * 100).toFixed(0)}% - {(data.stats.maxIV * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Put Skew</div>
          <div className={`text-xl font-bold ${
            data.skew.putSkew && data.skew.putSkew > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {data.skew.putSkew ? (data.skew.putSkew * 100).toFixed(1) + '%' : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Data Points</div>
          <div className="text-slate-100 text-xl font-bold">
            {data.stats.totalPoints}
          </div>
        </div>
      </div>

      {/* Surface Type Selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSurfaceType('avg')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            surfaceType === 'avg'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Average IV
        </button>
        <button
          onClick={() => setSurfaceType('call')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            surfaceType === 'call'
              ? 'bg-green-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Call IV
        </button>
        <button
          onClick={() => setSurfaceType('put')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            surfaceType === 'put'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Put IV
        </button>
      </div>

      {/* 3D Surface Plot */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '700px' }}
        />
      </div>

      {/* Insights */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <h3 className="text-slate-100 font-semibold mb-2">📊 Estrutura de Termo</h3>
          <p className="text-slate-400 text-sm">
            {data.dte.length} vencimentos disponíveis ({Math.min(...data.dte)} a {Math.max(...data.dte)} dias).
            {data.atmIV && ` ATM IV front-month: ${(data.atmIV * 100).toFixed(1)}%`}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <h3 className="text-slate-100 font-semibold mb-2">⚡ Skew Analysis</h3>
          <p className="text-slate-400 text-sm">
            {data.skew.totalSkew 
              ? `Total skew: ${(data.skew.totalSkew * 100).toFixed(1)}%. ${
                  data.skew.totalSkew > 0 
                    ? 'Puts mais caros (proteção premium)' 
                    : 'Calls mais caros (bullish sentiment)'
                }`
              : 'Skew data não disponível'}
          </p>
        </div>
      </div>
    </div>
  );
}
