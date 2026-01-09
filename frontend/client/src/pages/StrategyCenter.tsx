// ============================================================================
// STRATEGY CENTER PAGE
// ============================================================================

import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, RefreshCw, Filter, TrendingUp } from 'lucide-react';
import { useStrategyRecommendations } from '../hooks/useStrategies';
import MarketStateCard from '../components/strategies/MarketStateCard';
import StrategyCard from '../components/strategies/StrategyCard';
import type { StrategyRecommendation } from '../types/api';

export default function StrategyCenter() {
  const {
    recommendations,
    marketState,
    loading,
    error,
    refetch,
    timestamp
  } = useStrategyRecommendations();

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRecommendation | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');

  // Filter strategies
  const filteredStrategies = (recommendations || []).filter(strategy => {
    if (filterCategory === 'ALL') return true;
    return strategy.category === filterCategory;
  });

  // Sort strategies
  const sortedStrategies = [...filteredStrategies].sort((a, b) => {
    if (sortBy === 'score') {
      return b.score - a.score; // Descending
    } else {
      return a.name.localeCompare(b.name); // Alphabetical
    }
  });

  // Loading state
  if (loading && recommendations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading strategies...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && recommendations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">            
            
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="font-medium">Refresh</span>
            </button>
          </div>

          {timestamp && (
            <div className="text-sm text-slate-400">
              Last updated: {new Date(timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              Strategy Center
            </h1>
            <p className="text-slate-400">
              Option strategies recommended based on current market conditions
            </p>
          </div>
        </div>
      </div>

      {/* Market State */}
      {marketState && (
        <div className="mb-6">
          <MarketStateCard state={marketState} />
        </div>
      )}

      {/* Filters and Stats */}
      <div className="mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Filter by Category */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400 font-medium">Category:</span>
              <div className="flex gap-2">
                {['ALL', 'DIRECTIONAL', 'NEUTRAL', 'VOLATILITY'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${filterCategory === cat 
                        ? 'bg-cyan-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }
                    `}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 font-medium">Sort by:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('score')}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${sortBy === 'score' 
                      ? 'bg-cyan-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }
                  `}
                >
                  Score
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${sortBy === 'name' 
                      ? 'bg-cyan-600 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }
                  `}
                >
                  Name
                </button>
              </div>
            </div>

            {/* Count */}
            <div className="text-sm text-slate-400">
              Showing <span className="font-semibold text-slate-200">{sortedStrategies.length}</span> of{' '}
              <span className="font-semibold text-slate-200">{recommendations.length}</span> strategies
            </div>
          </div>
        </div>
      </div>

      {/* Strategies Grid */}
      {sortedStrategies.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedStrategies.map(strategy => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              onClick={() => setSelectedStrategy(strategy)}
              showScore={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">
            No strategies match your filters
          </p>
        </div>
      )}

      {/* Strategy Detail Modal (Simple version - can be enhanced) */}
      {selectedStrategy && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          onClick={() => setSelectedStrategy(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">
                  {selectedStrategy.namePt || selectedStrategy.name}
                </h2>
                <p className="text-slate-400">{selectedStrategy.description}</p>
              </div>
              <button
                onClick={() => setSelectedStrategy(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <StrategyCard strategy={selectedStrategy} showScore={true} />

            {/* When to Use */}
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-3">
                When to Use
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.whenToUse.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* When to Avoid */}
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">
                When to Avoid
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.whenToAvoid.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* TODO: Add "Send to Beholder" button here */}
          </div>
        </div>
      )}
    </div>
  );
}
