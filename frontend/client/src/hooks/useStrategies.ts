// ============================================================================
// STRATEGIES HOOK - Gamma Tracker Frontend
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { gammaTrackerApi } from '../services/api';
import type {
  StrategyRecommendation,
  MarketState,
  Strategy
} from '../types/api';

// ----------------------------------------------------------------------------
// Hook: useStrategyRecommendations
// ----------------------------------------------------------------------------

interface UseStrategyRecommendationsReturn {
  recommendations: StrategyRecommendation[];
  marketState: MarketState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  timestamp: string | null;
}

export function useStrategyRecommendations(
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
): UseStrategyRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.strategies.getRecommendations();
      
      if (result.success) {
        setRecommendations(result.data);
        setMarketState(result.marketState);
        setTimestamp(result.timestamp);
        setError(null);
      } else {
        setError('Failed to fetch recommendations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching strategy recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();

    if (autoRefresh) {
      const interval = setInterval(fetchRecommendations, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchRecommendations, autoRefresh, refreshInterval]);

  return {
    recommendations,
    marketState,
    loading,
    error,
    refetch: fetchRecommendations,
    timestamp
  };
}

// ----------------------------------------------------------------------------
// Hook: useAllStrategies
// ----------------------------------------------------------------------------

interface UseAllStrategiesReturn {
  strategies: StrategyRecommendation[];
  marketState: MarketState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  timestamp: string | null;
}

export function useAllStrategies(
  autoRefresh = true,
  refreshInterval = 30000
): UseAllStrategiesReturn {
  const [strategies, setStrategies] = useState<StrategyRecommendation[]>([]);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const fetchStrategies = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.strategies.getAll();
      
      if (result.success) {
        setStrategies(result.data);
        setMarketState(result.marketState);
        setTimestamp(result.timestamp);
        setError(null);
      } else {
        setError('Failed to fetch strategies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching all strategies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();

    if (autoRefresh) {
      const interval = setInterval(fetchStrategies, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStrategies, autoRefresh, refreshInterval]);

  return {
    strategies,
    marketState,
    loading,
    error,
    refetch: fetchStrategies,
    timestamp
  };
}

// ----------------------------------------------------------------------------
// Hook: useStrategy (single strategy by ID)
// ----------------------------------------------------------------------------

interface UseStrategyReturn {
  strategy: StrategyRecommendation | null;
  marketState: MarketState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStrategy(strategyId: string | null): UseStrategyReturn {
  const [strategy, setStrategy] = useState<StrategyRecommendation | null>(null);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategy = useCallback(async () => {
    if (!strategyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await gammaTrackerApi.strategies.getById(strategyId);
      
      if (result.success) {
        setStrategy(result.data);
        setMarketState(result.marketState);
        setError(null);
      } else {
        setError('Failed to fetch strategy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching strategy:', err);
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  return {
    strategy,
    marketState,
    loading,
    error,
    refetch: fetchStrategy
  };
}

// ----------------------------------------------------------------------------
// Hook: useFilteredStrategies (filter by category, bias, score)
// ----------------------------------------------------------------------------

interface FilterOptions {
  category?: string[];
  bias?: string[];
  minScore?: number;
  marketFit?: string[];
}

interface UseFilteredStrategiesReturn extends UseAllStrategiesReturn {
  filteredStrategies: StrategyRecommendation[];
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  clearFilters: () => void;
}

export function useFilteredStrategies(
  initialFilters: FilterOptions = {},
  autoRefresh = true,
  refreshInterval = 30000
): UseFilteredStrategiesReturn {
  const {
    strategies,
    marketState,
    loading,
    error,
    refetch,
    timestamp
  } = useAllStrategies(autoRefresh, refreshInterval);

  const [filters, setFilters] = useState<FilterOptions>(initialFilters);

  const filteredStrategies = strategies.filter(strategy => {
    // Filter by category
    if (filters.category && filters.category.length > 0) {
      if (!filters.category.includes(strategy.category)) {
        return false;
      }
    }

    // Filter by bias
    if (filters.bias && filters.bias.length > 0) {
      if (!filters.bias.includes(strategy.bias)) {
        return false;
      }
    }

    // Filter by min score
    if (filters.minScore !== undefined) {
      if (strategy.score < filters.minScore) {
        return false;
      }
    }

    // Filter by market fit
    if (filters.marketFit && filters.marketFit.length > 0) {
      if (!filters.marketFit.includes(strategy.marketFit)) {
        return false;
      }
    }

    return true;
  });

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    strategies,
    filteredStrategies,
    marketState,
    loading,
    error,
    refetch,
    timestamp,
    filters,
    setFilters,
    clearFilters
  };
}
