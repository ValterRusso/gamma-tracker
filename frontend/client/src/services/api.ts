// ============================================================================
// API CLIENT - Gamma Tracker Frontend
// ============================================================================

import type {
  ApiResponse,
  StrategyRecommendationsResponse,
  AllStrategiesResponse,
  StrategyDetailResponse,
  GammaProfileResponse,
  WallZonesResponse,
  SentimentResponse,
  AnomaliesResponse,
  MetricsResponse,
  VolSurfaceResponse,
  MarketSnapshot,
  GEXHistoryPoint,
  RegimeChange,
  CascadeDetectionResponse,
  LiquidationStatsResponse,
  LiquidationEnergyResponse,
  LiquidationSummaryResponse,
  OrderbookSpreadResponse,
  OrderbookDepthResponse,
  OrderbookImbalanceResponse,
  OrderbookWallsResponse,
  OrderbookEnergyResponse,
  EscapeEnergyResponse,
  EscapeProbabilityResponse,
  EscapeDetectionResponse
} from '../types/api'

// ----------------------------------------------------------------------------
// Base API Client
// ----------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3300/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
}

const api = new ApiClient();

// ----------------------------------------------------------------------------
// Strategies API
// ----------------------------------------------------------------------------

export const strategiesApi = {
  /**
   * Get strategy recommendations based on current market state
   */
  getRecommendations: () => 
    api.get<StrategyRecommendationsResponse>('/strategies/recommend'),
  
  /**
   * Get all strategies with scores
   */
  getAll: () => 
    api.get<AllStrategiesResponse>('/strategies/all'),
  
  /**
   * Get specific strategy by ID
   */
  getById: (id: string) => 
    api.get<StrategyDetailResponse>(`/strategies/${id}`)
};

// ----------------------------------------------------------------------------
// Gamma Analysis API
// ----------------------------------------------------------------------------

export const gammaApi = {
  /**
   * Get complete metrics (cached)
   */
  getMetrics: () => 
    api.get<MetricsResponse>('/metrics'),
  
  /**
   * Get gamma profile with optional filters
   * @param range - Range percentage (default: 0.3 = ±30%)
   * @param threshold - GEX threshold (default: 0.02 = 2%)
   * @param auto - Enable smart range (default: true)
   */
  getGammaProfile: (params?: { range?: number; threshold?: number; auto?: boolean }) => 
    api.get<GammaProfileResponse>('/gamma-profile', params),
  
  /**
   * Get total GEX
   */
  getTotalGEX: () => 
    api.get<ApiResponse<number>>('/total-gex'),
  
  /**
   * Get gamma flip level
   */
  getGammaFlip: () => 
    api.get<ApiResponse<number | null>>('/gamma-flip'),
  
  /**
   * Get put/call walls
   */
  getWalls: () => 
    api.get<ApiResponse<{ putWall: number | null; callWall: number | null }>>('/walls'),
  
  /**
   * Get wall zones (detailed)
   */
  getWallZones: () => 
    api.get<WallZonesResponse>('/wall-zones')
};

// ----------------------------------------------------------------------------
// Volatility API
// ----------------------------------------------------------------------------

export const volatilityApi = {
  /**
   * Get volatility surface (3D)
   */
  getSurface: () => 
    api.get<VolSurfaceResponse>('/vol-surface'),
  
  /**
   * Get volatility smile for specific expiry
   */
  getSmile: (expiry: string) => 
    api.get<ApiResponse<any>>(`/vol-smile/${expiry}`),
  
  /**
   * Get available expiry dates
   */
  getExpiries: () => 
    api.get<ApiResponse<string[]>>('/expiries')
};

// ----------------------------------------------------------------------------
// Market Analysis API
// ----------------------------------------------------------------------------

export const marketApi = {
  /**
   * Get max pain calculation
   */
  getMaxPain: () => 
    api.get<ApiResponse<any>>('/max-pain'),
  
  /**
   * Get put/call ratio
   */
  getPCR: () => 
    api.get<ApiResponse<any>>('/pcr'),
  
  /**
   * Get market sentiment
   */
  getSentiment: () => 
    api.get<SentimentResponse>('/sentiment'),
  
  /**
   * Get anomaly detection results
   */
  getAnomalies: () => 
    api.get<AnomaliesResponse>('/anomalies')
};

// ----------------------------------------------------------------------------
// Liquidations API
// Adicione este objeto ao gammaTrackerApi no final do arquivo
// ----------------------------------------------------------------------------

export const liquidationsApi = {
  /**
   * Detect liquidation cascade events
   * Returns cascade status and recent liquidations
   */
  getCascade: () => 
    api.get<CascadeDetectionResponse>('/liquidations/cascade'),
  
  /**
   * Get liquidation statistics
   * Includes total value, imbalance, counts for 1h/4h/24h
   */
  getStats: () => 
    api.get<LiquidationStatsResponse>('/liquidations/stats'),
  
  /**
   * Get liquidation energy metric
   * Combined score of value, frequency, cascade and imbalance
   */
  getEnergy: () => 
    api.get<LiquidationEnergyResponse>('/liquidations/energy'),
  
  /**
   * Get complete liquidation summary
   * Includes stats + energy + connection status
   */
  getSummary: () => 
    api.get<LiquidationSummaryResponse>('/liquidations/summary')
};

// ----------------------------------------------------------------------------
// Orderbook API
// ----------------------------------------------------------------------------

export const orderbookApi = {
  /**
   * Get current orderbook spread
   * Returns bid-ask spread in absolute and percentage terms
   */
  getSpread: () => 
    api.get<OrderbookSpreadResponse>('/orderbook/spread'),
  
  /**
   * Get orderbook depth analysis
   * Same as spread but focused on depth interpretation
   */
  getDepth: () => 
    api.get<OrderbookDepthResponse>('/orderbook/depth'),
  
  /**
   * Get orderbook imbalance (BI)
   * Ratio of bid vs ask volume, indicates directional pressure
   */
  getImbalance: () => 
    api.get<OrderbookImbalanceResponse>('/orderbook/imbalance'),
  
  /**
   * Detect orderbook walls
   * Identifies significant bid/ask walls (large orders)
   */
  getWalls: () => 
    api.get<OrderbookWallsResponse>('/orderbook/walls'),
  
  /**
   * Get orderbook energy metric
   * Combined score of imbalance, persistence, spread and depth
   */
  getEnergy: () => 
    api.get<OrderbookEnergyResponse>('/orderbook/energy')
};

// ----------------------------------------------------------------------------
// Escape Detection API
// ----------------------------------------------------------------------------

export const escapeApi = {
  /**
   * Get escape energy analysis
   * Sustained (orderbook) + Injected (liquidations) energy
   */
  getEnergy: () => 
    api.get<EscapeEnergyResponse>('/escape/energy'),
  
  /**
   * Calculate escape probability
   * P(escape) = f(energy, potential_barriers)
   */
  getProbability: () => 
    api.get<EscapeProbabilityResponse>('/escape/probability'),
  
  /**
   * Detect active escape events
   * Real-time detection of breakout/breakdown with confidence
   */
  detect: () => 
    api.get<EscapeDetectionResponse>('/escape/detect')
};


// ----------------------------------------------------------------------------
// Database API (Historical Data)
// ----------------------------------------------------------------------------

export const databaseApi = {
  /**
   * Get market snapshots
   * @param limit - Number of records (default: 100)
   * @param offset - Offset for pagination (default: 0)
   */
  getSnapshots: (params?: { limit?: number; offset?: number }) => 
    api.get<ApiResponse<MarketSnapshot[]>>('/db/snapshots', params),
  
  /**
   * Get latest market snapshot
   */
  getLatestSnapshot: () => 
    api.get<ApiResponse<MarketSnapshot>>('/db/snapshots/latest'),
  
  /**
   * Get options chain data
   * @param limit - Number of records
   * @param offset - Offset for pagination
   * @param expiry - Filter by expiry date
   */
  getOptions: (params?: { limit?: number; offset?: number; expiry?: string }) => 
    api.get<ApiResponse<any[]>>('/db/options', params),
  
  /**
   * Get GEX history
   * @param hours - Hours to look back (default: 24)
   */
  getGEXHistory: (hours = 24) => 
    api.get<ApiResponse<GEXHistoryPoint[]>>('/db/gex-history', { hours }),
  
  /**
   * Get regime changes
   * @param limit - Number of records (default: 50)
   */
  getRegimeChanges: (limit = 50) => 
    api.get<ApiResponse<RegimeChange[]>>('/db/regime-changes', { limit }),
  
  /**
   * Get anomalies log
   * @param hours - Hours to look back (default: 24)
   */
  getAnomaliesLog: (hours = 24) => 
    api.get<ApiResponse<any[]>>('/db/anomalies', { hours }),
  
  /**
   * Get database statistics
   */
  getStats: () => 
    api.get<ApiResponse<{
      snapshots: number;
      options: number;
      gexHistory: number;
      regimeChanges: number;
      anomalies: number;
    }>>('/db/stats')
};

// ----------------------------------------------------------------------------
// System API
// ----------------------------------------------------------------------------

export const systemApi = {
  /**
   * Health check
   */
  health: () => 
    api.get<{ status: string; timestamp: number; uptime: number }>('/health'),
  
  /**
   * Get collector status
   */
  getStatus: () => 
    api.get<ApiResponse<any>>('/status')
};

// ----------------------------------------------------------------------------
// Export single API object with all endpoints
// ----------------------------------------------------------------------------

export const gammaTrackerApi = {
  strategies: strategiesApi,
  gamma: gammaApi,
  volatility: volatilityApi,
  market: marketApi,
  database: databaseApi,
  system: systemApi,
  liquidations: liquidationsApi,
  orderbook: orderbookApi,
  escape: escapeApi
};

export default gammaTrackerApi;
