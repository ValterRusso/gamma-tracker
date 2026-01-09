/**
 * useStrategies Hook
 * Fetches and manages strategy recommendations data
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3300/api';

interface StrategyRecommendation {
  id: string;
  name: string;
  category: string;
  score: number;
  description: string;
  riskLevel: string;
  complexity: string;
  marketConditions: string[];
  pros: string[];
  cons: string[];
  implementation: {
    legs: Array<{
      type: string;
      strike: number;
      quantity: number;
    }>;
  };
}

interface MarketState {
  regime: string;
  volatility: string;
  trend: string;
  [key: string]: any;
}

interface UseStrategyRecommendationsReturn {
  recommendations: StrategyRecommendation[];
  marketState: MarketState | null;
  totalStrategies: number;
  spotPrice: number;
  regime: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  timestamp: number;
}

export function useStrategyRecommendations(): UseStrategyRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [totalStrategies, setTotalStrategies] = useState(0);
  const [spotPrice, setSpotPrice] = useState(0);
  const [regime, setRegime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState(Date.now());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/strategies/recommend`);
      
      // Extract data from response
      // API returns: { success: true, data: { recommendations, marketState, ... } }
      const data = response.data.data;
      
      // Set state with proper data extraction
      setRecommendations(data.recommendations || []);
      setMarketState(data.marketState || null);
      setTotalStrategies(data.totalStrategies || 0);
      setSpotPrice(data.spotPrice || 0);
      setRegime(data.regime || 'UNKNOWN');
      setTimestamp(Date.now());
      
    } catch (err: any) {
      console.error('Error fetching strategy recommendations:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch recommendations');
      
      // Set empty defaults on error
      setRecommendations([]);
      setMarketState(null);
      setTotalStrategies(0);
      setSpotPrice(0);
      setRegime('UNKNOWN');
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    recommendations,
    marketState,
    totalStrategies,
    spotPrice,
    regime,
    loading,
    error,
    refetch: fetchData,
    timestamp
  };
}

/**
 * Hook to fetch all strategies with scores
 */
interface UseAllStrategiesReturn {
  strategies: StrategyRecommendation[];
  marketState: MarketState | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAllStrategies(): UseAllStrategiesReturn {
  const [strategies, setStrategies] = useState<StrategyRecommendation[]>([]);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/strategies/all`);
      const data = response.data.data;
      
      setStrategies(data.strategies || []);
      setMarketState(data.marketState || null);
      
    } catch (err: any) {
      console.error('Error fetching all strategies:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch strategies');
      setStrategies([]);
      setMarketState(null);
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    strategies,
    marketState,
    loading,
    error,
    refetch: fetchData
  };
}

/**
 * Hook to fetch a specific strategy
 */
interface UseStrategyReturn {
  strategy: StrategyRecommendation | null;
  marketState: MarketState | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStrategy(strategyId: string): UseStrategyReturn {
  const [strategy, setStrategy] = useState<StrategyRecommendation | null>(null);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!strategyId) {
      setError('Strategy ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/strategies/${strategyId}`);
      const data = response.data.data;
      
      setStrategy(data.strategy || null);
      setMarketState(data.marketState || null);
      
    } catch (err: any) {
      console.error(`Error fetching strategy ${strategyId}:`, err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch strategy');
      setStrategy(null);
      setMarketState(null);
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [strategyId]);

  return {
    strategy,
    marketState,
    loading,
    error,
    refetch: fetchData
  };
}
