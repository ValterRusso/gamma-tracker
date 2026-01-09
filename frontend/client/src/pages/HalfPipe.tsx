import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, RefreshCw, Activity, TrendingUp, Shield, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import axios from 'axios';
import HalfPipeVisual from '@/components/HalfPipeVisual';

// Types
interface EscapeDetection {
  type: 'H1' | 'H2' | 'H3' | 'NONE';
  confidence: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  timestamp: string;
  interpretation: string;
  metrics?: {
    sustainedEnergy?: number;
    injectedEnergy?: number;
    totalEnergy?: number;
    potential?: {
      total: number;
      components: {
        gex?: { value: number };
        iceberg?: {
          detected: boolean;
          confidence: string;
          score: number;
          estimatedHiddenSize?: {
            visible: number;
            hidden: number;
            total: number;
          };
          signals?: {
            refillingOrders?: {
              detected: boolean;
              detectedLevels?: Array<{
                price: number;
                avgSize: number;
                occurrences: number;
              }>;
            };
          };
        };
        liquidity?: { value: number };
      };
      regime: string;
      floor: number;
    };
    P_escape?: number;
    direction?: string;
    wallInfo?: {
      type: string;
      strike: number;
      strength: number;
      distance: number;
      distanceAbs: number;
    };
  };
  conditions: any;
  wallInfo: any;
  rawData: any;
}

// Metrics interface for /api/metrics endpoint
interface MetricsData {
  spotPrice:number;
  totalGEX: {
    total: number;
    calls: number;
    puts: number;
    netGamma: string;
  };
  gammaFlip: {
    level: number;
    currentSpot: number; 
    distanceFromSpot: number;
    distancePercent: number;
    confidence: string;    
    nearbyStrikes: number[];    
  };
  putWall: {
    strike: number;
    gex: number;
    oi: number;
    gamma: number;
    distanceFromSpot: number;
    distancePercent: number;
  };
  callWall: {
    strike: number;
    gex?: number;
    oi: number;
    gamma: number;
    distanceFromSpot: number;
    distancePercent: number;
  };
  regime: string;
  timestamp: number;
}

export default function HalfPipe() {
  const [detection, setDetection] = useState<EscapeDetection | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Fetch metrics data (gammaFlip, walls, etc.)
  const fetchMetrics = async () => {
    try {
      console.log('📊 Fetching metrics from /api/metrics...');
      const response = await axios.get('http://localhost:3300/api/metrics', {
        timeout: 5000
      });

      const metricsData = response.data.data;

      console.log('✅ Metrics received:', response.data);

      setMetrics(metricsData);

      return metricsData;

    } catch (err: any) {
      console.warn('⚠️ Failed to fetch metrics:', err.message);
      return null;
    }
  };

  // Fetch detection data
  const fetchDetection = async () => {
    try {
      console.log('Fetching detection data from backend...');
      
      // Fetch detection first
      const detectionResponse = await axios.get('http://localhost:3300/api/escape/detect', { 
        timeout: 5000 
      });
      
      console.log('✅ API Response:', detectionResponse.data);
      console.log('🔍 Full JSON:', JSON.stringify(detectionResponse.data, null, 2));
      
      // Extract detection from response
      const detectionData = detectionResponse.data.detection || detectionResponse.data;
      
      console.log('📊 Detection object:', detectionData);
      console.log('📊 Type:', detectionData?.type);
      console.log('📊 Confidence:', detectionData?.confidence);
      console.log('📊 Metrics:', detectionData?.metrics);
      console.log('📊 P_escape:', detectionData?.metrics?.P_escape);
      
      // Check if detection data exists
      if (!detectionData) {
        console.error('❌ Detection data is null or undefined');
        setError('Invalid response from backend');
        return;
      }
      
      if (!detectionData.type) {
        console.warn('⚠️ Detection type is missing');
      }
      
      setDetection(detectionData);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
      console.log('✅ State updated successfully');
      
      // Fetch metrics in background (non-blocking)
      fetchMetrics().then(metricsData => {
        if (metricsData) {
          console.log('✅ Using REAL metrics data:');
          console.log('  📊 Current Price:', metricsData.spotPrice);
          console.log('  📊 Gamma Flip:', metricsData.gammaFlip.level);
          console.log('  📊 Put Wall:', metricsData.putWall.strike);
          console.log('  📊 Call Wall:', metricsData.callWall.strike);
        }
      });
    } catch (err: any) {
      console.error('Error fetching detection:', err);
      const errorMsg = err.code === 'ECONNABORTED' 
        ? 'Request timeout - backend may be slow or down'
        : err.code === 'ERR_NETWORK'
        ? 'Cannot connect to backend at localhost:3300'
        : `Failed to fetch: ${err.message}`;
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDetection();
  }, []);

  // Auto-refresh every 2 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchDetection();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Detection type styling
  const getDetectionStyle = (type: string) => {
    switch (type) {
      case 'H1':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/50',
          text: 'text-emerald-400',
          icon: TrendingUp,
          label: '🚀 GOOD ESCAPE'
        };
      case 'H2':
        return {
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/50',
          text: 'text-rose-400',
          icon: Shield,
          label: '⚠️ FALSE ESCAPE'
        };
      case 'H3':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/50',
          text: 'text-amber-400',
          icon: Zap,
          label: '⚡ LIQUIDATION CASCADE'
        };
      default:
        return {
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/50',
          text: 'text-cyan-400',
          icon: Activity,
          label: '📊 MONITORING'
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Half Pipe data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <Shield className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={fetchDetection}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!detection) {
    console.log('⚠️ Detection is null, not rendering page');
    return null;
  }
  
  console.log('✅ Rendering page with detection:', detection);

  const detectionStyle = getDetectionStyle(detection.type);
  const DetectionIcon = detectionStyle.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
             
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-bold text-foreground">
                Half Pipe Command Center
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  autoRefresh
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span className="text-sm">Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}</span>
              </button>
              
              <div className="text-sm text-muted-foreground">
                Last update: {lastUpdate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Detection Banner */}
        <Card className={`mb-8 p-6 ${detectionStyle.bg} border-2 ${detectionStyle.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DetectionIcon className={`w-12 h-12 ${detectionStyle.text}`} />
              <div>
                <h2 className={`text-2xl font-bold ${detectionStyle.text} mb-1`}>
                  {detectionStyle.label}
                </h2>
                <p className="text-foreground/80">
                  {detection.interpretation}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-foreground mb-1">
                {(detection.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Confidence</div>
            </div>
          </div>
        </Card>

        {/* Main Grid: Visual + Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* Half Pipe Visual (60% width on desktop) */}
          <div className="lg:col-span-3">
            <Card className="p-6 h-full">
              <h3 className="text-lg font-bold text-foreground mb-4">Half Pipe Visualization</h3>
              {(() => {
                // PRIORITY 1: Use REAL metrics from /api/metrics
                if (metrics?.gammaFlip?.currentSpot && metrics?.putWall?.strike && metrics?.callWall?.strike) {
                  console.log('✅ Using REAL metrics data for visualization');
                  return (
                    <HalfPipeVisual
                      currentPrice={metrics.gammaFlip.currentSpot}
                      putWall={{
                        strike: metrics.putWall.strike,
                        gex: Math.abs(metrics.putWall.gex)
                      }}
                      callWall={{
                        strike: metrics.callWall.strike,
                        gex: metrics.callWall.gex || 1800000
                      }}
                      gammaFlip={metrics.gammaFlip.level}
                      P_escape={detection.metrics?.P_escape ?? 0}
                      detectionType={detection.type}
                      direction={detection.direction}
                    />
                  );
                }
                
                // PRIORITY 2: Fallback to estimated values
                console.log('⚠️ Using ESTIMATED values (metrics not available)');
                const icebergPrice = detection.metrics?.potential?.components?.iceberg?.signals?.refillingOrders?.detectedLevels?.[0]?.price;
                const wallStrike = detection.metrics?.wallInfo?.strike;
                const currentPrice = detection.rawData?.currentPrice || 
                                   detection.conditions?.currentPrice ||
                                   icebergPrice ||
                                   (wallStrike ? wallStrike - 133 : 88000);
                
                const putWall = detection.wallInfo?.putWall || {
                  strike: Math.floor(currentPrice * 0.97),
                  gex: 1500000
                };
                
                const callWall = detection.wallInfo?.callWall ||
                  (detection.metrics?.wallInfo?.type === 'call' && wallStrike ? {
                    strike: wallStrike,
                    gex: Math.abs(detection.metrics.wallInfo.strength || 0) * 1000000 || 1800000
                  } : {
                    strike: Math.ceil(currentPrice * 1.03),
                    gex: 1800000
                  });
                
                const gammaFlip = detection.rawData?.gammaFlip ||
                                detection.conditions?.gammaFlip ||
                                Math.floor(currentPrice * 0.995);
                
                return (
                  <HalfPipeVisual
                    currentPrice={currentPrice}
                    putWall={putWall}
                    callWall={callWall}
                    gammaFlip={gammaFlip}
                    P_escape={detection.metrics?.P_escape ?? 0}
                    detectionType={detection.type}
                    direction={detection.direction}
                  />
                );
              })()}
            </Card>
          </div>

          {/* Metrics Panel (40% width on desktop) */}
          <div className="lg:col-span-2">
            <Card className="p-6 h-full">
              <h3 className="text-lg font-bold text-foreground mb-4">Key Metrics</h3>
              
              <div className="space-y-4">
                {/* P_escape */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">P_escape</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">
                      {((detection.metrics?.P_escape ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(detection.metrics?.P_escape ?? 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Total Energy */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Energy</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      {(detection.metrics?.totalEnergy ?? 0).toFixed(3)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-emerald-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((detection.metrics?.totalEnergy ?? 0) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Potential */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Potential</span>
                    <span className="text-lg font-mono font-bold text-rose-400">
                      {(detection.metrics?.potential?.total ?? 0).toFixed(3)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-rose-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((detection.metrics?.potential?.total ?? 0) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Sustained Energy */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Sustained Energy</span>
                    <span className="text-lg font-mono font-bold text-foreground">
                      {(detection.metrics?.sustainedEnergy ?? 0).toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Injected Energy */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Injected Energy</span>
                    <span className="text-lg font-mono font-bold text-foreground">
                      {(detection.metrics?.injectedEnergy ?? 0).toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Direction */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Direction</span>
                    <span className={`text-lg font-bold ${
                      detection.direction === 'UP' ? 'text-emerald-400' :
                      detection.direction === 'DOWN' ? 'text-rose-400' :
                      'text-muted-foreground'
                    }`}>
                      {detection.direction}
                    </span>
                  </div>
                </div>

                {/* Regime */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Regime</span>
                    <span className="text-sm font-mono text-amber-400">
                      {detection.metrics?.potential?.regime ?? 'UNKNOWN'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Iceberg Detection Card */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Iceberg Detection
            </h3>
            
            {detection.metrics?.potential?.components?.iceberg?.detected ? (
              <div>
                <div className="text-3xl font-mono font-bold text-cyan-400 mb-2">
                  {((detection.metrics?.potential?.components?.iceberg?.score ?? 0) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground mb-4">
                  {detection.metrics?.potential?.components?.iceberg?.confidence ?? 'UNKNOWN'} confidence
                </div>
                
                {detection.metrics?.potential?.components?.iceberg?.estimatedHiddenSize && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Visible:</span>
                      <span className="font-mono text-foreground">
                        {detection.metrics?.potential?.components?.iceberg?.estimatedHiddenSize?.visible?.toFixed(1) ?? '0.0'} BTC
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hidden:</span>
                      <span className="font-mono text-cyan-400">
                        {detection.metrics?.potential?.components?.iceberg?.estimatedHiddenSize?.hidden?.toFixed(1) ?? '0.0'} BTC
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-foreground">Total:</span>
                      <span className="font-mono text-foreground">
                        {detection.metrics?.potential?.components?.iceberg?.estimatedHiddenSize?.total?.toFixed(1) ?? '0.0'} BTC
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No iceberg detected</p>
              </div>
            )}
          </Card>

          {/* Regime Card */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              Market Regime
            </h3>
            
            <div className="text-2xl font-mono font-bold text-amber-400 mb-4">
              {detection.metrics?.potential?.regime ?? 'UNKNOWN'}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">GEX Weight:</span>
                <span className="font-mono text-foreground">
                  {detection.metrics?.potential?.components?.gex?.value 
                    ? `${(detection.metrics.potential.components.gex.value * 100).toFixed(0)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iceberg Weight:</span>
                <span className="font-mono text-foreground">
                  {detection.metrics?.potential?.components?.iceberg
                    ? `${(detection.metrics.potential.components.iceberg.score * 100).toFixed(0)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Liquidity Weight:</span>
                <span className="font-mono text-foreground">
                  {detection.metrics?.potential?.components?.liquidity?.value
                    ? `${(detection.metrics.potential.components.liquidity.value * 100).toFixed(0)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">Floor:</span>
                <span className="font-mono text-foreground">
                  {(detection.metrics?.potential?.floor ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </Card>

          {/* Time-Out-of-Zone Card (Placeholder) */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-rose-400" />
              Time-Out-of-Zone
            </h3>
            
            <div className="text-center py-8">
              <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Coming soon</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                TOZ tracking not yet implemented
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}