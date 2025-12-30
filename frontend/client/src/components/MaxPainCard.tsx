import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import axios from "axios";

const API_BASE_URL = "http://localhost:3300/api";

interface MaxPainData {
  maxPainStrike: number;
  maxPainOI: number;
  maxPainCallOI: number;
  maxPainPutOI: number;
  spotPrice: number;
  analysis: {
    distance: number;
    distancePct: number;
    interpretation: string;
  };
}

export default function MaxPainCard() {
  const [data, setData] = useState<MaxPainData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMaxPain = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/max-pain`);
      setData(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching max pain:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaxPain();
    const interval = setInterval(fetchMaxPain, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Loading Max Pain...</p>
        </div>
      </Card>
    );
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const isPriceAboveMaxPain = data.spotPrice > data.maxPainStrike;

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Target className="w-5 h-5 text-purple-400" />
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded ${
            isPriceAboveMaxPain
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-rose-500/10 text-rose-400"
          }`}
        >
          {isPriceAboveMaxPain ? "BULLISH PRESSURE" : "BEARISH PRESSURE"}
        </span>
      </div>
      
      <h3 className="text-sm text-muted-foreground mb-1">Max Pain</h3>
      <p className="text-3xl font-bold font-mono number-animate">
        ${formatNumber(data.maxPainStrike)}
      </p>
      
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total OI:</span>
          <span className="font-mono">{formatNumber(data.maxPainOI)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-muted-foreground">Call OI:</span>
          </div>
          <span className="font-mono text-emerald-400">
            {formatNumber(data.maxPainCallOI)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-rose-400" />
            <span className="text-muted-foreground">Put OI:</span>
          </div>
          <span className="font-mono text-rose-400">
            {formatNumber(data.maxPainPutOI)}
          </span>
        </div>
        
        <div className="pt-2 mt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Distance:</span>
            <span
              className={`font-mono font-semibold ${
                data.analysis.distancePct > 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {data.analysis.distancePct > 0 ? "+" : ""}
              {data.analysis.distancePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {data.analysis.interpretation}
        </p>
      </div>
    </Card>
  );
}
