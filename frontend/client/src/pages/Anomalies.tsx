import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Search, Filter } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';

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
      
      const response = await fetch(`https://huge-mangos-deny.loca.lt/api/vol-anomalies?${params}`);
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
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'LOW': return 'text-green-500 bg-green-500/10 border-green-500/30';
    default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  // You should return some JSX here, for example:
  return (
    <div>
      {/* Your component JSX goes here */}
      <h1>Anomalies</h1>
      {/* ... */}
    </div>
  );
}