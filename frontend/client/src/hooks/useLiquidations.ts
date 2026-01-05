// ============================================================================
// LIQUIDATIONS HOOK
// Arquivo: src/hooks/useLiquidations.ts
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { gammaTrackerApi } from '../services/api';
import type {
  CascadeDetectionData,
  LiquidationStats,
  LiquidationEnergyData,
  LiquidationSummaryData
} from '../types/api';

// ----------------------------------------------------------------------------
// Hook: useLiquidationSummary (All data combined)
// ----------------------------------------------------------------------------

interface UseLiquidationSummaryReturn {
  stats: LiquidationStats | null;
  energy: LiquidationEnergyData | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdate: number | null;
}

export function useLiquidationSummary(
  autoRefresh = true,
  refreshInterval = 10000 // 10 seconds (liquidations change fast)
): UseLiquidationSummaryReturn {
  const [stats, setStats] = useState<LiquidationStats | null>(null);
  const [energy, setEnergy] = useState<LiquidationEnergyData | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.liquidations.getSummary();
      
      if (result.success && result.data) {
        setStats(result.data.stats);
        setEnergy(result.data.energy);
        setConnected(result.data.connected);
        setLastUpdate(result.data.lastUpdate);
        setError(null);
      } else {
        setError('Failed to fetch liquidation summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching liquidation summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();

    if (autoRefresh) {
      const interval = setInterval(fetchSummary, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchSummary, autoRefresh, refreshInterval]);

  return {
    stats,
    energy,
    connected,
    loading,
    error,
    refetch: fetchSummary,
    lastUpdate
  };
}

// ----------------------------------------------------------------------------
// Hook: useLiquidationStats (Stats only)
// ----------------------------------------------------------------------------

interface UseLiquidationStatsReturn {
  stats: LiquidationStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLiquidationStats(
  autoRefresh = true,
  refreshInterval = 10000
): UseLiquidationStatsReturn {
  const [stats, setStats] = useState<LiquidationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.liquidations.getStats();
      
      if (result.success && result.data) {
        setStats(result.data);
        setError(null);
      } else {
        setError('Failed to fetch liquidation stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching liquidation stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, autoRefresh, refreshInterval]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
}

// ----------------------------------------------------------------------------
// Hook: useCascadeDetection (Cascade alerts)
// ----------------------------------------------------------------------------

interface UseCascadeDetectionReturn {
  cascadeData: CascadeDetectionData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCascadeDetection(
  autoRefresh = true,
  refreshInterval = 5000 // 5 seconds for cascade detection
): UseCascadeDetectionReturn {
  const [cascadeData, setCascadeData] = useState<CascadeDetectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCascade = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.liquidations.getCascade();
      
      if (result.success && result.data) {
        setCascadeData(result.data);
        setError(null);
      } else {
        setError('Failed to fetch cascade detection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching cascade detection:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCascade();

    if (autoRefresh) {
      const interval = setInterval(fetchCascade, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchCascade, autoRefresh, refreshInterval]);

  return {
    cascadeData,
    loading,
    error,
    refetch: fetchCascade
  };
}

// ----------------------------------------------------------------------------
// Hook: useLiquidationEnergy (Energy metric only)
// ----------------------------------------------------------------------------

interface UseLiquidationEnergyReturn {
  energy: LiquidationEnergyData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLiquidationEnergy(
  autoRefresh = true,
  refreshInterval = 10000
): UseLiquidationEnergyReturn {
  const [energy, setEnergy] = useState<LiquidationEnergyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnergy = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.liquidations.getEnergy();
      
      if (result.success && result.data) {
        setEnergy(result.data);
        setError(null);
      } else {
        setError('Failed to fetch liquidation energy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching liquidation energy:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnergy();

    if (autoRefresh) {
      const interval = setInterval(fetchEnergy, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchEnergy, autoRefresh, refreshInterval]);

  return {
    energy,
    loading,
    error,
    refetch: fetchEnergy
  };
}