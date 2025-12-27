import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { AlertTriangle } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';
import AnomalyStatsCards from '@/components/AnomalyStatsCards';
import AnomalyFilters from '@/components/AnomalyFilters';
import AnomalyTable from '@/components/AnomalyTable';


interface Anomaly {
  type: 'IV_OUTLIER' | 'SKEW_ANOMALY';
  strike: number;
  dte: number;
  moneyness: number;
  iv?: number;
  callIV?: number;
  putIV?: number;
  expectedIV?: number;
  deviation?: number;
  deviationPct?: number;
  spread?: number;
  spreadPct?: number;
  expectedSpread?: number;
  zScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priceType?: 'OVERPRICED' | 'UNDERPRICED';
  skewType?: 'PUT_PREMIUM' | 'CALL_PREMIUM';
  isWing?: boolean;
  relevanceScore: number;
  volume: number;
  openInterest: number;
  expiryDate: number;
}

interface AnomalyStats {
  total: number;
  byType: {
    ivOutlier: number;
    skewAnomaly: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byPriceType: {
    overpriced: number;
    underpriced: number;
  };
  avgRelevance: number;
}

interface AnomalyData {
  anomalies: Anomaly[];
  stats: AnomalyStats;
  threshold: number;
  spotPrice: number;
  filters: {
    severity: string;
    type: string;
    limit: number;
  };
}

export default function Anomalies() {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [threshold, setThreshold] = useState(2.0);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchStrike, setSearchStrike] = useState('');
  
  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        threshold: threshold.toString(),
        limit: '100'
      });
      
      if (severityFilter !== 'ALL') {
        params.append('severity', severityFilter);
      }
      
      if (typeFilter !== 'ALL') {
        params.append('type', typeFilter);
      }
      
      const response = await fetch(`http://localhost:3300/api/vol-anomalies?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Erro ao carregar anomalias');
      }
    } catch (err) {
      setError('Erro de conexão com o backend');
      console.error('Erro ao buscar anomalias:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 60000); // Atualizar a cada 60s
    return () => clearInterval(interval);
  }, [threshold, severityFilter, typeFilter]);
  
  const filteredAnomalies = data?.anomalies.filter(a => {
    if (searchStrike && !a.strike.toString().includes(searchStrike)) {
      return false;
    }
    return true;
  }) || [];

  if (loading) {
    return <LoadingScreen message="Detectando anomalias na superfície de volatilidade..." />;
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-400 mb-2">Erro ao Carregar Anomalias</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <button
              onClick={fetchAnomalies}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!data) return null;
  
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/volatility-surface"
               className="text-cyan-400 hover:text-cyan-300 text-sm mb-2 inline-flex items-center gap-2">
                ← Back to 3D Surface              
            </Link>
            <h1 className="text-3xl font-bold text-white">Volatility Anomalies</h1>
            <p className="text-slate-400 mt-1">
              Statistical outliers detected in the volatility surface
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Spot Price</div>
            <div className="text-2xl font-bold text-white">
              ${data.spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500">Threshold: {data.threshold.toFixed(1)}σ</div>
          </div>
        </div>
        
        {/* Stats Cards */}
           <AnomalyStatsCards stats={data.stats} />

        {/* Filters */} 

        <AnomalyFilters
          threshold={threshold}
          setThreshold={setThreshold}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          searchStrike={searchStrike}
          setSearchStrike={setSearchStrike}
        />

        {/* Anomalies Table */}

         <AnomalyTable anomalies={filteredAnomalies} />
        
        {/* Footer Info */}
        <div className="text-center text-sm text-slate-500">
          Showing {filteredAnomalies.length} of {data.anomalies.length} anomalies · 
          Last updated: {new Date().toLocaleTimeString()}
        </div>
         </div>
    </div>
    );
}
  
  