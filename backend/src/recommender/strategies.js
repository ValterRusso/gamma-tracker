/**
 * Options Strategies Library
 * 
 * Biblioteca de estratégias de opções com condições ideais de mercado,
 * estrutura de legs, perfil de risco/retorno e pesos para scoring.
 */

const STRATEGIES = [
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    namePt: 'Trava de Alta',
    description: 'Compra call ATM e vende call OTM para limitar custo',
    category: 'DIRECTIONAL',
    bias: 'BULLISH',
    
    // Condições ideais de mercado
    idealConditions: {
      regime: ['BULLISH', 'NEUTRAL'],
      volatility: ['LOW', 'MEDIUM'],  // IV Rank < 50
      skew: ['FLAT', 'PUT_SKEW'],
      gex: ['POSITIVE'],
      maxPainDistance: { min: -5, max: 5 },
      sentiment: { putCallRatio: { max: 1.2 } }
    },
    
    // Estrutura da estratégia
    legs: [
      { action: 'BUY', type: 'CALL', moneyness: 'ATM' },
      { action: 'SELL', type: 'CALL', moneyness: 'OTM', delta: 0.30 }
    ],
    
    // Características de risco/retorno
    risk: {
      maxLoss: 'LIMITED',
      maxProfit: 'LIMITED',
      breakeven: 'SINGLE',
      capitalRequired: 'LOW'
    },
    
    // Greeks ideais
    greeks: {
      delta: { target: 0.5, range: [0.3, 0.7] },
      theta: 'NEGATIVE',
      vega: 'POSITIVE',
      gamma: 'POSITIVE'
    },
    
    // Quando usar
    whenToUse: [
      'Expectativa de alta moderada no preço',
      'Volatilidade implícita baixa ou média',
      'Quer limitar o custo de uma call longa',
      'Mercado em regime bullish ou neutro'
    ],
    
    // Quando evitar
    whenToAvoid: [
      'Volatilidade implícita muito alta',
      'Expectativa de queda forte',
      'Mercado muito lateral'
    ],
    
    // Scoring weights
    scoringWeights: {
      regime: 0.25,
      volatility: 0.20,
      skew: 0.15,
      gex: 0.10,
      maxPainDistance: 0.15,
      sentiment: 0.15
    }
  },
  
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    namePt: 'Trava de Baixa',
    description: 'Compra put ATM e vende put OTM para limitar custo',
    category: 'DIRECTIONAL',
    bias: 'BEARISH',
    
    idealConditions: {
      regime: ['BEARISH', 'NEUTRAL'],
      volatility: ['LOW', 'MEDIUM'],
      skew: ['FLAT', 'CALL_SKEW'],
      gex: ['NEGATIVE'],
      maxPainDistance: { min: -5, max: 5 },
      sentiment: { putCallRatio: { min: 0.8 } }
    },
    
    legs: [
      { action: 'BUY', type: 'PUT', moneyness: 'ATM' },
      { action: 'SELL', type: 'PUT', moneyness: 'OTM', delta: -0.30 }
    ],
    
    risk: {
      maxLoss: 'LIMITED',
      maxProfit: 'LIMITED',
      breakeven: 'SINGLE',
      capitalRequired: 'LOW'
    },
    
    greeks: {
      delta: { target: -0.5, range: [-0.7, -0.3] },
      theta: 'NEGATIVE',
      vega: 'POSITIVE',
      gamma: 'POSITIVE'
    },
    
    whenToUse: [
      'Expectativa de queda moderada no preço',
      'Volatilidade implícita baixa ou média',
      'Quer limitar o custo de uma put longa',
      'Mercado em regime bearish'
    ],
    
    whenToAvoid: [
      'Volatilidade implícita muito alta',
      'Expectativa de alta forte',
      'Mercado muito lateral'
    ],
    
    scoringWeights: {
      regime: 0.25,
      volatility: 0.20,
      skew: 0.15,
      gex: 0.10,
      maxPainDistance: 0.15,
      sentiment: 0.15
    }
  },
  
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    namePt: 'Condor de Ferro',
    description: 'Vende put spread e call spread OTM para coletar premium',
    category: 'NEUTRAL',
    bias: 'NEUTRAL',
    
    idealConditions: {
      regime: ['NEUTRAL'],
      volatility: ['HIGH', 'MEDIUM'],  // IV Rank > 50
      skew: ['FLAT'],
      gex: ['POSITIVE'],
      maxPainDistance: { min: -2, max: 2 },
      sentiment: { putCallRatio: { min: 0.8, max: 1.2 } }
    },
    
    legs: [
      { action: 'SELL', type: 'PUT', moneyness: 'OTM', delta: -0.30 },
      { action: 'BUY', type: 'PUT', moneyness: 'OTM', delta: -0.15 },
      { action: 'SELL', type: 'CALL', moneyness: 'OTM', delta: 0.30 },
      { action: 'BUY', type: 'CALL', moneyness: 'OTM', delta: 0.15 }
    ],
    
    risk: {
      maxLoss: 'LIMITED',
      maxProfit: 'LIMITED',
      breakeven: 'DOUBLE',
      capitalRequired: 'MEDIUM'
    },
    
    greeks: {
      delta: { target: 0, range: [-0.1, 0.1] },
      theta: 'POSITIVE',
      vega: 'NEGATIVE',
      gamma: 'NEGATIVE'
    },
    
    whenToUse: [
      'Expectativa de mercado lateral',
      'Volatilidade implícita alta',
      'Spot próximo do Max Pain',
      'GEX positivo'
    ],
    
    whenToAvoid: [
      'Expectativa de movimento direcional forte',
      'Volatilidade implícita baixa',
      'Anomalias de OI/Volume',
      'Divergência entre OI e Volume'
    ],
    
    scoringWeights: {
      regime: 0.30,
      volatility: 0.25,
      skew: 0.10,
      gex: 0.15,
      maxPainDistance: 0.15,
      sentiment: 0.05
    }
  },
  
  {
    id: 'iron_butterfly',
    name: 'Iron Butterfly',
    namePt: 'Borboleta de Ferro',
    description: 'Vende straddle ATM e compra strangle OTM para proteção',
    category: 'NEUTRAL',
    bias: 'NEUTRAL',
    
    idealConditions: {
      regime: ['NEUTRAL'],
      volatility: ['HIGH', 'MEDIUM'],
      skew: ['FLAT'],
      gex: ['POSITIVE'],
      maxPainDistance: { min: -1, max: 1 },
      sentiment: { putCallRatio: { min: 0.9, max: 1.1 } }
    },
    
    legs: [
      { action: 'SELL', type: 'PUT', moneyness: 'ATM' },
      { action: 'BUY', type: 'PUT', moneyness: 'OTM', delta: -0.15 },
      { action: 'SELL', type: 'CALL', moneyness: 'ATM' },
      { action: 'BUY', type: 'CALL', moneyness: 'OTM', delta: 0.15 }
    ],
    
    risk: {
      maxLoss: 'LIMITED',
      maxProfit: 'LIMITED',
      breakeven: 'DOUBLE',
      capitalRequired: 'MEDIUM'
    },
    
    greeks: {
      delta: { target: 0, range: [-0.05, 0.05] },
      theta: 'POSITIVE',
      vega: 'NEGATIVE',
      gamma: 'NEGATIVE'
    },
    
    whenToUse: [
      'Expectativa de mercado muito lateral',
      'Volatilidade implícita alta',
      'Spot muito próximo do Max Pain',
      'Quer coletar mais premium que Iron Condor'
    ],
    
    whenToAvoid: [
      'Expectativa de qualquer movimento',
      'Volatilidade implícita baixa',
      'Incerteza sobre direção'
    ],
    
    scoringWeights: {
      regime: 0.30,
      volatility: 0.25,
      skew: 0.10,
      gex: 0.15,
      maxPainDistance: 0.20,
      sentiment: 0.00
    }
  },
  
  {
    id: 'long_straddle',
    name: 'Long Straddle',
    namePt: 'Compra de Volatilidade ATM',
    description: 'Compra call e put ATM para lucrar com movimento forte',
    category: 'VOLATILITY',
    bias: 'NEUTRAL',
    
    idealConditions: {
      regime: ['NEUTRAL'],
      volatility: ['LOW'],  // IV Rank < 30
      skew: ['FLAT'],
      gex: ['NEGATIVE'],
      maxPainDistance: { min: -10, max: 10 },
      sentiment: { divergence: true },
      anomalies: ['OI_SPIKE', 'VOLUME_SPIKE']
    },
    
    legs: [
      { action: 'BUY', type: 'CALL', moneyness: 'ATM' },
      { action: 'BUY', type: 'PUT', moneyness: 'ATM' }
    ],
    
    risk: {
      maxLoss: 'LIMITED',
      maxProfit: 'UNLIMITED',
      breakeven: 'DOUBLE',
      capitalRequired: 'HIGH'
    },
    
    greeks: {
      delta: { target: 0, range: [-0.1, 0.1] },
      theta: 'NEGATIVE',
      vega: 'POSITIVE',
      gamma: 'POSITIVE'
    },
    
    whenToUse: [
      'Expectativa de movimento forte',
      'Volatilidade implícita muito baixa',
      'Antes de eventos importantes',
      'Anomalias detectadas',
      'Divergência entre OI e Volume'
    ],
    
    whenToAvoid: [
      'Volatilidade implícita alta',
      'Mercado lateral sem catalisadores',
      'Pouco tempo até vencimento',
      'GEX positivo'
    ],
    
    scoringWeights: {
      regime: 0.10,
      volatility: 0.35,
      skew: 0.05,
      gex: 0.20,
      maxPainDistance: 0.05,
      sentiment: 0.15,
      anomalies: 0.10
    }
  },
  
  {
    id: 'long_strangle',
    name: 'Long Strangle',
    namePt: 'Compra de Volatilidade OTM',
    description: 'Compra call e put OTM para lucrar com movimento forte (mais barato que straddle)',
    category: 'VOLATILITY',
    bias: 'NEUTRAL',
    
    idealConditions: {
      regime: ['NEUTRAL'],
      volatility: ['LOW'],
      skew: ['FLAT'],
      gex: ['NEGATIVE'],
      maxPainDistance: { min: -10, max: 10 },
      sentiment: { divergence: true },
      anomalies: ['OI_SPIKE', 'VOLUME_SPIKE']
    },
    
    legs: [
      { action: 'BUY', type: 'CALL', moneyness: 'OTM', delta: 0.30 },
      { action: 'BUY', type: 'PUT', moneyness: 'OTM', delta: -0.30 }
    ],
    
    risk: {
      maxLoss: 'LIMITED',
      maxProfit: 'UNLIMITED',
      breakeven: 'DOUBLE',
      capitalRequired: 'MEDIUM'
    },
    
    greeks: {
      delta: { target: 0, range: [-0.1, 0.1] },
      theta: 'NEGATIVE',
      vega: 'POSITIVE',
      gamma: 'POSITIVE'
    },
    
    whenToUse: [
      'Expectativa de movimento muito forte',
      'Volatilidade implícita baixa',
      'Quer pagar menos que straddle',
      'Anomalias detectadas'
    ],
    
    whenToAvoid: [
      'Volatilidade implícita alta',
      'Expectativa de movimento pequeno',
      'Mercado lateral'
    ],
    
    scoringWeights: {
      regime: 0.10,
      volatility: 0.35,
      skew: 0.05,
      gex: 0.20,
      maxPainDistance: 0.05,
      sentiment: 0.15,
      anomalies: 0.10
    }
  },
  
  {
    id: 'short_straddle',
    name: 'Short Straddle',
    namePt: 'Venda de Volatilidade ATM',
    description: 'Vende call e put ATM para coletar premium em mercado lateral',
    category: 'VOLATILITY',
    bias: 'NEUTRAL',
    
    idealConditions: {
      regime: ['NEUTRAL'],
      volatility: ['HIGH'],  // IV Rank > 70
      skew: ['FLAT'],
      gex: ['POSITIVE'],
      maxPainDistance: { min: -1, max: 1 },
      sentiment: { putCallRatio: { min: 0.9, max: 1.1 } }
    },
    
    legs: [
      { action: 'SELL', type: 'CALL', moneyness: 'ATM' },
      { action: 'SELL', type: 'PUT', moneyness: 'ATM' }
    ],
    
    risk: {
      maxLoss: 'UNLIMITED',
      maxProfit: 'LIMITED',
      breakeven: 'DOUBLE',
      capitalRequired: 'HIGH'
    },
    
    greeks: {
      delta: { target: 0, range: [-0.05, 0.05] },
      theta: 'POSITIVE',
      vega: 'NEGATIVE',
      gamma: 'NEGATIVE'
    },
    
    whenToUse: [
      'Expectativa de mercado muito lateral',
      'Volatilidade implícita muito alta',
      'Spot muito próximo do Max Pain',
      'GEX positivo forte'
    ],
    
    whenToAvoid: [
      'Expectativa de qualquer movimento',
      'Volatilidade implícita baixa',
      'Anomalias detectadas',
      'Risco ilimitado não é aceitável'
    ],
    
    scoringWeights: {
      regime: 0.30,
      volatility: 0.30,
      skew: 0.10,
      gex: 0.15,
      maxPainDistance: 0.15,
      sentiment: 0.00
    }
  }
];

module.exports = { STRATEGIES };
