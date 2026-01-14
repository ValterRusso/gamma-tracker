import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

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
    const expiryOptions = options.filter(opt => opt.expiryDate === selectedExpiry);
    
    // Get unique strikes
    const strikes = Array.from(new Set(expiryOptions.map(opt => opt.strike))).sort((a, b) => a - b);
    
    // Build rows
    return strikes.map(strike => {
      const call = expiryOptions.find(opt => opt.strike === strike && opt.side === 'CALL') || null;
      const put = expiryOptions.find(opt => opt.strike === strike && opt.side === 'PUT') || null;
      
      return { strike, call, put };
    });
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
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
          
          {currentSpot && (
            <div className="text-right">
              <div className="text-sm text-gray-400">Current Spot</div>
              <div className="text-2xl font-bold text-purple-400">{formatPrice(currentSpot)}</div>
            </div>
          )}
        </div>
      </div>
      
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Call IV</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Delta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Gamma</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Theta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Vega</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Vol</th>
                  
                  {/* Strike Header */}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase bg-slate-800">Strike</th>
                  
                  {/* Put Headers */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Vol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Vega</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Theta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Gamma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Delta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Put IV</th>
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
                        isAtm ? 'bg-yellow-900/10' : ''
                      }`}
                    >
                      {/* Call Data */}
                      <td className="px-4 py-3 text-sm text-gray-300">
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
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">
                        {row.call ? formatPrice(row.call.markPrice) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-400">
                        {row.call ? row.call.volume.toFixed(1) : '-'}
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
                        {row.put ? row.put.volume.toFixed(1) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-left font-semibold text-red-400">
                        {row.put ? formatPrice(row.put.markPrice) : '-'}
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
                      <td className="px-4 py-3 text-sm text-gray-300">
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
