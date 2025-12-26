import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { Link } from 'wouter';
import { ArrowLeft, BarChart3 } from 'lucide-react';

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
      setError('Erro de conexão com o backend');
      console.error('Fetch error:', err);
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando superfície de volatilidade...</p>
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

  // Preparar dados para o gráfico 3D
  const getSurfaceData = () => {
    const ivKey = surfaceType === 'avg' ? 'avgIV' : surfaceType === 'call' ? 'callIV' : 'putIV';
    
    // Criar matriz Z (IV) indexada por [dte_index][strike_index]
    const zMatrix: (number | null)[][] = [];
    
    data.dte.forEach(dte => {
      const row: (number | null)[] = [];
      data.strikes.forEach(strike => {
        const point = data.points.find(p => p.dte === dte && p.strike === strike);
        row.push(point ? point[ivKey] : null);
      });
      zMatrix.push(row);
    });
    
    return zMatrix;
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
        [0, '#0ea5e9'],      // sky-500 (low IV)
        [0.1, '#06b6d4'],   // cyan-500
        [0.30, '#10b981'],    // emerald-500
        [0.40, '#f59e0b'],    // amber-500
        [0.5, '#f97316'],   // orange-500
        [1, '#ef4444']       // red-500 (high IV)
      ] as any,
      colorbar: {
        title: { text: 'IV' },
        titleside: 'right',
        tickformat: '.1%',
        thickness: 20,
        len: 0.7,
        bgcolor: 'rgba(15, 23, 42, 0.95)',
        bordercolor: '#475569',
        borderwidth: 1,
        tickfont: { color: '#cbd5e1', size: 12, family: 'Roboto Mono' }
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
        titlefont: { color: '#e2e8f0', size: 14, family: 'Roboto Mono' },
        tickfont: { color: '#94a3b8', size: 11, family: 'Roboto Mono' },
        gridcolor: '#334155',
        showbackground: true,
        backgroundcolor: '#0f172a'
      },
      yaxis: {
        title: { text: 'Days to Expiration' },
        titlefont: { color: '#e2e8f0', size: 14, family: 'Roboto Mono' },
        tickfont: { color: '#94a3b8', size: 11, family: 'Roboto Mono' },
        gridcolor: '#334155',
        showbackground: true,
        backgroundcolor: '#0f172a'
      },
      zaxis: {
        title: { text: 'Implied Volatility' },
        titlefont: { color: '#e2e8f0', size: 14, family: 'Roboto Mono' },
        tickfont: { color: '#94a3b8', size: 11, family: 'Roboto Mono' },
        tickformat: '.0%',
        gridcolor: '#334155',
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
          <Link href="/volatility-skew">
            <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors">
              <BarChart3 className="w-4 h-4" />
              <span className="font-medium">2D Skew Viewer</span>
            </button>
          </Link>
          <Link href="/anomalies">
            <button className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors">
              <span className="font-medium">🔍 Anomalies</span>
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
          <p className="text-slate-400 text-sm mb-1">Total Points</p>
          <p className="text-2xl font-bold text-slate-100">{data.stats.totalPoints}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Strikes</p>
          <p className="text-2xl font-bold text-slate-100">{data.stats.strikeCount}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Expiries</p>
          <p className="text-2xl font-bold text-slate-100">{data.stats.expiryCount}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Min IV</p>
          <p className="text-2xl font-bold text-cyan-400">{(data.stats.minIV * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Max IV</p>
          <p className="text-2xl font-bold text-red-400">{(data.stats.maxIV * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Surface Type Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSurfaceType('avg')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            surfaceType === 'avg'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Average IV
        </button>
        <button
          onClick={() => setSurfaceType('call')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            surfaceType === 'call'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Call IV
        </button>
        <button
          onClick={() => setSurfaceType('put')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            surfaceType === 'put'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Put IV
        </button>
      </div>

      {/* 3D Plot */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '700px' }}
        />
      </div>
    </div>
  );
}


