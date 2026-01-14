import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, FolderOpen, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  ComposedChart,
  AreaChart,
  Area,
  Line,
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
  timeCurves?: Array<{
    name: string;
    daysToExpiry: number;
    color: string;
    dash?: boolean;
    data: { price: number; pnl: number }[];
  }>;
}

interface GreeksEvolutionData {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
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

  // Current spot price (fetched from API)
  const [currentSpot, setCurrentSpot] = useState<number | null>(null);
  
  // Templates modal
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplateExpiry, setSelectedTemplateExpiry] = useState<string | null>(null);
  
  // Greeks Evolution data
  const [greeksEvolution, setGreeksEvolution] = useState<GreeksEvolutionData[]>([]);

  // Fetch available options and spot price on mount
  useEffect(() => {
    fetchAvailableOptions();
    fetchCurrentSpot();
  }, []);

  // Fetch current spot price
  const fetchCurrentSpot = async () => {
    // Prevent multiple fetches
    if (currentSpot !== null) {
      console.log('[OptionsTrade] Spot already loaded, skipping fetch');
      return;
    }

    try {
      const response = await fetch('http://localhost:3300/api/binance/stats');
      const data = await response.json();
      
      if (data.success && data.data.spotPrice) {
        const spot = parseFloat(data.data.spotPrice);
        console.log('[OptionsTrade] Current spot price loaded:', spot);
        setCurrentSpot(spot);
      } else {
        console.warn('[OptionsTrade] Spot price not found in API response');
      }
    } catch (err) {
      console.error('[OptionsTrade] Error fetching spot price:', err);
      // Fallback: estimate from ATM options
      setTimeout(() => {
        if (currentSpot === null) { // Only if still not loaded
          const atmOptions = availableOptions.filter(opt => 
            opt.side === 'CALL' && opt.delta && Math.abs(opt.delta - 0.5) < 0.1
          );
          if (atmOptions.length > 0) {
            const estimatedSpot = atmOptions[0].strike;
            console.log('[OptionsTrade] Using ATM strike as spot estimate:', estimatedSpot);
            setCurrentSpot(estimatedSpot);
          } else {
            console.warn('[OptionsTrade] Could not estimate spot price from options');
          }
        }
      }, 1000); // Wait for options to load
    }
  };

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
        body: JSON.stringify({ 
          legs,
          config: {
            includeTimeCurves: true  // Request time curves
          }
        }),
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
  // GREEKS EVOLUTION CALCULATION
  // ============================================================================
  
  const calculateGreeksEvolution = () => {
    if (legs.length === 0 || !currentSpot) {
      setGreeksEvolution([]);
      return;
    }
    
    // Calculate current position Greeks (weighted sum)
    const positionGreeks = legs.reduce((acc, leg) => {
      const multiplier = leg.action === 'buy' ? leg.quantity : -leg.quantity;
      return {
        delta: acc.delta + leg.delta * multiplier,
        gamma: acc.gamma + leg.gamma * multiplier,
        theta: acc.theta + leg.theta * multiplier,
        vega: acc.vega + leg.vega * multiplier,
      };
    }, { delta: 0, gamma: 0, theta: 0, vega: 0 });
    
    // Generate price range (±30% from current spot)
    const minPrice = currentSpot * 0.7;
    const maxPrice = currentSpot * 1.3;
    const numPoints = 100;
    const priceStep = (maxPrice - minPrice) / (numPoints - 1);
    
    const evolutionData: GreeksEvolutionData[] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const price = minPrice + i * priceStep;
      const spotDelta = price - currentSpot;
      
      // Approximate Greeks at this spot price
      // Delta changes linearly with spot (first-order approximation)
      const delta = positionGreeks.delta + positionGreeks.gamma * spotDelta;
      
      // Gamma changes with moneyness (decreases as we move away from ATM)
      // Use exponential decay based on distance from current spot
      const moneynessDistance = Math.abs(spotDelta) / currentSpot;
      const gammaDecay = Math.exp(-moneynessDistance * 3); // Decay factor
      const gamma = positionGreeks.gamma * gammaDecay;
      
      // Theta is relatively stable but increases slightly OTM
      // (options lose value faster when OTM)
      const thetaAdjustment = 1 + moneynessDistance * 0.5;
      const theta = positionGreeks.theta * thetaAdjustment;
      
      // Vega is highest ATM, decreases as we move away
      const vegaDecay = Math.exp(-moneynessDistance * 2);
      const vega = positionGreeks.vega * vegaDecay;
      
      evolutionData.push({
        price: Math.round(price),
        delta: Number(delta.toFixed(4)),
        gamma: Number(gamma.toFixed(6)),
        theta: Number(theta.toFixed(2)),
        vega: Number(vega.toFixed(2)),
      });
    }
    
    setGreeksEvolution(evolutionData);
  };
  
  // Recalculate Greeks Evolution when legs or spot changes
  useEffect(() => {
    calculateGreeksEvolution();
  }, [legs, currentSpot]);

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
  
  const applyTemplate = (templateName: string) => {
    // Clear existing legs
    setLegs([]);
    setAnalysis(null);
    
    // Get current spot price (estimate from ATM if not loaded)
    const spot = currentSpot || 94000;
    
    // Determine target expiry: use selected or nearest
    const expiries = [...new Set(availableOptions.map(opt => opt.expiryDate))].sort();
    if (expiries.length === 0) {
      setError('No options available');
      return;
    }
    
    // Use selectedTemplateExpiry if set, otherwise use nearest (day trade mode)
    const targetExpiry = selectedTemplateExpiry 
      ? Number(selectedTemplateExpiry)
      : expiries[0];
    
    // Filter options for target expiry
    const expiryOptions = availableOptions.filter(opt => opt.expiryDate === targetExpiry);
    
    // Find ATM strike (closest to spot)
    const atmStrike = expiryOptions
      .map(opt => opt.strike)
      .reduce((prev, curr) => 
        Math.abs(curr - spot) < Math.abs(prev - spot) ? curr : prev
      );
    
    // Find strikes around ATM
    const strikes = [...new Set(expiryOptions.map(opt => opt.strike))].sort((a, b) => a - b);
    const atmIndex = strikes.indexOf(atmStrike);
    
    let newLegs: Leg[] = [];
    
    switch (templateName) {
      case 'bullCallSpread': {
        // Buy ATM call, sell OTM call (1 strike higher)
        const lowerStrike = atmStrike;
        const higherStrike = strikes[Math.min(atmIndex + 1, strikes.length - 1)];
        
        const buyCall = expiryOptions.find(opt => opt.strike === lowerStrike && opt.side === 'CALL');
        const sellCall = expiryOptions.find(opt => opt.strike === higherStrike && opt.side === 'CALL');
        
        if (buyCall) newLegs.push(createLeg(buyCall, 'buy'));
        if (sellCall) newLegs.push(createLeg(sellCall, 'sell'));
        break;
      }
      
      case 'bearPutSpread': {
        // Buy ATM put, sell OTM put (1 strike lower)
        const higherStrike = atmStrike;
        const lowerStrike = strikes[Math.max(atmIndex - 1, 0)];
        
        const buyPut = expiryOptions.find(opt => opt.strike === higherStrike && opt.side === 'PUT');
        const sellPut = expiryOptions.find(opt => opt.strike === lowerStrike && opt.side === 'PUT');
        
        if (buyPut) newLegs.push(createLeg(buyPut, 'buy'));
        if (sellPut) newLegs.push(createLeg(sellPut, 'sell'));
        break;
      }
      
      case 'longStraddle': {
        // Buy ATM call + ATM put
        const call = expiryOptions.find(opt => opt.strike === atmStrike && opt.side === 'CALL');
        const put = expiryOptions.find(opt => opt.strike === atmStrike && opt.side === 'PUT');
        
        if (call) newLegs.push(createLeg(call, 'buy'));
        if (put) newLegs.push(createLeg(put, 'buy'));
        break;
      }
      
      case 'longStrangle': {
        // Buy OTM call + OTM put
        const callStrike = strikes[Math.min(atmIndex + 1, strikes.length - 1)];
        const putStrike = strikes[Math.max(atmIndex - 1, 0)];
        
        const call = expiryOptions.find(opt => opt.strike === callStrike && opt.side === 'CALL');
        const put = expiryOptions.find(opt => opt.strike === putStrike && opt.side === 'PUT');
        
        if (call) newLegs.push(createLeg(call, 'buy'));
        if (put) newLegs.push(createLeg(put, 'buy'));
        break;
      }
      
      case 'ironCondor': {
        // Bull put spread + bear call spread
        // Sell put at ATM-1, buy put at ATM-2
        // Sell call at ATM+1, buy call at ATM+2
        const sellPutStrike = strikes[Math.max(atmIndex - 1, 0)];
        const buyPutStrike = strikes[Math.max(atmIndex - 2, 0)];
        const sellCallStrike = strikes[Math.min(atmIndex + 1, strikes.length - 1)];
        const buyCallStrike = strikes[Math.min(atmIndex + 2, strikes.length - 1)];
        
        const buyPut = expiryOptions.find(opt => opt.strike === buyPutStrike && opt.side === 'PUT');
        const sellPut = expiryOptions.find(opt => opt.strike === sellPutStrike && opt.side === 'PUT');
        const sellCall = expiryOptions.find(opt => opt.strike === sellCallStrike && opt.side === 'CALL');
        const buyCall = expiryOptions.find(opt => opt.strike === buyCallStrike && opt.side === 'CALL');
        
        if (buyPut) newLegs.push(createLeg(buyPut, 'buy'));
        if (sellPut) newLegs.push(createLeg(sellPut, 'sell'));
        if (sellCall) newLegs.push(createLeg(sellCall, 'sell'));
        if (buyCall) newLegs.push(createLeg(buyCall, 'buy'));
        break;
      }
      
      case 'butterfly': {
        // Buy 1 lower wing, sell 2 body, buy 1 upper wing (calls)
        const lowerStrike = strikes[Math.max(atmIndex - 1, 0)];
        const middleStrike = atmStrike;
        const upperStrike = strikes[Math.min(atmIndex + 1, strikes.length - 1)];
        
        const lowerCall = expiryOptions.find(opt => opt.strike === lowerStrike && opt.side === 'CALL');
        const middleCall = expiryOptions.find(opt => opt.strike === middleStrike && opt.side === 'CALL');
        const upperCall = expiryOptions.find(opt => opt.strike === upperStrike && opt.side === 'CALL');
        
        if (lowerCall) newLegs.push(createLeg(lowerCall, 'buy'));
        if (middleCall) {
          newLegs.push(createLeg(middleCall, 'sell'));
          newLegs.push(createLeg(middleCall, 'sell'));
        }
        if (upperCall) newLegs.push(createLeg(upperCall, 'buy'));
        break;
      }
    }
    
    if (newLegs.length > 0) {
      setLegs(newLegs);
      setShowTemplates(false);
      setError(null);
    } else {
      setError('Could not find suitable options for this template');
    }
  };
  
  // Helper function to create a leg from an option
  const createLeg = (option: OptionData, action: 'buy' | 'sell'): Leg => ({
    symbol: option.symbol,
    underlying: option.underlying,
    strike: option.strike,
    expiryDate: option.expiryDate,
    side: option.side,
    action,
    quantity: 1,
    entryPrice: option.markPrice,
    delta: option.delta,
    gamma: option.gamma,
    theta: option.theta,
    vega: option.vega,
  });

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
            onClick={() => setShowTemplates(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Templates
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Position Summary</h2>
            {currentSpot && (
              <div className="text-sm text-purple-400">
                Current Spot: {formatPrice(currentSpot)}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Max Profit</div>
              <div className="text-lg font-semibold text-green-400">
                {analysis.maxProfit === Infinity ? 'Unlimited' : formatPrice(analysis.maxProfit)}
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
              <ComposedChart data={analysis.pnlCurve}>
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
                  type="number"
                  domain={['dataMin', 'dataMax']}
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
                
                {/* Breakeven markers - RENDER FIRST (behind) */}
                {analysis.breakevens.map((be, idx) => {
                  console.log('[Chart] Rendering breakeven at:', be);
                  return (
                    <ReferenceLine 
                      key={`be-${idx}`}
                      x={be} 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      label={{
                        value: 'BE',
                        position: 'top',
                        fill: '#f59e0b',
                        fontSize: 12,
                        fontWeight: 'bold'
                      }}
                    />
                  );
                })}
                
                {/* Current Spot Marker - RENDER SECOND (in front) */}
                {currentSpot && (() => {
                  console.log('[Chart] Rendering current spot marker at:', currentSpot);
                  return (
                    <ReferenceLine 
                      x={currentSpot} 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: `Current: ${formatPrice(currentSpot)}`,
                        position: 'top',
                        fill: '#8b5cf6',
                        fontSize: 12,
                        fontWeight: 'bold'
                      }}
                    />
                  );
                })()}
                
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
                
                {/* Time Curves - Multiple lines showing P&L at different times */}
                {analysis.timeCurves && analysis.timeCurves.map((curve: any) => (
                  <Line
                    key={curve.name}
                    type="monotone"
                    data={curve.data}
                    dataKey="pnl"
                    stroke={curve.color}
                    strokeWidth={curve.dash ? 1.5 : 2}
                    strokeDasharray={curve.dash ? "5 5" : "0"}
                    dot={false}
                    name={curve.name}
                    connectNulls
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="mt-4 space-y-3">
            {/* Zones */}
            <div className="flex items-center gap-6 text-sm text-gray-400">
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
              {currentSpot && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span>Current Spot</span>
                </div>
              )}
            </div>
            
            {/* Time Curves */}
            {analysis.timeCurves && analysis.timeCurves.length > 0 && (
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <span className="font-semibold text-gray-300">Time Evolution:</span>
                {analysis.timeCurves.map((curve: any) => (
                  <div key={curve.name} className="flex items-center gap-2">
                    <div 
                      className="w-8 h-0.5" 
                      style={{ 
                        backgroundColor: curve.color,
                        borderTop: curve.dash ? `2px dashed ${curve.color}` : 'none'
                      }}
                    ></div>
                    <span className="capitalize">
                      {curve.name === 'today' ? `Today (${curve.daysToExpiry.toFixed(0)}d)` :
                       curve.name === 'expiry' ? 'Expiration' :
                       curve.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Greeks Evolution Chart */}
      {analysis && greeksEvolution.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Greeks Evolution</h2>
          <p className="text-sm text-gray-400 mb-4">
            How position Greeks change as the underlying price moves. Shows sensitivity to spot price movement.
          </p>
          
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={greeksEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="price"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  stroke="#94a3b8"
                  tickFormatter={(val) => formatPrice(val)}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#94a3b8"
                  label={{ value: 'Delta / Theta / Vega', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  label={{ value: 'Gamma (×1000)', angle: 90, position: 'insideRight', fill: '#10b981' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Gamma') return [(value * 1000).toFixed(4), name];
                    return [value.toFixed(name === 'Delta' ? 4 : 2), name];
                  }}
                  labelFormatter={(label) => `Spot: ${formatPrice(label)}`}
                />
                
                {/* Current Spot Marker */}
                {currentSpot && (
                  <ReferenceLine 
                    x={currentSpot} 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: 'Current',
                      position: 'top',
                      fill: '#8b5cf6',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  />
                )}
                
                {/* Delta Line */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="delta"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  name="Delta"
                />
                
                {/* Gamma Line (scaled x1000 for visibility) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={(data: GreeksEvolutionData) => data.gamma * 1000}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  name="Gamma"
                />
                
                {/* Theta Line */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="theta"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={false}
                  name="Theta"
                />
                
                {/* Vega Line (scaled /100 for better scale) */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey={(data: GreeksEvolutionData) => data.vega / 100}
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={false}
                  name="Vega"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-cyan-400"></div>
              <span><strong>Delta:</strong> Directional exposure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500"></div>
              <span><strong>Gamma (×1000):</strong> Delta acceleration</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-red-500"></div>
              <span><strong>Theta:</strong> Time decay per day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-purple-500"></div>
              <span><strong>Vega (÷100):</strong> IV sensitivity</span>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-300">💡 How to read:</strong> 
              <strong className="text-cyan-400"> Delta</strong> shows how much the position value changes per $1 move in spot. 
              <strong className="text-green-400"> Gamma</strong> shows how fast Delta changes (highest ATM). 
              <strong className="text-red-400"> Theta</strong> shows daily time decay (negative = losing value). 
              <strong className="text-purple-400"> Vega</strong> shows sensitivity to volatility changes (highest ATM).
            </p>
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
      
      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Position Templates</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Expiry Selection */}
            <div className="mb-6 bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Expiry Date
              </label>
              <select
                value={selectedTemplateExpiry || ''}
                onChange={(e) => setSelectedTemplateExpiry(e.target.value || null)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Quick Add (Nearest Expiry - Day Trade)</option>
                {availableOptions
                  .map(opt => opt.expiryDate)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                  .map(expiry => {
                    const dte = Math.round((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <option key={expiry} value={expiry}>
                        {new Date(expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({dte} DTE)
                      </option>
                    );
                  })}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                {selectedTemplateExpiry 
                  ? '📊 Position Trade: Select strategy below to apply with chosen expiry'
                  : '⚡ Day Trade: Click any strategy for quick setup with nearest expiry'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bull Call Spread */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-green-500 transition-colors cursor-pointer"
                   onClick={() => applyTemplate('bullCallSpread')}>
                <h3 className="text-lg font-semibold text-green-400 mb-2">Bull Call Spread</h3>
                <p className="text-sm text-gray-400 mb-3">Buy lower strike call, sell higher strike call</p>
                <div className="text-xs text-gray-500">
                  <div>• Limited profit, limited risk</div>
                  <div>• Bullish strategy</div>
                  <div>• Lower cost than long call</div>
                </div>
              </div>
              
              {/* Bear Put Spread */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-red-500 transition-colors cursor-pointer"
                   onClick={() => applyTemplate('bearPutSpread')}>
                <h3 className="text-lg font-semibold text-red-400 mb-2">Bear Put Spread</h3>
                <p className="text-sm text-gray-400 mb-3">Buy higher strike put, sell lower strike put</p>
                <div className="text-xs text-gray-500">
                  <div>• Limited profit, limited risk</div>
                  <div>• Bearish strategy</div>
                  <div>• Lower cost than long put</div>
                </div>
              </div>
              
              {/* Long Straddle */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-yellow-500 transition-colors cursor-pointer"
                   onClick={() => applyTemplate('longStraddle')}>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Long Straddle</h3>
                <p className="text-sm text-gray-400 mb-3">Buy ATM call + ATM put (same strike)</p>
                <div className="text-xs text-gray-500">
                  <div>• Unlimited profit, limited risk</div>
                  <div>• Profits from large moves</div>
                  <div>• High cost (theta decay)</div>
                </div>
              </div>
              
              {/* Long Strangle */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-orange-500 transition-colors cursor-pointer"
                   onClick={() => applyTemplate('longStrangle')}>
                <h3 className="text-lg font-semibold text-orange-400 mb-2">Long Strangle</h3>
                <p className="text-sm text-gray-400 mb-3">Buy OTM call + OTM put (different strikes)</p>
                <div className="text-xs text-gray-500">
                  <div>• Unlimited profit, limited risk</div>
                  <div>• Lower cost than straddle</div>
                  <div>• Needs bigger move to profit</div>
                </div>
              </div>
              
              {/* Iron Condor */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-purple-500 transition-colors cursor-pointer"
                   onClick={() => applyTemplate('ironCondor')}>
                <h3 className="text-lg font-semibold text-purple-400 mb-2">Iron Condor</h3>
                <p className="text-sm text-gray-400 mb-3">Bull put spread + bear call spread</p>
                <div className="text-xs text-gray-500">
                  <div>• Limited profit, limited risk</div>
                  <div>• Profits from low volatility</div>
                  <div>• 4 legs (complex)</div>
                </div>
              </div>
              
              {/* Butterfly */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer"
                   onClick={() => applyTemplate('butterfly')}>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Butterfly Spread</h3>
                <p className="text-sm text-gray-400 mb-3">Buy 2 wings, sell 2 body (calls or puts)</p>
                <div className="text-xs text-gray-500">
                  <div>• Limited profit, limited risk</div>
                  <div>• Profits if price stays near middle strike</div>
                  <div>• Low cost, low risk</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-sm text-gray-400">
              <p>💡 <strong>Tip:</strong> After applying a template, you can adjust strikes and quantities manually.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionsTrade;
