// ============================================================================
// API TYPES - Gamma Tracker Frontend
// ============================================================================

// ----------------------------------------------------------------------------
// Common Types
// ----------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApiMetaInfo {
  totalStrategies: number;
  recommendedCount: number;
  spotPrice?: number;
  regime?: string;
}

// ----------------------------------------------------------------------------
// Strategy Types
// ----------------------------------------------------------------------------

export type StrategyCategory = 'DIRECTIONAL' | 'NEUTRAL' | 'VOLATILITY';
export type StrategyBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type OptionAction = 'BUY' | 'SELL';
export type OptionType = 'CALL' | 'PUT';
export type Moneyness = 'ITM' | 'ATM' | 'OTM';
export type RiskLevel = 'LIMITED' | 'UNLIMITED';
export type BreakevenType = 'SINGLE' | 'DOUBLE' | 'MULTIPLE';
export type CapitalRequired = 'LOW' | 'MEDIUM' | 'HIGH';
export type GreekSign = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type MarketFit = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface StrategyLeg {
  action: OptionAction;
  type: OptionType;
  moneyness: Moneyness;
  delta?: number;
}

export interface IdealConditions {
  regime: string[];
  volatility: string[];
  skew: string[];
  gex: string[];
  maxPainDistance?: {
    min?: number;
    max?: number;
  };
  sentiment?: {
    putCallRatio?: {
      min?: number;
      max?: number;
    };
  };
}

export interface RiskProfile {
  maxLoss: RiskLevel;
  maxProfit: RiskLevel;
  breakeven: BreakevenType;
  capitalRequired: CapitalRequired;
}

export interface GreeksProfile {
  delta: {
    target: number;
    range: [number, number];
  };
  theta: GreekSign;
  vega: GreekSign;
  gamma: GreekSign;
}

export interface ScoringWeights {
  regime: number;
  volatility: number;
  skew: number;
  gex: number;
  maxPainDistance: number;
  sentiment: number;
}

export interface Strategy {
  id: string;
  name: string;
  namePt: string;
  description: string;
  category: StrategyCategory;
  bias: StrategyBias;
  idealConditions: IdealConditions;
  legs: StrategyLeg[];
  risk: RiskProfile;
  greeks: GreeksProfile;
  whenToUse: string[];
  whenToAvoid: string[];
  scoringWeights: ScoringWeights;
}

export interface StrategyRecommendation extends Strategy {
  score: number;
  reasoning: string[];
  marketFit: MarketFit;
}

export interface StrategyDetailResponse {
  success: boolean;
  data: StrategyRecommendation;
  marketState: MarketState;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Market State Types
// ----------------------------------------------------------------------------

export type RegimeType = 
  | 'POSITIVE_GAMMA_ABOVE' 
  | 'POSITIVE_GAMMA_BELOW' 
  | 'NEGATIVE_GAMMA_ABOVE' 
  | 'NEGATIVE_GAMMA_BELOW'
  | 'NEUTRAL'
  | 'BULLISH'
  | 'BEARISH';

export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type SkewType = 'FLAT' | 'PUT_SKEW' | 'CALL_SKEW';
export type GEXType = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface MarketState {
  regime: RegimeType;
  volatility: VolatilityLevel;
  skew: SkewType;
  gex: GEXType;
  maxPainDistance: number;
  sentiment: {
    putCallRatio: number;
    divergence: boolean;
  };
  anomalies: string[];
}

export interface StrategyRecommendationsResponse {
  success: boolean;
  data: StrategyRecommendation[];
  marketState: MarketState;
  timestamp: string;
  meta: ApiMetaInfo;
}

export interface AllStrategiesResponse {
  success: boolean;
  data: StrategyRecommendation[];
  marketState: MarketState;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Gamma Profile Types
// ----------------------------------------------------------------------------

export interface GammaProfilePoint {
  strike: number;
  totalGEX: number;
  callGEX: number;
  putGEX: number;
  callOI: number;
  putOI: number;
  totalOI: number;
  callGamma: number;
  putGamma: number;
}

export interface RangeInfo {
  minStrike: number;
  maxStrike: number;
  totalStrikes: number;
  filteredStrikes: number;
  compressionRatio: string;
  rangePercent: number;
  gexThreshold: number;
}

export interface GammaProfileResponse {
  success: boolean;
  data: GammaProfilePoint[];
  rangeInfo: RangeInfo;
  spotPrice: number;
}

// ----------------------------------------------------------------------------
// Wall Zones Types
// ----------------------------------------------------------------------------

export interface WallZoneStrike {
  strike: number;
  gex: number;
  percentage: number;
}

export interface WallZone {
  peak: number;
  peakGEX: number;
  zoneLow: number;
  zoneHigh: number;
  zoneWidth: number;
  zoneStrikes: WallZoneStrike[];
  strikeCount: number;
  threshold: number;
  totalZoneGEX: number;
  distanceFromSpot: {
    peak: number;
    zoneLow: number;
    zoneHigh: number;
  };
  distancePercent: {
    peak: number;
    zoneLow: number;
    zoneHigh: number;
  };
}

export interface WallZonesResponse {
  success: boolean;
  data: {
    spotPrice: number;
    putWallZone: WallZone | null;
    callWallZone: WallZone | null;
  };
}

// ----------------------------------------------------------------------------
// Sentiment Types
// ----------------------------------------------------------------------------

export type SentimentType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface SentimentData {
  sentiment: SentimentType;
  putCallOIRatio: number;
  putCallVolRatio: number;
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
  interpretation: string;
}

export interface SentimentResponse {
  success: boolean;
  data: SentimentData;
}

// ----------------------------------------------------------------------------
// Anomalies Types
// ----------------------------------------------------------------------------

export type AnomalyType = 
  | 'IV_OUTLIER' 
  | 'SKEW_ANOMALY' 
  | 'OI_VOLUME_DIVERGENCE'
  | 'UNUSUAL_ACTIVITY';

export interface Anomaly {
  id: number;
  type: AnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  strike?: number;
  expiry?: string;
  description: string;
  metrics?: Record<string, any>;
  createdAt: string;
}

export interface AnomaliesResponse {
  success: boolean;
  data: Anomaly[];
  count: number;
  hours: number;
}

// ----------------------------------------------------------------------------
// Metrics Types
// ----------------------------------------------------------------------------

export interface MetricsData {
  spotPrice: number;
  totalGEX: number;
  gammaFlip: number | null;
  putWall: number | null;
  callWall: number | null;
  regime: string | null;
  gammaProfile: GammaProfilePoint[];
  regimeAnalysis?: {
    regime: string;
    confidence: number;
    indicators: Record<string, any>;
  };
}

export interface MetricsResponse {
  success: boolean;
  data: MetricsData;
}

// ----------------------------------------------------------------------------
// Volatility Surface Types
// ----------------------------------------------------------------------------

export interface VolSurfacePoint {
  strike: number;
  dte: number;
  moneyness: number;
  callIV: number | null;
  putIV: number | null;
  avgIV: number | null;
}

export interface VolSurfaceStats {
  totalPoints: number;
  strikeCount: number;
  expiryCount: number;
  minIV: number;
  maxIV: number;
}

export interface VolSurfaceData {
  strikes: number[];
  dte: number[];
  points: VolSurfacePoint[];
  stats: VolSurfaceStats;
  spotPrice: number;
}

export interface VolSurfaceResponse {
  success: boolean;
  data: VolSurfaceData;
  error?: string;
}

// ----------------------------------------------------------------------------
// Database Types (Historical Data)
// ----------------------------------------------------------------------------

export interface MarketSnapshot {
  id: number;
  timestamp: string;
  spot_price: number;
  total_gex: number;
  gamma_flip: number | null;
  put_wall: number | null;
  call_wall: number | null;
  regime: string | null;
  gamma_profile_data: string | null;
  vol_surface_data: string | null;
}

export interface GEXHistoryPoint {
  id: number;
  timestamp: string;
  spot_price: number;
  total_gex: number;
  call_gex: number;
  put_gex: number;
  gamma_flip: number | null;
}

export interface RegimeChange {
  id: number;
  timestamp: string;
  from_regime: string;
  to_regime: string;
  spot_price: number;
  total_gex: number;
  confidence: number;
}

// ----------------------------------------------------------------------------
// Webhook Payload (para Beholder/Hydra)
// ----------------------------------------------------------------------------

export interface WebhookPayload {
  source: 'gamma_tracker';
  timestamp: string;
  signal_type: 'strategy_recommendation';
  strategy: {
    id: string;
    name: string;
    confidence: number;
    legs: Array<{
      action: OptionAction;
      type: OptionType;
      strike: number;
      expiry: string;
      contracts: number;
    }>;
  };
  market_context: {
    spot_price: number;
    regime: string;
    gamma_flip: number | null;
    put_wall: number | null;
    call_wall: number | null;
  };
  risk_params: {
    max_loss: number | string;
    max_profit: number | string;
    breakevens: number[];
  };
  validity: {
    valid_until: string;
    invalidate_if: {
      spot_crosses?: number;
      regime_changes?: boolean;
      anomaly_detected?: boolean;
    };
  };
}
