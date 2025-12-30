import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const API_BASE_URL = "http://localhost:3300/api";

interface SentimentData {
  sentiment: string;
  putCallOIRatio: number;
  putCallVolRatio: number;
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
  divergence?: {
    exists?: boolean;
    description?: string;
  };
}

export default function SentimentCard() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSentiment = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sentiment`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sentiment:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Loading Sentiment...</p>
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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "VERY_BULLISH":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
      case "BULLISH":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "NEUTRAL":
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
      case "BEARISH":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "VERY_BEARISH":
        return "bg-rose-500/20 text-rose-300 border-rose-500/50";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment.includes("BULLISH")) {
      return <TrendingUp className="w-4 h-4" />;
    } else if (sentiment.includes("BEARISH")) {
      return <TrendingDown className="w-4 h-4" />;
    }
    return <Minus className="w-4 h-4" />;
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm text-muted-foreground">Market Sentiment</h3>
        <Badge className={`${getSentimentColor(data.sentiment)} flex items-center gap-1 px-3 py-1`}>
          {getSentimentIcon(data.sentiment)}
          <span className="font-semibold">{data.sentiment.replace("_", " ")}</span>
        </Badge>
      </div>

      <div className="space-y-4">
        {/* P/C Ratios */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">P/C OI Ratio:</span>
            <span className="font-mono font-semibold">{formatNumber(data.putCallOIRatio)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">P/C Vol Ratio:</span>
            <span className="font-mono font-semibold">{formatNumber(data.putCallVolRatio)}</span>
          </div>
        </div>

        {/* OI Breakdown */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-muted-foreground">Call OI:</span>
            </div>
            <span className="font-mono text-emerald-400">
              {formatNumber(data.totalCallOI)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <span className="text-muted-foreground">Put OI:</span>
            </div>
            <span className="font-mono text-rose-400">
              {formatNumber(data.totalPutOI)}
            </span>
          </div>
        </div>

        {/* Volume Breakdown */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Call Volume:</span>
            <span className="font-mono">{formatNumber(data.totalCallVolume)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Put Volume:</span>
            <span className="font-mono">{formatNumber(data.totalPutVolume)}</span>
          </div>
        </div>

        {/* Divergence Alert */}
        {data.divergence?.exists && data.divergence?.description && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-400 leading-relaxed">
              ⚠️ {data.divergence.description}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
