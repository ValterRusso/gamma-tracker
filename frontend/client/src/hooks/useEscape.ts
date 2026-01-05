// ============================================================================
// ORDERBOOK & ESCAPE HOOKS
// Arquivo: src/hooks/useEscape.ts
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { gammaTrackerApi } from '../services/api';
import type {
  OrderbookImbalanceData,
  OrderbookWallsData,
  OrderbookEnergyData,
  EscapeEnergyData,
  EscapeProbabilityData,
  EscapeDetectionData
} from '../types/api';

// ----------------------------------------------------------------------------
// Hook: useOrderbookImbalance
// ----------------------------------------------------------------------------

interface UseOrderbookImbalanceReturn {
  imbalance: OrderbookImbalanceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrderbookImbalance(
  autoRefresh = true,
  refreshInterval = 5000 // 5s - book changes fast
): UseOrderbookImbalanceReturn {
  const [imbalance, setImbalance] = useState<OrderbookImbalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImbalance = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.orderbook.getImbalance();
      
      if (result.success && result.data) {
        setImbalance(result.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImbalance();
    if (autoRefresh) {
      const interval = setInterval(fetchImbalance, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchImbalance, autoRefresh, refreshInterval]);

  return { imbalance, loading, error, refetch: fetchImbalance };
}

// ----------------------------------------------------------------------------
// Hook: useOrderbookWalls
// ----------------------------------------------------------------------------

interface UseOrderbookWallsReturn {
  walls: OrderbookWallsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrderbookWalls(
  autoRefresh = true,
  refreshInterval = 5000
): UseOrderbookWallsReturn {
  const [walls, setWalls] = useState<OrderbookWallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalls = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.orderbook.getWalls();
      
      if (result.success && result.data) {
        setWalls(result.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalls();
    if (autoRefresh) {
      const interval = setInterval(fetchWalls, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchWalls, autoRefresh, refreshInterval]);

  return { walls, loading, error, refetch: fetchWalls };
}

// ----------------------------------------------------------------------------
// Hook: useEscapeDetection (MAIN HOOK)
// ----------------------------------------------------------------------------

interface UseEscapeDetectionReturn {
  detection: EscapeDetectionData | null;
  probability: EscapeProbabilityData | null;
  energy: EscapeEnergyData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEscapeDetection(
  autoRefresh = true,
  refreshInterval = 3000 // 3s - escape detection needs to be fast
): UseEscapeDetectionReturn {
  const [detection, setDetection] = useState<EscapeDetectionData | null>(null);
  const [probability, setProbability] = useState<EscapeProbabilityData | null>(null);
  const [energy, setEnergy] = useState<EscapeEnergyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all escape data in parallel
      const [detectionRes, probabilityRes, energyRes] = await Promise.all([
        gammaTrackerApi.escape.detect(),
        gammaTrackerApi.escape.getProbability(),
        gammaTrackerApi.escape.getEnergy()
      ]);

      if (detectionRes.success && detectionRes.detection) {
        setDetection(detectionRes.detection);
      }

      if (probabilityRes.success && probabilityRes.probability) {
        setProbability(probabilityRes.probability);
      }

      if (energyRes.success && energyRes.energy) {
        setEnergy(energyRes.energy);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching escape detection:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    if (autoRefresh) {
      const interval = setInterval(fetchAll, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAll, autoRefresh, refreshInterval]);

  return {
    detection,
    probability,
    energy,
    loading,
    error,
    refetch: fetchAll
  };
}

// ----------------------------------------------------------------------------
// Hook: useEscapeProbability (Standalone)
// ----------------------------------------------------------------------------

interface UseEscapeProbabilityReturn {
  probability: EscapeProbabilityData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEscapeProbability(
  autoRefresh = true,
  refreshInterval = 5000
): UseEscapeProbabilityReturn {
  const [probability, setProbability] = useState<EscapeProbabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProbability = useCallback(async () => {
    try {
      setLoading(true);
      const result = await gammaTrackerApi.escape.getProbability();
      
      if (result.success && result.probability) {
        setProbability(result.probability);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProbability();
    if (autoRefresh) {
      const interval = setInterval(fetchProbability, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchProbability, autoRefresh, refreshInterval]);

  return { probability, loading, error, refetch: fetchProbability };
}