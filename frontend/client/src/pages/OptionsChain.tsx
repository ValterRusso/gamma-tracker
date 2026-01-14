import React, { useState, useEffect } from 'react';
import { ArrowLeft, Filter, ArrowUpDown, Plus, Minus } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

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

interface ChainRow {
  strike: number;
  call: OptionData | null;
  put: OptionData | null;
}

const OptionsChain: React.FC = () => {
  const [, setLocation] = useLocation();
  
  // State
  const [options, setOptions] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<number | null>(null);
  const [currentSpot, setCurrentSpot] = useState<number | null>(null);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    strikeMin: null as number | null,
    strikeMax: null as number | null,
    moneyness: ['ITM', 'ATM', 'OTM'] as string[],
    minVolume: 0,
    minOI: 0
  });
  
  // Sort state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  
  // Hover state for quick actions
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  // Fetch options data
  useEffect(() => {
    fetchOptions();
    fetchCurrentSpot();
  }, []);
  
  const fetchOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3300/api/options');
      const data = await response.json();
      
      if (data.success) {
        setOptions(data.data);
        
        // Set first expiry as default
        const expiries = getUniqueExpiries(data.data);
        if (expiries.length > 0) {
          setSelectedExpiry(expiries[0]);
        }
      } else {
        setError('Failed to fetch options data');
      }
    } catch (err) {
      console.error('Error fetching options:', err);
      setError('Failed to fetch options data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCurrentSpot = async () => {
    try {
      const response = await fetch('http://localhost:3300/api/binance/stats');
      const data = await response.json();
      
      if (data.success && data.data.spotPrice) {
        setCurrentSpot(parseFloat(data.data.spotPrice));
      }
    } catch (err) {
      console.error('Error fetching spot price:', err);
    }
  };
  
  // Get unique expiry dates
  const getUniqueExpiries = (opts: OptionData[]): number[] => {
    const expiries = opts.map(opt => opt.expiryDate);
    return Array.from(new Set(expiries)).sort((a, b) => a - b);
  };
  
  // Build chain rows for selected expiry
  const buildChainRows = (): ChainRow[] => {
    if (!selectedExpiry) return [];
    
    // Filter options for selected expiry
    let expiryOptions = options.filter(opt => opt.expiryDate === selectedExpiry);
    
    // Get unique strikes
    let strikes = Array.from(new Set(expiryOptions.map(opt => opt.strike))).sort((a, b) => a - b);
    
    // Apply strike range filter
    if (filters.strikeMin !== null) {
      strikes = strikes.filter(s => s >= filters.strikeMin!);
    }
    if (filters.strikeMax !== null) {
      strikes = strikes.filter(s => s <= filters.strikeMax!);
    }
    
    // Build rows
    let rows = strikes.map(strike => {
      const call = expiryOptions.find(opt => opt.strike === strike && opt.side === 'CALL') || null;
      const put = expiryOptions.find(opt => opt.strike === strike && opt.side === 'PUT') || null;
      
      return { strike, call, put };
    });
    
    // Apply moneyness filter
    if (filters.moneyness.length < 3) {
      rows = rows.filter(row => {
        const callMoneyness = row.call ? getMoneyness(row.strike, 'CALL') : null;
        const putMoneyness = row.put ? getMoneyness(row.strike, 'PUT') : null;
        
        return filters.moneyness.includes(callMoneyness || '') || 
               filters.moneyness.includes(putMoneyness || '');
      });
    }
    
    // Apply volume filter
    if (filters.minVolume > 0) {
      rows = rows.filter(row => {
        const callVol = row.call?.volume || 0;
        const putVol = row.put?.volume || 0;
        return callVol >= filters.minVolume || putVol >= filters.minVolume;
      });
    }
    
    // Apply OI filter
    if (filters.minOI > 0) {
      rows = rows.filter(row => {
        const callOI = row.call?.openInterest || 0;
        const putOI = row.put?.openInterest || 0;
        return callOI >= filters.minOI || putOI >= filters.minOI;
      });
    }
    
    // Apply sorting
    if (sortConfig.key) {
      rows.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (sortConfig.key) {
          case 'strike':
            aVal = a.strike;
            bVal = b.strike;
            break;
          case 'callDelta':
            aVal = a.call?.delta || 0;
            bVal = b.call?.delta || 0;
            break;
          case 'callGamma':
            aVal = a.call?.gamma || 0;
            bVal = b.call?.gamma || 0;
            break;
          case 'callTheta':
            aVal = a.call?.theta || 0;
            bVal = b.call?.theta || 0;
            break;
          case 'callVega':
            aVal = a.call?.vega || 0;
            bVal = b.call?.vega || 0;
            break;
          case 'callIV':
            aVal = a.call?.markIV || 0;
            bVal = b.call?.markIV || 0;
            break;
          case 'callPrice':
            aVal = a.call?.markPrice || 0;
            bVal = b.call?.markPrice || 0;
            break;
          case 'callVolume':
            aVal = a.call?.volume || 0;
            bVal = b.call?.volume || 0;
            break;
          case 'putDelta':
            aVal = a.put?.delta || 0;
            bVal = b.put?.delta || 0;
            break;
          case 'putGamma':
            aVal = a.put?.gamma || 0;
            bVal = b.put?.gamma || 0;
            break;
          case 'putTheta':
            aVal = a.put?.theta || 0;
            bVal = b.put?.theta || 0;
            break;
          case 'putVega':
            aVal = a.put?.vega || 0;
            bVal = b.put?.vega || 0;
            break;
          case 'putIV':
            aVal = a.put?.markIV || 0;
            bVal = b.put?.markIV || 0;
            break;
          case 'putPrice':
            aVal = a.put?.markPrice || 0;
            bVal = b.put?.markPrice || 0;
            break;
          case 'putVolume':
            aVal = a.put?.volume || 0;
            bVal = b.put?.volume || 0;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return rows;
  };
  
  // Determine if strike is ATM
  const isATM = (strike: number): boolean => {
    if (!currentSpot) return false;
    const percentDiff = Math.abs(strike - currentSpot) / currentSpot;
    return percentDiff < 0.02; // Within 2%
  };
  
  // Determine moneyness
  const getMoneyness = (strike: number, side: 'CALL' | 'PUT'): 'ITM' | 'ATM' | 'OTM' => {
    if (!currentSpot) return 'ATM';
    
    if (isATM(strike)) return 'ATM';
    
    if (side === 'CALL') {
      return currentSpot > strike ? 'ITM' : 'OTM';
    } else {
      return currentSpot < strike ? 'ITM' : 'OTM';
    }
  };
  
  // Visual Enhancement Helpers
  
  // Get IV heatmap color
  const getIVColor = (iv: number): string => {
    const ivPercent = iv * 100;
    
    if (ivPercent < 40) {
      // Green (low IV)
      const intensity = Math.min(ivPercent / 40, 1);
      return `rgba(34, 197, 94, ${0.1 + intensity * 0.2})`; // green-500
    } else if (ivPercent < 60) {
      // Yellow (medium IV)
      const intensity = (ivPercent - 40) / 20;
      return `rgba(234, 179, 8, ${0.15 + intensity * 0.25})`; // yellow-500
    } else if (ivPercent < 80) {
      // Orange (high IV)
      const intensity = (ivPercent - 60) / 20;
      return `rgba(249, 115, 22, ${0.2 + intensity * 0.3})`; // orange-500
    } else {
      // Red (very high IV)
      const intensity = Math.min((ivPercent - 80) / 20, 1);
      return `rgba(239, 68, 68, ${0.25 + intensity * 0.35})`; // red-500
    }
  };
  
  // Get price heatmap color
  const getPriceColor = (price: number): string => {
    if (price < 500) {
      // Green (cheap)
      return 'rgba(34, 197, 94, 0.1)';
    } else if (price < 2000) {
      // Yellow (medium)
      return 'rgba(234, 179, 8, 0.15)';
    } else if (price < 5000) {
      // Orange (expensive)
      return 'rgba(249, 115, 22, 0.2)';
    } else {
      // Red (very expensive)
      return 'rgba(239, 68, 68, 0.25)';
    }
  };
  
  // Get moneyness row style
  const getMoneynessRowClass = (callMoneyness: 'ITM' | 'ATM' | 'OTM', putMoneyness: 'ITM' | 'ATM' | 'OTM'): string => {
    // ATM takes priority
    if (callMoneyness === 'ATM' || putMoneyness === 'ATM') {
      return 'bg-yellow-900/10';
    }
    
    // ITM for either side
    if (callMoneyness === 'ITM' || putMoneyness === 'ITM') {
      return 'bg-green-900/5';
    }
    
    // OTM (default)
    return '';
  };
  
  // Get volume bar width
  const getVolumeBarWidth = (volume: number, maxVolume: number): number => {
    if (maxVolume === 0) return 0;
    return Math.min((volume / maxVolume) * 100, 100);
  };
  
  // Calculate max volume for normalization
  const getMaxVolume = (): number => {
    const volumes = chainRows.flatMap(row => [
      row.call?.volume || 0,
      row.put?.volume || 0
    ]);
    return Math.max(...volumes, 1);
  };
  
  // Click handlers
  const handleOptionClick = (option: OptionData, action: 'BUY' | 'SELL') => {
    // Save to localStorage for OptionsTrade page to pick up
    const leg = {
      symbol: option.symbol,
      strike: option.strike,
      expiry: option.expiryDate,
      type: option.side,
      action: action,
      quantity: 1,
      price: option.markPrice
    };
    
    localStorage.setItem('pendingLeg', JSON.stringify(leg));
    toast.success(`${action === 'BUY' ? 'Buying' : 'Selling'} ${option.side} added to position`);
    
    // Redirect to options trade page
    setTimeout(() => {
      setLocation('/options-trade');
    }, 500);
  };
  
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  const resetFilters = () => {
    setFilters({
      strikeMin: null,
      strikeMax: null,
      moneyness: ['ITM', 'ATM', 'OTM'],
      minVolume: 0,
      minOI: 0
    });
    setSortConfig({ key: null, direction: 'asc' });
  };
  
  // Format helpers
  const formatPrice = (price: number): string => {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  const formatGreek = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals);
  };
  
  const formatIV = (iv: number): string => {
    return `${(iv * 100).toFixed(1)}%`;
  };
  
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const getDaysToExpiry = (expiryTimestamp: number): number => {
    const now = Date.now();
    const diff = expiryTimestamp - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };
  
  const chainRows = buildChainRows();
  const expiries = getUniqueExpiries(options);
  const maxVolume = getMaxVolume();
  
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Options Chain</h1>
            <p className="text-gray-400">
              Professional options table with real-time Greeks and pricing
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {currentSpot && (
              <div className="text-right">
                <div className="text-sm text-gray-400">Current Spot</div>
                <div className="text-2xl font-bold text-purple-400">{formatPrice(currentSpot)}</div>
              </div>
            )}
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters ? 'bg-purple-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Strike Range */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Strike Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.strikeMin || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, strikeMin: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.strikeMax || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, strikeMax: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            
            {/* Moneyness */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Moneyness</label>
              <div className="flex gap-2">
                {['ITM', 'ATM', 'OTM'].map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        moneyness: prev.moneyness.includes(m)
                          ? prev.moneyness.filter(x => x !== m)
                          : [...prev.moneyness, m]
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      filters.moneyness.includes(m)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 text-gray-400 hover:bg-slate-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Min Volume */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Min Volume</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minVolume || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, minVolume: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            {/* Min OI */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Min Open Interest</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minOI || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, minOI: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Expiry Tabs */}
      {expiries.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {expiries.map(expiry => {
            const dte = getDaysToExpiry(expiry);
            const isSelected = expiry === selectedExpiry;
            
            return (
              <button
                key={expiry}
                onClick={() => setSelectedExpiry(expiry)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <div className="font-semibold">{formatDate(expiry)}</div>
                <div className="text-xs">{dte} DTE</div>
              </button>
            );
          })}
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-gray-400">
          Loading options chain...
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}
      
      {/* Options Chain Table */}
      {!loading && !error && chainRows.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 sticky top-0 z-10">
                <tr>
                  {/* Call Headers */}
                  <th 
                    onClick={() => handleSort('callIV')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Call IV</span>
                      {sortConfig.key === 'callIV' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('callDelta')}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Delta</span>
                      {sortConfig.key === 'callDelta' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('callGamma')}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Gamma</span>
                      {sortConfig.key === 'callGamma' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('callTheta')}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Theta</span>
                      {sortConfig.key === 'callTheta' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('callVega')}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Vega</span>
                      {sortConfig.key === 'callVega' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('callPrice')}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Price</span>
                      {sortConfig.key === 'callPrice' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('callVolume')}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Vol</span>
                      {sortConfig.key === 'callVolume' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  
                  {/* Strike Header */}
                  <th 
                    onClick={() => handleSort('strike')}
                    className="px-6 py-3 text-center text-xs font-semibold text-white uppercase bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Strike</span>
                      {sortConfig.key === 'strike' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  
                  {/* Put Headers */}
                  <th 
                    onClick={() => handleSort('putVolume')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Vol</span>
                      {sortConfig.key === 'putVolume' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('putPrice')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Price</span>
                      {sortConfig.key === 'putPrice' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('putVega')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Vega</span>
                      {sortConfig.key === 'putVega' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('putTheta')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Theta</span>
                      {sortConfig.key === 'putTheta' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('putGamma')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Gamma</span>
                      {sortConfig.key === 'putGamma' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('putDelta')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Delta</span>
                      {sortConfig.key === 'putDelta' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('putIV')}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Put IV</span>
                      {sortConfig.key === 'putIV' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {chainRows.map((row, idx) => {
                  const isAtm = isATM(row.strike);
                  const callMoneyness = row.call ? getMoneyness(row.strike, 'CALL') : 'OTM';
                  const putMoneyness = row.put ? getMoneyness(row.strike, 'PUT') : 'OTM';
                  
                  return (
                    <tr
                      key={row.strike}
                      className={`border-t border-slate-700 hover:bg-slate-700/30 transition-colors ${
                        getMoneynessRowClass(callMoneyness, putMoneyness)
                      }`}
                    >
                      {/* Call Data */}
                      <td 
                        className="px-4 py-3 text-sm text-gray-300 font-semibold"
                        style={{
                          backgroundColor: row.call ? getIVColor(row.call.markIV) : 'transparent'
                        }}
                      >
                        {row.call ? formatIV(row.call.markIV) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        {row.call ? formatGreek(row.call.delta, 3) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        {row.call ? formatGreek(row.call.gamma, 5) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {row.call ? formatGreek(row.call.theta, 2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        {row.call ? formatGreek(row.call.vega, 2) : '-'}
                      </td>
                      <td 
                        onMouseEnter={() => setHoveredRow(row.strike)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className="px-4 py-3 text-sm text-right font-semibold text-green-400 cursor-pointer hover:bg-green-900/20 transition-colors relative"
                        style={{
                          backgroundColor: row.call ? getPriceColor(row.call.markPrice) : 'transparent'
                        }}
                      >
                        {row.call ? (
                          <div className="flex items-center justify-end gap-2">
                            {hoveredRow === row.strike && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionClick(row.call!, 'BUY');
                                  }}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                                  title="Buy Call"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionClick(row.call!, 'SELL');
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                                  title="Sell Call"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            <span>{formatPrice(row.call.markPrice)}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-400">
                        <div className="relative">
                          {row.call && row.call.volume > 0 && (
                            <div 
                              className="absolute inset-y-0 right-0 bg-cyan-500/20 rounded"
                              style={{ width: `${getVolumeBarWidth(row.call.volume, maxVolume)}%` }}
                            />
                          )}
                          <span className="relative z-10">
                            {row.call ? row.call.volume.toFixed(1) : '-'}
                          </span>
                        </div>
                      </td>
                      
                      {/* Strike */}
                      <td className={`px-6 py-3 text-center font-bold ${
                        isAtm ? 'text-yellow-400 text-lg' : 'text-white'
                      }`}>
                        {formatPrice(row.strike)}
                        {isAtm && <span className="ml-2 text-xs text-yellow-400">ATM</span>}
                      </td>
                      
                      {/* Put Data */}
                      <td className="px-4 py-3 text-sm text-left text-gray-400">
                        <div className="relative">
                          {row.put && row.put.volume > 0 && (
                            <div 
                              className="absolute inset-y-0 left-0 bg-cyan-500/20 rounded"
                              style={{ width: `${getVolumeBarWidth(row.put.volume, maxVolume)}%` }}
                            />
                          )}
                          <span className="relative z-10">
                            {row.put ? row.put.volume.toFixed(1) : '-'}
                          </span>
                        </div>
                      </td>
                      <td 
                        onMouseEnter={() => setHoveredRow(row.strike)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className="px-4 py-3 text-sm text-left font-semibold text-red-400 cursor-pointer hover:bg-red-900/20 transition-colors relative"
                        style={{
                          backgroundColor: row.put ? getPriceColor(row.put.markPrice) : 'transparent'
                        }}
                      >
                        {row.put ? (
                          <div className="flex items-center gap-2">
                            <span>{formatPrice(row.put.markPrice)}</span>
                            {hoveredRow === row.strike && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionClick(row.put!, 'BUY');
                                  }}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                                  title="Buy Put"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionClick(row.put!, 'SELL');
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                                  title="Sell Put"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-300">
                        {row.put ? formatGreek(row.put.vega, 2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-red-400">
                        {row.put ? formatGreek(row.put.theta, 2) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-300">
                        {row.put ? formatGreek(row.put.gamma, 5) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-300">
                        {row.put ? formatGreek(row.put.delta, 3) : '-'}
                      </td>
                      <td 
                        className="px-4 py-3 text-sm text-gray-300 font-semibold"
                        style={{
                          backgroundColor: row.put ? getIVColor(row.put.markIV) : 'transparent'
                        }}
                      >
                        {row.put ? formatIV(row.put.markIV) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && !error && chainRows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No options data available for selected expiry
        </div>
      )}
    </div>
  );
};

export default OptionsChain;
