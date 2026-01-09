// ============================================================================
// API TYPES - CONSOLIDATED (NO DUPLICATES)
// Gamma Tracker Frontend - Complete Type Definitions
// Este arquivo vai para: src/types/api.ts
// ============================================================================

// ----------------------------------------------------------------------------
// Common Types (Used across multiple domains)
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

// SHARED ENUMS (declared once, used everywhere)
export type VolatilityLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type ImbalanceDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

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
  data: {
    strategy: StrategyRecommendation;
    marketState: MarketState | null;
  };
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
  data: {
    recommendations: StrategyRecommendation[];
    marketState: MarketState;
    totalStrategies: number;
    spotPrice: number;
    regime: string;
  };
}

export interface AllStrategiesResponse {
  success: boolean;
  data: {
    strategies: StrategyRecommendation[];
    marketState: MarketState;
  };
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
// Liquidation Types
// ----------------------------------------------------------------------------

export type LiquidationSide = 'BUY' | 'SELL';
export type LiquidationStatus = 'FILLED' | 'PARTIAL' | 'CANCELLED';
export type LiquidationSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE';
export type LiquidationEnergyLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';

export interface LiquidationRaw {
  s: string;
  S: string;
  o: string;
  f: string;
  q: string;
  p: string;
  ap: string;
  X: string;
  l: string;
  z: string;
  T: number;
}

export interface Liquidation {
  timestamp: number;
  symbol: string;
  side: LiquidationSide;
  quantity: number;
  price: number;
  value: number;
  status: LiquidationStatus;
  raw: LiquidationRaw;
  size: LiquidationSize;
}

export interface LiquidationImbalance {
  longLiquidated: number;
  shortLiquidated: number;
  ratio: number;
  direction: ImbalanceDirection;  // Reusing shared type
}

export interface LiquidationCount {
  last1h: number;
  last4h: number;
  last24h: number;
}

export interface LiquidationTotalValue {
  last1h: number;
  last4h: number;
  last24h: number;
}

export interface CascadeDetectionData {
  cascadeDetected: boolean;
  liquidationsLastMinute: number;
  threshold: number;
  recentLiquidations: Liquidation[];
}

export interface CascadeDetectionResponse {
  success: boolean;
  data: CascadeDetectionData;
  timestamp: string;
}

export interface LiquidationStats {
  totalValue: LiquidationTotalValue;
  imbalance1h: LiquidationImbalance;
  cascade: boolean;
  largestLiquidation: Liquidation;
  count: LiquidationCount;
  lastUpdate: number;
}

export interface LiquidationStatsResponse {
  success: boolean;
  data: LiquidationStats;
  timestamp: string;
}

export interface LiquidationEnergyComponents {
  value: number;
  frequency: number;
  cascade: number;
  imbalance: number;
}

export interface LiquidationEnergyData {
  score: number;
  level: LiquidationEnergyLevel;
  direction: ImbalanceDirection;  // Reusing shared type
  components: LiquidationEnergyComponents;
  rawData: LiquidationStats;
}

export interface LiquidationEnergyResponse {
  success: boolean;
  data: LiquidationEnergyData;
  timestamp: string;
}

export interface LiquidationSummaryData {
  stats: LiquidationStats;
  energy: LiquidationEnergyData;
  connected: boolean;
  lastUpdate: number;
}

export interface LiquidationSummaryResponse {
  success: boolean;
  data: LiquidationSummaryData;
}

// ----------------------------------------------------------------------------
// Orderbook Types
// ----------------------------------------------------------------------------

export type SpreadQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'TERRIBLE';
export type ImbalanceStrength = 'VERY_WEAK' | 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
export type WallSignificance = 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';
export type BookEnergyLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface SpreadInterpretation {
  quality: SpreadQuality;
  message: string;
  volatility: VolatilityLevel;  // Reusing shared type
}

export interface OrderbookSpreadData {
  spread: number;
  spread_pct: number;
  pulse: number;
  bestBid: number;
  bestAsk: number;
  interpretation: SpreadInterpretation;
}

export interface OrderbookSpreadResponse {
  success: boolean;
  data: OrderbookSpreadData;
  timestamp: string;
}

export interface OrderbookDepthResponse extends OrderbookSpreadResponse {}

export interface ImbalanceInterpretation {
  message: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

export interface OrderbookImbalanceData {
  BI: number;
  direction: ImbalanceDirection;  // Reusing shared type
  strength: ImbalanceStrength;
  persistence: number;
  avg_60s: number;
  interpretation: ImbalanceInterpretation;
}

export interface OrderbookImbalanceResponse {
  success: boolean;
  data: OrderbookImbalanceData;
  timestamp: string;
}

export interface OrderbookWall {
  price: number;
  size: number;
  ratio: number;
  distance: number;
}

export interface WallsInterpretation {
  message: string;
  significance: WallSignificance;
}

export interface OrderbookWallsData {
  bidWall: OrderbookWall;
  askWall: OrderbookWall;
  interpretation: WallsInterpretation;
}

export interface OrderbookWallsResponse {
  success: boolean;
  data: OrderbookWallsData;
  timestamp: string;
}

export interface BookEnergyComponents {
  BI: number;
  persistence: number;
  spread_quality: number;
  depth: number;
}

export interface BookEnergyInterpretation {
  message: string;
  recommendation: string;
}

export interface OrderbookEnergyData {
  score: number;
  level: BookEnergyLevel;
  components: BookEnergyComponents;
  interpretation: BookEnergyInterpretation;
}

export interface OrderbookEnergyResponse {
  success: boolean;
  data: OrderbookEnergyData;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Escape Detection Types
// ----------------------------------------------------------------------------

export type EscapeType = 'NONE' | 'UPWARD' | 'DOWNWARD' | 'VACUUM_UP' | 'VACUUM_DOWN';
export type EscapeDirection = ImbalanceDirection;  // Reusing shared type
export type EscapeProbability = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';
export type EscapeRegime = 'FULL_MARKET' | 'BOOK_DOMINANT' | 'OPTIONS_DOMINANT' | 'TRANSITION' | 'LOW_LIQUIDITY';
export type IcebergConfidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface IcebergLevel {
  price: number;
  avgSize: number;
  occurrences: number;
}

export interface IcebergRefillingSignal {
  detected: boolean;
  refillingLevels: number;
  detectedLevels: IcebergLevel[];
  score: number;
}

export interface IcebergVolumeAnomalySignal {
  detected: boolean;
  reason?: string;
}

export interface IcebergPriceRejectionSignal {
  detected: boolean;
  rejectionLevels: any[];
  strongestLevel: any;
  score: number;
}

export interface IcebergDepthRegenerationSignal {
  detected: boolean;
  reason?: string;
}

export interface ConsistentSizeEntry {
  size: number;
  occurrences: number;
}

export interface IcebergConsistentSizeSignal {
  detected: boolean;
  consistentSizes: ConsistentSizeEntry[];
  mostCommonSize: ConsistentSizeEntry;
  score: number;
}

export interface IcebergSignals {
  refillingOrders: IcebergRefillingSignal;
  volumeAnomaly: IcebergVolumeAnomalySignal;
  priceRejection: IcebergPriceRejectionSignal;
  depthRegeneration: IcebergDepthRegenerationSignal;
  consistentSize: IcebergConsistentSizeSignal;
}

export interface IcebergEstimatedSize {
  visible: number;
  hidden: number;
  total: number;
  multiplier: number;
}

export interface IcebergActiveSignal {
  name: string;
  score: number;
  weight: number;
}

export interface IcebergWeightedContribution {
  signal: string;
  contribution: string;
}

export interface IcebergDetails {
  activeSignals: IcebergActiveSignal[];
  totalScore: number;
  signalCount: number;
  weightedContributions: IcebergWeightedContribution[];
}

export interface IcebergComponent {
  value: number;
  detected: boolean;
  confidence: IcebergConfidence;
  score: number;
  estimatedHiddenSize: IcebergEstimatedSize;
  signals: IcebergSignals;
  details: IcebergDetails;
}

export interface GEXComponent {
  value: number;
  gexMagnitude: number;
  wallStrength: number;
  wallProximity: number;
  totalGEX: number;
}

export interface LiquidityComponent {
  value: number;
  depth: number;
  spread: number;
  imbalance: number;
}

export interface BarrierComponents {
  gex: GEXComponent;
  iceberg: IcebergComponent;
  liquidity: LiquidityComponent;
}

export interface BarrierWeights {
  gex: number;
  iceberg: number;
  liquidity: number;
}

export interface PotentialBarrier {
  total: number;
  components: BarrierComponents;
  weights: BarrierWeights;
  regime: EscapeRegime;
  floor: number;
}

export interface WallInfo {
  type: 'call' | 'put';
  strike: number;
  strength: number;
  distance: number;
  distanceAbs: number;
}

export interface SustainedEnergyComponents {
  bookImbalance: number;
  biPersistence: number;
  spreadQuality: number;
  depthComponent: number;
}

export interface SustainedEnergy {
  score: number;
  components: SustainedEnergyComponents;
}

export interface InjectedEnergy {
  score: number;
  volume5min: number;
  cascadeDetected: boolean;
  dominantSide: ImbalanceDirection;  // Reusing shared type
}

export interface EscapeEnergyData {
  sustained: SustainedEnergy;
  injected: InjectedEnergy;
  total: number;
  classification: BookEnergyLevel;
}

export interface EscapeEnergyResponse {
  success: boolean;
  timestamp: string;
  energy: EscapeEnergyData;
}

export interface EscapeProbabilityComponents {
  sustainedEnergy: number;
  injectedEnergy: number;
  totalEnergy: number;
  potential: PotentialBarrier;
}

export interface EscapeProbabilityData {
  P_escape: number;
  classification: EscapeProbability;
  components: EscapeProbabilityComponents;
  interpretation: string;
}

export interface EscapeProbabilityResponse {
  success: boolean;
  timestamp: string;
  probability: EscapeProbabilityData;
}

export interface EscapeMetrics {
  sustainedEnergy: number;
  injectedEnergy: number;
  totalEnergy: number;
  potential: PotentialBarrier;
  P_escape: number;
  direction: EscapeDirection;
  wallInfo: WallInfo;
}

export interface EscapeDetectionData {
  type: EscapeType;
  confidence: number;
  direction: EscapeDirection;
  timestamp: string;
  interpretation: string;
  metrics: EscapeMetrics;
  conditions: Record<string, any>;
  wallInfo: WallInfo | null;
  rawData: Record<string, any>;
}

export interface EscapeDetectionResponse {
  success: boolean;
  timestamp: string;
  detection: EscapeDetectionData;
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