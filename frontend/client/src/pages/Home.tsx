import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown, Target, Shield, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, ReferenceArea } from "recharts";
import axios from "axios";

// Backend API URL
const API_BASE_URL = "http://localhost:3300/api";

interface WallZone {
  peak: number;
  peakGEX: number;
  zoneLow: number;
  zoneHigh: number;
  zoneWidth: number;
  strikeCount: number;
  totalZoneGEX: number;
  threshold: number;
  zoneStrikes: Array<{ strike: number; gex: number; percentage: number }>;
  distanceFromSpot: { peak: number; zoneLow: number; zoneHigh: number };
  distancePercent: { peak: number; zoneLow: number; zoneHigh: number };

  
}


interface Metrics {
  totalGEX: { total: number; calls: number; puts: number; netGamma: string };
  gammaFlip: { level: number; currentSpot: number; distancePercent: number; confidence: string };
  walls: {
    putWall: { strike: number; gex: number; distancePercent: number };
    callWall: { strike: number; gex: number; distancePercent: number };
  };
  wallZones: {
    spotPrice: number;
    putWallZone: WallZone | null;
    callWallZone: WallZone | null;
  }
  insights: {
    regime: {
      regime: string;
      description: string;
      implications: string[];
      volatilityExpectation: string;
    };
    distribution: {
      significantLevels: Array<{
        strike: number;
        gex: number;
        distancePercent: number;
        type: string;
      }>;
    };
  };
  gammaProfile: Array<{ strike: number; totalGEX: number; callGEX: number; putGEX: number }>;
}

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      const [totalGEX, gammaFlip, walls, wallZones, insights, gammaProfile] = await Promise.all([
        axios.get(`${API_BASE_URL}/total-gex`),
        axios.get(`${API_BASE_URL}/gamma-flip`),
        axios.get(`${API_BASE_URL}/walls`),
        axios.get(`${API_BASE_URL}/wall-zones`),
        axios.get(`${API_BASE_URL}/insights`),
        axios.get(`${API_BASE_URL}/gamma-profile`),
      ]);

      setMetrics({
        totalGEX: totalGEX.data.data,
        gammaFlip: gammaFlip.data.data,
        walls: walls.data.data,
        wallZones: wallZones.data.data,
        insights: insights.data.data,
        gammaProfile: gammaProfile.data.data,
      });
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Gamma Tracker...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getRegimeColor = (regime: string) => {
    if (regime.includes("POSITIVE_GAMMA_ABOVE")) return "text-emerald-400";
    if (regime.includes("POSITIVE_GAMMA_BELOW")) return "text-amber-400";
    if (regime.includes("NEGATIVE_GAMMA")) return "text-rose-400";
    return "text-gray-400";
  };

  const getVolatilityColor = (vol: string) => {
    if (vol === "LOW") return "text-emerald-400";
    if (vol === "MEDIUM") return "text-amber-400";
    if (vol === "HIGH") return "text-rose-400";
    return "text-gray-400";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Gamma Tracker</h1>
              <p className="text-sm text-muted-foreground">
                Real-time Options Market Analysis
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Last Update</p>
              <p className="text-sm font-mono">{lastUpdate.toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total GEX */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${
                  metrics.totalGEX.netGamma === "POSITIVE"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}
              >
                {metrics.totalGEX.netGamma}
              </span>
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">Total GEX</h3>
            <p className="text-3xl font-bold font-mono number-animate">
              {formatCurrency(metrics.totalGEX.total)}
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-muted-foreground">Calls:</span>
                <span className="font-mono text-emerald-400">
                  {formatCurrency(metrics.totalGEX.calls)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-400" />
                <span className="text-muted-foreground">Puts:</span>
                <span className="font-mono text-rose-400">
                  {formatCurrency(metrics.totalGEX.puts)}
                </span>
              </div>
            </div>
          </Card>

          {/* Gamma Flip */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Target className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-cyan-500/10 text-cyan-400">
                {metrics.gammaFlip.confidence}
              </span>
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">Gamma Flip</h3>
            <p className="text-3xl font-bold font-mono number-animate">
              ${formatNumber(metrics.gammaFlip.level)}
            </p>
            <div className="mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Spot:</span>
                <span className="font-mono">${formatNumber(metrics.gammaFlip.currentSpot)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Distance:</span>
                <span
                  className={`font-mono ${
                    metrics.gammaFlip.distancePercent > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {metrics.gammaFlip.distancePercent > 0 ? "+" : ""}
                  {metrics.gammaFlip.distancePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>

          {/* Put Wall */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Shield className="w-5 h-5 text-rose-400" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-rose-500/10 text-rose-400">
                SUPPORT
              </span>
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">Put Wall</h3>
            <p className="text-3xl font-bold font-mono number-animate">
              ${formatNumber(metrics.walls.putWall.strike)}
            </p>
            <div className="mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">GEX:</span>
                <span className="font-mono text-rose-400">
                  {formatCurrency(metrics.walls.putWall.gex)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-mono text-rose-400">
                  {metrics.walls.putWall.distancePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>

          {/* Call Wall */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
                RESISTANCE
              </span>
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">Call Wall</h3>
            <p className="text-3xl font-bold font-mono number-animate">
              ${formatNumber(metrics.walls.callWall.strike)}
            </p>
            <div className="mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">GEX:</span>
                <span className="font-mono text-emerald-400">
                  {formatCurrency(metrics.walls.callWall.gex)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-mono text-emerald-400">
                  +{metrics.walls.callWall.distancePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Gamma Profile Chart */}
        <Card className="p-6 bg-card border-border">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Gamma Exposure Profile</h2>
            <p className="text-sm text-muted-foreground">
              Distribution of gamma exposure across strikes
            </p>
          </div>
          <div className="h-100">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.gammaProfile}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                <XAxis
                  dataKey="strike"
                  type="number"
                  scale="linear"
                  domain={["dataMin", "dataMax"]}
                  stroke="oklch(0.65 0.015 286.067)"
                  tick={{ fill: "oklch(0.65 0.015 286.067)", fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
                />
                <YAxis
                  stroke="oklch(0.65 0.015 286.067)"
                  tick={{ fill: "oklch(0.65 0.015 286.067)", fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "oklch(0.16 0.006 285.885)",
                    border: "1px solid oklch(1 0 0 / 8%)",
                    borderRadius: "8px",
                    color: "oklch(0.95 0.005 65)",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "GEX"]}
                  labelFormatter={(label) => `Strike: $${label.toLocaleString()}`}
                />
                <ReferenceLine
                  y={0}
                  stroke="oklch(0.65 0.015 286.067)"
                  strokeDasharray="3 3"
                />                
                <ReferenceLine
                  x={metrics.gammaFlip.level}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{
                    value: "Gamma Flip",
                    position: "top",
                    fill: "oklch(0.488 0.243 264.376)",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                />
                {/* Put Wall Zone (support) */}
                {metrics.wallZones.putWallZone && (
                  <ReferenceArea
                    x1={metrics.wallZones.putWallZone.zoneLow}
                    x2={metrics.wallZones.putWallZone.zoneHigh}
                    fill="oklch(0.7 0.2 10)"
                    fillOpacity={0.2}
                    stroke="oklch(0.7 0.2 10)"
                    strokeWidth={2}
                    strokeOpacity={0.5}
                    label={{
                      value: `Put Zone`,
                      position: "insideBottom",
                      fill: "oklch(0.7 0.2 10)",
                      fontSize: 11,
                      angle: -45
                    }}
                  />
                )}
                {/* Call Wall Zone (resistence) */}
                {metrics.wallZones.callWallZone && (
                  <ReferenceArea
                  x1={metrics.wallZones.callWallZone.zoneLow}
                  x2={metrics.wallZones.callWallZone.zoneHigh}
                  fill="green"
                  fillOpacity={0.2}
                  stroke="green"
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  label={{
                    value: `Call Zone`,
                    position: "insideBottom",
                    fill: "green",
                    fontSize: 11,
                    angle:-45
                  }}
                  />
                )}               
                
                <Bar dataKey="totalGEX" radius={[4, 4, 0, 0]}>
                  {metrics.gammaProfile.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.totalGEX > 0 ? "oklch(0.7 0.2 150)" : "oklch(0.7 0.2 10)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Regime Analysis & Significant Levels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market Regime */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Market Regime</h2>
                <p className="text-sm text-muted-foreground">
                  {metrics.insights.regime.description}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Regime Type</span>
                  <span
                    className={`text-sm font-semibold ${getRegimeColor(
                      metrics.insights.regime.regime
                    )}`}
                  >
                    {metrics.insights.regime.regime.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Volatility Expectation</span>
                  <span
                    className={`text-sm font-semibold ${getVolatilityColor(
                      metrics.insights.regime.volatilityExpectation
                    )}`}
                  >
                    {metrics.insights.regime.volatilityExpectation}
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold mb-2">Implications</h3>
                <ul className="space-y-2">
                  {metrics.insights.regime.implications.map((implication, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{implication}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Significant Levels */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-bold mb-4">Significant Levels</h2>
            <div className="space-y-2">
              {metrics.insights.distribution.significantLevels.slice(0, 8).map((level, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <span className="font-mono font-semibold">
                      ${level.strike.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-mono ${
                        level.type === "POSITIVE" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(level.gex)}
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        level.distancePercent > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {level.distancePercent > 0 ? "+" : ""}
                      {level.distancePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
