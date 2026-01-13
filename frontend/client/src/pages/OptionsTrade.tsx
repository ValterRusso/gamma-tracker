import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, FolderOpen, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Types
interface OptionData {
  symbol: string;
  underlying: string;
  strike: number;
  expiryDate: number;
  side: 'CALL' | 'PUT';
  contractSize: number;
  markPrice: number;
  markIV: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  openInterest: number;
  volume: number;
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  lastUpdate: number;
}

interface Leg {
  symbol: string;
  underlying: string;
  strike: number;
  expiryDate: number;
  side: 'CALL' | 'PUT';
  action: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface PositionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface PositionAnalysis {
  pnlCurve: { price: number; pnl: number }[];
  greeks: PositionGreeks;
  totalCost: number;
  breakevens: number[];
  maxProfit: number;
  maxLoss: number;
}

const OptionsTrade: React.FC = () => {
  const [, setLocation] = useLocation();
  
  // State
  const [availableOptions, setAvailableOptions] = useState<OptionData[]>([]);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [selectedOption, setSelectedOption] = useState<OptionData | null>(null);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<number>(1);
  const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterExpiry, setFilterExpiry] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMoneyness, setFilterMoneyness] = useState<string>('all');

  // Fetch available options on mount
  useEffect(() => {
    fetchAvailableOptions();
  }, []);

  // Recalculate position when legs change
  useEffect(() => {
    if (legs.length > 0) {
      calculatePosition();
    } else {
      setAnalysis(null);
    }
  }, [legs]);

  // ============================================================================
  // API CALLS
  // ============================================================================

  const fetchAvailableOptions = async () => {
    try {
      const response = await fetch('http://localhost:3300/api/options');
      const data = await response.json();
      
      if (data.success) {
        setAvailableOptions(data.data);
      } else {
        setError('Failed to fetch options data');
      }
    } catch (err) {
      console.error('Error fetching options:', err);
      setError('Failed to fetch options data');
    }
  };

  // ============================================================================
  // FILTER LOGIC
  // ============================================================================

  // Get unique expiry dates
  const getUniqueExpiries = (): string[] => {
    const expiries = availableOptions.map(opt => opt.expiryDate);
    const uniqueExpiries = Array.from(new Set(expiries)).sort((a, b) => a - b);
    return uniqueExpiries.map(exp => exp.toString());
  };

  // Determine moneyness (ITM/ATM/OTM)
  const getMoneyness = (option: OptionData, spotPrice: number): string => {
    const { strike, side } = option;
    const priceDiff = Math.abs(spotPrice - strike);
    const percentDiff = priceDiff / spotPrice;

    // ATM if within 2% of spot
    if (percentDiff < 0.02) return 'ATM';

    if (side === 'CALL') {
      return spotPrice > strike ? 'ITM' : 'OTM';
    } else {
      return spotPrice < strike ? 'ITM' : 'OTM';
    }
  };

  // Apply filters to options
  const filteredOptions = availableOptions.filter(option => {
    // Expiry filter
    if (filterExpiry !== 'all' && option.expiryDate.toString() !== filterExpiry) {
      return false;
    }

    // Type filter
    if (filterType !== 'all' && option.side !== filterType) {
      return false;
    }

    // Moneyness filter (approximate spot price from options)
    if (filterMoneyness !== 'all') {
      // Estimate spot price from ATM options
      const atmOptions = availableOptions.filter(opt => 
        opt.side === 'CALL' && opt.delta && Math.abs(opt.delta - 0.5) < 0.1
      );
      const spotPrice = atmOptions.length > 0 
        ? atmOptions[0].strike 
        : 94000; // fallback
      
      const moneyness = getMoneyness(option, spotPrice);
      if (moneyness !== filterMoneyness) {
        return false;
      }
    }

    return true;
  });

  // Reset filters
  const handleResetFilters = () => {
    setFilterExpiry('all');
    setFilterType('all');
    setFilterMoneyness('all');
  };

  const calculatePosition = async () => {
    if (legs.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3300/api/positions/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ legs }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.data);
      } else {
        setError(data.error || 'Failed to calculate position');
      }
    } catch (err) {
      console.error('Error calculating position:', err);
      setError('Failed to calculate position');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleAddLeg = () => {
    if (!selectedOption) {
      setError('Please select an option first');
      return;
    }

    const newLeg: Leg = {
      symbol: selectedOption.symbol,
      underlying: selectedOption.underlying,
      strike: selectedOption.strike,
      expiryDate: selectedOption.expiryDate,
      side: selectedOption.side,
      action,
      quantity,
      entryPrice: selectedOption.markPrice,
      delta: selectedOption.delta,
      gamma: selectedOption.gamma,
      theta: selectedOption.theta,
      vega: selectedOption.vega,
    };

    setLegs([...legs, newLeg]);
    setSelectedOption(null);
    setQuantity(1);
    setError(null);
  };

  const handleRemoveLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setLegs([]);
    setAnalysis(null);
    setError(null);
  };

  const handleSavePosition = () => {
    const positionName = prompt('Enter position name:');
    if (!positionName) return;

    const savedPositions = JSON.parse(localStorage.getItem('savedPositions') || '{}');
    savedPositions[positionName] = {
      legs,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('savedPositions', JSON.stringify(savedPositions));
    alert(`Position "${positionName}" saved!`);
  };

  const handleLoadPosition = () => {
    const savedPositions = JSON.parse(localStorage.getItem('savedPositions') || '{}');
    const names = Object.keys(savedPositions);
    
    if (names.length === 0) {
      alert('No saved positions found');
      return;
    }

    const positionName = prompt(`Enter position name to load:\n${names.join('\n')}`);
    if (!positionName || !savedPositions[positionName]) {
      alert('Position not found');
      return;
    }

    setLegs(savedPositions[positionName].legs);
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined || isNaN(price)) {
      return '$0';
    }
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (timestamp: number | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatGreek = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    return value.toFixed(decimals);
  };

  const getGreekColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return 'text-gray-400';
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#0a0e27] text-gray-100 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation('/')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              Options Trade
            </h1>
            <p className="text-gray-400 mt-1">Build and analyze options positions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSavePosition}
            disabled={legs.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={handleLoadPosition}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-2 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Load
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Position Builder */}
      <div className="mb-6 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-white">Add Leg</h2>
        
        {/* Filters */}
        <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">Filters</h3>
            <button
              onClick={handleResetFilters}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Reset All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Expiry Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Expiry Date
              </label>
              <select
                value={filterExpiry}
                onChange={(e) => setFilterExpiry(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Expiries</option>
                {getUniqueExpiries().map((expiry) => (
                  <option key={expiry} value={expiry}>
                    {formatDate(parseInt(expiry))}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Option Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Types</option>
                <option value="CALL">Calls Only</option>
                <option value="PUT">Puts Only</option>
              </select>
            </div>

            {/* Moneyness Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Moneyness
              </label>
              <select
                value={filterMoneyness}
                onChange={(e) => setFilterMoneyness(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All</option>
                <option value="ITM">ITM (In The Money)</option>
                <option value="ATM">ATM (At The Money)</option>
                <option value="OTM">OTM (Out of The Money)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Option Selector */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Select Option
            </label>
            <select
              value={selectedOption?.symbol || ''}
              onChange={(e) => {
                const option = filteredOptions.find(opt => opt.symbol === e.target.value);
                setSelectedOption(option || null);
              }}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Select an option... ({filteredOptions.length} available)</option>
              {filteredOptions.map((option) => (
                <option key={option.symbol} value={option.symbol}>
                  {option.underlying} {formatPrice(option.strike)} {option.side} - {formatDate(option.expiryDate)} - ${option.markPrice.toFixed(0)}
                </option>
              ))}
            </select>
            {selectedOption && (
              <div className="mt-2 text-sm text-gray-400">
                IV: {(selectedOption.markIV * 100).toFixed(1)}% | 
                Delta: {formatGreek(selectedOption.delta, 3)} | 
                Gamma: {formatGreek(selectedOption.gamma, 5)} | 
                Theta: {formatGreek(selectedOption.theta, 2)} | 
                Vega: {formatGreek(selectedOption.vega, 2)}
              </div>
            )}
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'buy' | 'sell')}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleAddLeg}
            disabled={!selectedOption}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Leg
          </button>
          <button
            onClick={handleClearAll}
            disabled={legs.length === 0}
            className="px-6 py-2 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-700 disabled:cursor-not-allowed text-red-400 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Legs Table */}
      {legs.length > 0 && (
        <div className="mb-6 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Position Legs</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Symbol</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Strike</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Expiry</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Action</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Qty</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Price</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Cost</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg, index) => {
                  const cost = leg.action === 'buy' ? -leg.entryPrice * leg.quantity : leg.entryPrice * leg.quantity;
                  return (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-4 text-gray-300">{index + 1}</td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-sm">{leg.symbol}</td>
                      <td className="py-3 px-4 text-gray-300">{formatPrice(leg.strike)}</td>
                      <td className="py-3 px-4 text-gray-300">{formatDate(leg.expiryDate)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          leg.side === 'CALL' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                        }`}>
                          {leg.side}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          leg.action === 'buy' ? 'bg-blue-900/30 text-blue-400' : 'bg-orange-900/30 text-orange-400'
                        }`}>
                          {leg.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">{leg.quantity}</td>
                      <td className="py-3 px-4 text-right text-gray-300">${leg.entryPrice.toFixed(0)}</td>
                      <td className={`py-3 px-4 text-right font-medium ${cost < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatPrice(cost)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleRemoveLeg(index)}
                          className="p-1 hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Greeks Summary */}
      {analysis && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">Delta</div>
            <div className={`text-2xl font-bold ${getGreekColor(analysis.greeks.delta)}`}>
              {formatGreek(analysis.greeks.delta, 3)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.abs(analysis.greeks.delta) < 0.1 ? 'Neutral' : analysis.greeks.delta > 0 ? 'Bullish' : 'Bearish'}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">Gamma</div>
            <div className={`text-2xl font-bold ${getGreekColor(analysis.greeks.gamma)}`}>
              {formatGreek(analysis.greeks.gamma, 5)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {Math.abs(analysis.greeks.gamma) > 0.001 ? 'High' : 'Low'}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">Theta</div>
            <div className={`text-2xl font-bold ${getGreekColor(analysis.greeks.theta)}`}>
              {formatGreek(analysis.greeks.theta, 2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {analysis.greeks.theta < 0 ? 'Bleeding' : 'Earning'}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">Vega</div>
            <div className={`text-2xl font-bold ${getGreekColor(analysis.greeks.vega)}`}>
              {formatGreek(analysis.greeks.vega, 2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {analysis.greeks.vega > 0 ? 'Long Vol' : 'Short Vol'}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">Total Cost</div>
            <div className={`text-2xl font-bold ${analysis.totalCost < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatPrice(analysis.totalCost)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {analysis.totalCost < 0 ? 'Debit' : 'Credit'}
            </div>
          </div>
        </div>
      )}

      {/* Position Summary */}
      {analysis && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Position Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Max Profit</div>
              <div className="text-lg font-semibold text-green-400">
                {analysis.maxProfit === Infinity || analysis.maxProfit === 'Infinity' ? 'Unlimited' : formatPrice(analysis.maxProfit)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 mb-1">Max Loss</div>
              <div className="text-lg font-semibold text-red-400">
                {formatPrice(analysis.maxLoss)}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-sm text-gray-400 mb-1">Breakevens</div>
              <div className="text-lg font-semibold text-gray-300">
                {analysis.breakevens.length > 0
                  ? analysis.breakevens.map(be => formatPrice(be)).join(', ')
                  : 'None'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* P&L Chart */}
      {analysis && analysis.pnlCurve && analysis.pnlCurve.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 text-white">P&L Visualization</h2>
          
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.pnlCurve}>
                <defs>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="price" 
                  stroke="#94a3b8"
                  tickFormatter={(val) => formatPrice(val)}
                />
                <YAxis 
                  stroke="#94a3b8"
                  tickFormatter={(val) => formatPrice(val)}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatPrice(value), 'P&L']}
                  labelFormatter={(label) => `Spot: ${formatPrice(label)}`}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                
                {/* Breakeven markers */}
                {analysis.breakevens.map((be, idx) => (
                  <ReferenceLine 
                    key={`be-${idx}`}
                    x={be} 
                    stroke="#f59e0b" 
                    strokeDasharray="5 5"
                    label={{
                      value: 'BE',
                      position: 'top',
                      fill: '#f59e0b',
                      fontSize: 12
                    }}
                  />
                ))}
                
                {/* P&L Area - Split into profit and loss */}
                <Area
                  type="monotone"
                  dataKey={(data: { pnl: number }) => data.pnl > 0 ? data.pnl : 0}
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#profitGradient)"
                />
                <Area
                  type="monotone"
                  dataKey={(data: { pnl: number }) => data.pnl < 0 ? data.pnl : 0}
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#lossGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Profit Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Loss Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span>Breakeven</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          Calculating position...
        </div>
      )}

      {/* Empty State */}
      {legs.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No legs added yet</p>
          <p className="text-sm mt-2">Select an option above to start building your position</p>
        </div>
      )}
    </div>
  );
};

export default OptionsTrade;
