/**
 * EscapeTypeDetector.js
 * 
 * The brain of the Half Pipe Model. Detects the type of price escape from gamma walls
 * by combining data from OrderBook, Liquidations, and GEX.
 * 
 * HYPOTHESES:
 * - H1 (Good Escape): Sustained energy + strong liquidity → Real breakout
 * - H2 (False Escape): Initial energy but weak persistence → Reversal
 * - H3 (Liquidity Collapse): Energy spike + liquidity drain → Violent cascade
 * 
 * SCORING SYSTEM:
 * - Sustained Energy (0-1): From OrderBook (BI, persistence, spread, depth)
 * - Injected Energy (0-1): From Liquidations (volume, cascades)
 * - Potential (0-1): From GEX (magnitude, wall strength, proximity)
 * - P_escape (0-1): totalEnergy / potential
 * 
 * Author: Gamma Tracker Team
 * Date: 2025-12-30
 */

const EventEmitter = require('events');

class EscapeTypeDetector extends EventEmitter {
  constructor(dataCollector) {
    super();
    
    this.dataCollector = dataCollector;
    
    // Detection state
    this.currentDetection = null;
    this.lastUpdate = null;
    
    // Detection history (last 60 minutes at 1/sec = 3600 detections)
    this.detectionHistory = [];
    this.maxHistorySize = 3600;
    
    // Alert system
    this.activeAlerts = [];
    this.maxAlerts = 50;
    
    // Statistics
    this.stats = {
      totalDetections: 0,
      h1Count: 0,
      h2Count: 0,
      h3Count: 0,
      noneCount: 0,
      lastDetectionTime: null
    };
    
    // Thresholds (can be tuned based on backtesting)
    this.thresholds = {
      h1: {
        biPersistence: 0.7,
        orderBookEnergy: 0.6,
        liquidationEnergyMin: 0.4,
        liquidationEnergyMax: 0.7,
        depthChange: -0.2,
        spreadQuality: 0.7,
        wallDistance: 0.05,
        P_escape: 0.6
      },
      h2: {
        biPersistence: 0.4,
        orderBookEnergy: 0.3,
        liquidationEnergy: 0.4,
        wallDistance: 0.03,
        wallStrength: 0.7,
        P_escape: 0.4
      },
      h3: {
        liquidationEnergy: 0.7,
        depthChange: -0.3,
        spreadQuality: 0.5,
        spreadPulse: 2.0,
        P_escape: 0.8
      }
    };
    
    console.log('[EscapeTypeDetector] Initialized');
  }
  
  /**
   * Main detection method - call this every second
   */
  detect() {
    try {
      
      // 1. Collect data from all sources
      const data = this.collectData();
      
      
      
      // 2. Validate data availability
      if (!this.validateData(data)) {
        
        return this.createNoDetection('Insufficient data');
      }
      

      // 3. Calculate combined metrics
      const metrics = this.calculateMetrics(data);
      
      // 4. Evaluate conditions for each hypothesis
      const h1 = this.checkH1Conditions(metrics, data);
      const h2 = this.checkH2Conditions(metrics, data);
      const h3 = this.checkH3Conditions(metrics, data);

      
      
      // 5. Select best match
      const detection = this.selectBestMatch(h1, h2, h3, metrics, data);
      // console.log('[EscapeDetector] ✅ Detection:', detection.type, detection.confidence);
      // 6. Update state and history
      this.updateState(detection);
      
      // 7. Generate alerts if needed
      this.checkAlerts(detection);
      
      return detection;
      
    } catch (error) {
      console.error('[EscapeTypeDetector] ❌ Detection error:', error.message);
      console.error('[EscapeTypeDetector] Stack:', error.stack);
      return this.createNoDetection('Detection error');
    }
  }
  
  /**
   * Collect data from all sources
   */
  collectData() {
    const orderBook = this.dataCollector.getOrderBookMetrics ? 
      this.dataCollector.getOrderBookMetrics() : null;
    
    const liquidations = this.dataCollector.getLiquidationMetrics ? 
      this.dataCollector.getLiquidationMetrics() : null;

     // DEBUG: Ver estrutura dos dados
    // console.log('[EscapeDetector] OrderBook data:', JSON.stringify(orderBook, null, 2));
    // console.log('[EscapeDetector] Liquidations data:', JSON.stringify(liquidations, null, 2))  
    
    const gex = this.dataCollector.getGEX ? 
      this.dataCollector.getGEX() : null;

     // DEBUG: Ver estrutura do GEX
    // console.log('[EscapeDetector] GEX data:', JSON.stringify(gex, null, 2));  
    
    const currentPrice = this.dataCollector.getCurrentPrice ? 
      this.dataCollector.getCurrentPrice() : null;
    
    return {
      orderBook,
      liquidations,
      gex,
      currentPrice,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Validate that we have sufficient data
   */
  validateData(data) {
    return !!(
      data.orderBook && 
      data.liquidations &&       
      data.currentPrice
    );
  }
  
  /**
   * Calculate combined metrics from all sources
   */
  calculateMetrics(data) {
    const sustainedEnergy = this.calculateSustainedEnergy(data.orderBook);
    const injectedEnergy = this.calculateInjectedEnergy(data.liquidations);
    const totalEnergy = (sustainedEnergy + injectedEnergy) / 2;

    // DEBUG: Ver o que está chegando
    //console.log('[EscapeDetector] calculateMetrics - GEX:', {
    //hasGEX: !!data.gex,
    //gexKeys: data.gex ? Object.keys(data.gex) : null,
    //totalGEX: data.gex?.totalGEX,
    //putWall: data.gex?.putWall,
    //callWall: data.gex?.callWall,
    //currentPrice: data.currentPrice
    // });
    
    const potential = this.calculatePotential(data.gex, data.currentPrice);
    

    const P_escape = this.calculateEscapeProbability(totalEnergy, potential);
    
    const direction = this.determineDirection(data.orderBook, data.liquidations);
    const wallInfo = this.getNearestWall(data.gex, data.currentPrice, direction);
    
    return {
      sustainedEnergy,
      injectedEnergy,
      totalEnergy,
      potential,
      P_escape,
      direction,
      wallInfo
    };
  }
  
  /**
   * Calculate sustained energy from OrderBook
   */
  calculateSustainedEnergy(orderBook) {
    if (!orderBook || !orderBook.BI === undefined) return 0;
    
    const biMagnitude = Math.abs(orderBook.BI || 0);
    const persistence = orderBook.BI_persistence || 0;
    // const spreadQuality = orderBook.spreadQuality?.score || 0;
    const spreadPct = Math.abs(orderBook.spread_pct || 0);
    const spreadQuality = Math.max(0, Math.min(1, 1 - (spreadPct * 10000))); // 0.01% = 0.9 quality
    
    // Depth component: positive if depth growing, negative if shrinking
    const depthChange = orderBook.depth?.depthChange || 0;
    const depthComponent = Math.max(0, Math.min(1, (depthChange + 0.5) / 1.0));
    
    const sustainedEnergy = (
      biMagnitude * 0.4 +
      persistence * 0.3 +
      spreadQuality * 0.2 +
      depthComponent * 0.1
    );
    
    return Math.max(0, Math.min(1, sustainedEnergy));
  }
  
  /**
   * Calculate injected energy from Liquidations
   */
  calculateInjectedEnergy(liquidations) {
    if (!liquidations || !liquidations.energy) return 0;
    
    return liquidations.energy.score || 0;
  }
  
  /**
   * Calculate potential from GEX
   */
  calculatePotential(gex, currentPrice) {
    if (!gex || !currentPrice) {
      
      return 0.5; // Default medium potential
    }
    
    // GEX magnitude component (normalized to 0-1)
     // Handle both number and object formats
     const totalGEXValue = typeof gex.totalGEX === 'object' 
    ? Math.abs(gex.totalGEX.total || 0)  // ✅ Pega .total se for objeto
    : Math.abs(gex.totalGEX || 0);        // ✅ Usa direto se for número

    const gexMagnitude = totalGEXValue / 1e9; // Billions
    const gexComponent = Math.min(1, gexMagnitude / 0.5); // Cap at $500M

    // Wall strength component
    const putWallGEX = Math.abs(gex.putWall?.gex || 0);
    const callWallGEX = Math.abs(gex.callWall?.gex || 0);

    // Use the stronger wall
    const strongerWallGEX = Math.max(putWallGEX, callWallGEX);
    const wallStrength = Math.min(1, strongerWallGEX / 1e9); // Normalize

    // Wall proximity component
    const putWallDistance = gex.putWall?.distancePercent || 1;
    const callWallDistance = gex.callWall?.distancePercent || 1;

    // Use the closer wall
    const closerWallDistance = Math.min(putWallDistance, callWallDistance);
    const wallProximity = Math.max(0, 1 - closerWallDistance); // Closer = higher score
    
    // Wall strength component
    // const putWall = gex.putWall || {};
    // const callWall = gex.callWall || {};
    // const maxWallStrength = Math.max(
    //  putWall.strength || 0,
    //  callWall.strength || 0
    // );
    
    // Wall proximity component (closer = higher potential)
    //const putDistance = putWall.strike ? 
    //  Math.abs(currentPrice - putWall.strike) / currentPrice : 1;
    //const callDistance = callWall.strike ? 
   //   Math.abs(currentPrice - callWall.strike) / currentPrice : 1;
    //const minDistance = Math.min(putDistance, callDistance);
    //const proximityComponent = Math.max(0, 1 - (minDistance / 0.1)); // Within 10%
    
    const potential = (
      gexComponent * 0.6 +
      wallStrength * 0.3 +
      wallProximity * 0.1
    );
    
    return Math.max(0, Math.min(1, potential)); // Min 0.1 to avoid division by zero
  }
  
  /**
   * Calculate escape probability
   */
  calculateEscapeProbability(totalEnergy, potential) {
    if (potential === 0) return 0;
    
    const P_escape = totalEnergy / potential;
    return Math.max(0, Math.min(1, P_escape));
  }
  
  /**
   * Determine market direction
   */
  determineDirection(orderBook, liquidations) {

    const biDirection = orderBook?.BI_direction || 'NEUTRAL';
    const liqDirection = liquidations?.energy?.direction || 'NEUTRAL';
    
    
    // Primary signal: Book Imbalance
    if (biDirection === liqDirection && biDirection !== 'NEUTRAL') {
      return biDirection === 'BULLISH' ? 'UP' : 'DOWN';
    }

    // If BI is stronger, use its direction
    const biStrength = Math.abs(orderBook?.BI || 0);
    if (biStrength > 0.6) {
      return biDirection === 'BULLISH' ? 'UP' : 
            biDirection === 'BEARISH' ? 'DOWN' : 'NEUTRAL';
    }

    // If liquidations are stronger, use their direction
    const liqEnergy = liquidations?.energy?.score || 0;
    if (liqEnergy > 0.6) {
      return liqDirection === 'BULLISH' ? 'UP' :
            liqDirection === 'BEARISH' ? 'DOWN' : 'NEUTRAL';   }
    
  
    
    return 'NEUTRAL';
  }
  
  /**
   * Get nearest wall in the direction of movement
   */
  getNearestWall(gex, currentPrice, direction) {
    if (!gex || !currentPrice) return null;
    
    const putWall = gex.putWall || {};
    const callWall = gex.callWall || {};

    // Helper function to calculate strength from gex value
    const calculateStrength = (gexValue) => {
      if (gexValue === undefined || gexValue === null) return 0;
      const absGex = Math.abs(gexValue);
      return Math.min(1, absGex / 1e9); // $1B = max strength
    };
    
    let targetWall = null;
    
    if (direction === 'DOWN' && putWall.strike) {
      targetWall = {
        type: 'put',
        strike: putWall.strike,
        strength: calculateStrength(putWall.gex),
        distance: (currentPrice - putWall.strike) / currentPrice,
        distanceAbs: Math.abs(currentPrice - putWall.strike)
      };
    } else if (direction === 'UP' && callWall.strike) {
      targetWall = {
        type: 'call',
        strike: callWall.strike,
        strength: calculateStrength(callWall.gex),
        distance: (callWall.strike - currentPrice) / currentPrice,
        distanceAbs: Math.abs(callWall.strike - currentPrice)
      };
    } else {
      // Neutral: pick nearest wall
      const putDist = putWall.strike ? Math.abs(currentPrice - putWall.strike) : Infinity;
      const callDist = callWall.strike ? Math.abs(callWall.strike - currentPrice) : Infinity;
      
      if (putDist < callDist && putWall.strike) {
        targetWall = {
          type: 'put',
          strike: putWall.strike,
          strength: calculateStrength(putWall.gex),
          distance: (currentPrice - putWall.strike) / currentPrice,
          distanceAbs: putDist
        };
      } else if (callWall.strike) {
        targetWall = {
          type: 'call',
          strike: callWall.strike,
          strength: calculateStrength(callWall.gex),
          distance: (callWall.strike - currentPrice) / currentPrice,
          distanceAbs: callDist
        };
      }
    }
    
    return targetWall;
  }
  
  /**
   * Check H1 (Good Escape) conditions
   */
  checkH1Conditions(metrics, data) {
    const t = this.thresholds.h1;
    const ob = data.orderBook;
    const liq = data.liquidations;
    
    const checks = {
      biPersistence: {
        value: ob.biPersistence?.value || 0,
        threshold: t.biPersistence,
        met: (ob.biPersistence?.value || 0) > t.biPersistence
      },
      orderBookEnergy: {
        value: metrics.sustainedEnergy,
        threshold: t.orderBookEnergy,
        met: metrics.sustainedEnergy > t.orderBookEnergy
      },
      liquidationEnergy: {
        value: metrics.injectedEnergy,
        threshold: [t.liquidationEnergyMin, t.liquidationEnergyMax],
        met: metrics.injectedEnergy >= t.liquidationEnergyMin && 
             metrics.injectedEnergy <= t.liquidationEnergyMax
      },
      cascadeDetected: {
        value: liq?.cascade?.detected || false,
        expected: false,
        met: !(liq?.cascade?.detected || false)
      },
      depthChange: {
        value: ob.depth?.depthChange || 0,
        threshold: t.depthChange,
        met: (ob.depth?.depthChange || 0) > t.depthChange
      },
      spreadQuality: {
        value: ob.spreadQuality?.score || 0,
        threshold: t.spreadQuality,
        met: (ob.spreadQuality?.score || 0) > t.spreadQuality
      },
      wallDistance: {
        value: metrics.wallInfo?.distance || 1,
        threshold: t.wallDistance,
        met: (metrics.wallInfo?.distance || 1) < t.wallDistance
      },
      P_escape: {
        value: metrics.P_escape,
        threshold: t.P_escape,
        met: metrics.P_escape > t.P_escape
      }
    };
    
    // Calculate score (% of conditions met)
    const totalChecks = Object.keys(checks).length;
    const metChecks = Object.values(checks).filter(c => c.met).length;
    const score = metChecks / totalChecks;
    
    // Calculate confidence (weighted by importance)
    const confidence = (
      (checks.biPersistence.met ? 0.2 : 0) +
      (checks.orderBookEnergy.met ? 0.2 : 0) +
      (checks.liquidationEnergy.met ? 0.15 : 0) +
      (checks.cascadeDetected.met ? 0.1 : 0) +
      (checks.depthChange.met ? 0.1 : 0) +
      (checks.spreadQuality.met ? 0.1 : 0) +
      (checks.wallDistance.met ? 0.05 : 0) +
      (checks.P_escape.met ? 0.1 : 0)
    );
    
    return {
      type: 'H1',
      score,
      confidence,
      checks,
      met: score > 0.6 // Need 60% of conditions
    };
  }
  
  /**
   * Check H2 (False Escape) conditions
   */
  checkH2Conditions(metrics, data) {
    const t = this.thresholds.h2;
    const ob = data.orderBook;
    const liq = data.liquidations;
    
    const checks = {
      biPersistence: {
        value: ob.biPersistence?.value || 0,
        threshold: t.biPersistence,
        met: (ob.biPersistence?.value || 0) < t.biPersistence // LOW persistence
      },
      orderBookEnergy: {
        value: metrics.sustainedEnergy,
        threshold: t.orderBookEnergy,
        met: metrics.sustainedEnergy > t.orderBookEnergy && 
             metrics.sustainedEnergy < 0.7 // Medium energy
      },
      liquidationEnergy: {
        value: metrics.injectedEnergy,
        threshold: t.liquidationEnergy,
        met: metrics.injectedEnergy < t.liquidationEnergy // LOW liquidations
      },
      cascadeDetected: {
        value: liq?.cascade?.detected || false,
        expected: false,
        met: !(liq?.cascade?.detected || false)
      },
      wallDistance: {
        value: metrics.wallInfo?.distance || 1,
        threshold: t.wallDistance,
        met: (metrics.wallInfo?.distance || 1) < t.wallDistance // Very close
      },
      wallStrength: {
        value: metrics.wallInfo?.strength || 0,
        threshold: t.wallStrength,
        met: (metrics.wallInfo?.strength || 0) > t.wallStrength // Strong wall
      },
      P_escape: {
        value: metrics.P_escape,
        threshold: t.P_escape,
        met: metrics.P_escape < t.P_escape // LOW probability
      }
    };
    
    const totalChecks = Object.keys(checks).length;
    const metChecks = Object.values(checks).filter(c => c.met).length;
    const score = metChecks / totalChecks;
    
    const confidence = (
      (checks.biPersistence.met ? 0.25 : 0) +
      (checks.orderBookEnergy.met ? 0.15 : 0) +
      (checks.liquidationEnergy.met ? 0.15 : 0) +
      (checks.cascadeDetected.met ? 0.1 : 0) +
      (checks.wallDistance.met ? 0.1 : 0) +
      (checks.wallStrength.met ? 0.15 : 0) +
      (checks.P_escape.met ? 0.1 : 0)
    );
    
    return {
      type: 'H2',
      score,
      confidence,
      checks,
      met: score > 0.6
    };
  }
  
  /**
   * Check H3 (Liquidity Collapse) conditions
   */
  checkH3Conditions(metrics, data) {
    const t = this.thresholds.h3;
    const ob = data.orderBook;
    const liq = data.liquidations;
    
    const checks = {
      liquidationEnergy: {
        value: metrics.injectedEnergy,
        threshold: t.liquidationEnergy,
        met: metrics.injectedEnergy > t.liquidationEnergy // VERY HIGH
      },
      cascadeDetected: {
        value: liq?.cascade?.detected || false,
        expected: true,
        met: liq?.cascade?.detected || false // CASCADE!
      },
      depthChange: {
        value: ob.depth?.depthChange || 0,
        threshold: t.depthChange,
        met: (ob.depth?.depthChange || 0) < t.depthChange // Draining
      },
      spreadQuality: {
        value: ob.spreadQuality?.score || 1,
        threshold: t.spreadQuality,
        met: (ob.spreadQuality?.score || 1) < t.spreadQuality // Poor quality
      },
      spreadPulse: {
        value: ob.spreadQuality?.pulse || 0,
        threshold: t.spreadPulse,
        met: (ob.spreadQuality?.pulse || 0) > t.spreadPulse // High volatility
      },
      P_escape: {
        value: metrics.P_escape,
        threshold: t.P_escape,
        met: metrics.P_escape > t.P_escape // VERY HIGH probability
      }
    };
    
    const totalChecks = Object.keys(checks).length;
    const metChecks = Object.values(checks).filter(c => c.met).length;
    const score = metChecks / totalChecks;
    
    const confidence = (
      (checks.liquidationEnergy.met ? 0.25 : 0) +
      (checks.cascadeDetected.met ? 0.3 : 0) +
      (checks.depthChange.met ? 0.15 : 0) +
      (checks.spreadQuality.met ? 0.1 : 0) +
      (checks.spreadPulse.met ? 0.1 : 0) +
      (checks.P_escape.met ? 0.1 : 0)
    );
    
    return {
      type: 'H3',
      score,
      confidence,
      checks,
      met: score > 0.5 // Lower threshold for H3 (dangerous!)
    };
  }
  
  /**
   * Select best matching hypothesis
   */
  selectBestMatch(h1, h2, h3, metrics, data) {
    // Filter candidates that meet minimum requirements
    const candidates = [h1, h2, h3].filter(h => h.met);
    
    if (candidates.length === 0) {
      return this.createNoDetection('No clear pattern', metrics, data);
    }
    
    // Select highest confidence
    const best = candidates.reduce((prev, curr) => 
      curr.confidence > prev.confidence ? curr : prev
    );
    
    // Create full detection object
    return this.createDetection(best, metrics, data);
  }
  
  /**
   * Create detection object
   */
  createDetection(hypothesis, metrics, data) {
    const interpretation = this.generateInterpretation(hypothesis, metrics, data);
    
    return {
      type: hypothesis.type,
      confidence: hypothesis.confidence,
      direction: metrics.direction,
      timestamp: data.timestamp,
      interpretation,
      metrics: {
        sustainedEnergy: metrics.sustainedEnergy,
        injectedEnergy: metrics.injectedEnergy,
        totalEnergy: metrics.totalEnergy,
        potential: metrics.potential,
        P_escape: metrics.P_escape
      },
      conditions: hypothesis.checks,
      wallInfo: metrics.wallInfo,
      rawData: {
        currentPrice: data.currentPrice,
        gammaFlip: data.gex?.gammaFlip,
        bookImbalance: data.orderBook?.bookImbalance?.value,
        biPersistence: data.orderBook?.biPersistence?.value,
        liquidationVolume5min: data.liquidations?.recent5min?.totalVolume,
        cascadeDetected: data.liquidations?.cascade?.detected
      }
    };
  }
  
  /**
   * Create no-detection object
   */
  createNoDetection(reason, metrics = null, data = null) {
    // Build metrics object
    const metricsObj = metrics ? {
    sustainedEnergy: metrics.sustainedEnergy || 0,
    injectedEnergy: metrics.injectedEnergy || 0,
    totalEnergy: metrics.totalEnergy || 0,
    potential: metrics.potential || 0,
    P_escape: metrics.P_escape || 0,
    direction: metrics.direction || 'NEUTRAL',
    wallInfo: metrics.wallInfo || null
    } : {};

    // Build rawData object
    const rawDataObj = data ? {
    currentPrice: data.currentPrice || null,
    gammaFlip: data.gex?.gammaFlip || null,
    bookImbalance: data.orderBook?.BI || null,
    biPersistence: data.orderBook?.BI_persistence || null,
    liquidationVolume5min: data.liquidations?.recent5min?.totalVolume || null,
    cascadeDetected: data.liquidations?.cascade?.detected || false
    } : {};

    return {
      type: 'NONE',
      confidence: 0,
      direction: 'NEUTRAL',
      timestamp: data.timestamp || new Date().toISOString(),
      interpretation: `No clear escape pattern detected. ${reason}`,
      metrics: metrics || {},
      conditions: {},
      wallInfo: null,
      rawData: {}
    };
  }
  
  /**
   * Generate human-readable interpretation
   */
    generateInterpretation(type, confidence, metrics, data) {
    const { sustainedEnergy, injectedEnergy, potential, P_escape } = metrics;
    
    // Para H2, inverter a probabilidade
    const effectiveP = (type === 'H2') ? (1 - P_escape) : P_escape;
    
    // Classificar probabilidade
    const probClass = effectiveP > 0.7 ? 'High' : 
                    effectiveP > 0.4 ? 'Medium' : 'Low';
      
    if (type === 'H1') {
      return `🚀 GOOD ESCAPE detected with ${(confidence * 100).toFixed(0)}% confidence!.${probClass}
      probability (${(effectiveP *100).toFixed(0)}%) of sustained breakout.`
    }
    
    if (type === 'H2') {
      return ` FALSE ESCAPE detected with ${(confidence * 100).toFixed(0)}% confidence!. ${probClass}
      probability (${(effectiveP *100).toFixed(0)}%) of reversal back into the Half Pipe.`
    }
    
    if (type === 'H3') {
      return `💀 LIQUIDITY COLLAPSE detected with ${(confidence * 100).toFixed(0)}% confidence! ` +
        `DANGER: Liquidation cascade in progress ($${(liq.recent5min?.totalVolume / 1e6).toFixed(1)}M in 5min). ` +
        `Liquidity draining (depth: ${(ob.depth?.depthChange * 100).toFixed(0)}%), ` +
        `spreads widening (quality: ${(ob.spreadQuality?.score * 100).toFixed(0)}%). ` +
        `Very high probability (${(P_escape * 100).toFixed(0)}%) of violent ${direction.toLowerCase()} move. ` +
        `Stay out or use wide stops!`;
    }
    
    return 'No clear pattern detected.';
  }
  
  /**
   * Update internal state
   */
  updateState(detection) {
    this.currentDetection = detection;
    this.lastUpdate = new Date();
    
    // Add to history
    this.detectionHistory.push({
      timestamp: detection.timestamp,
      type: detection.type,
      confidence: detection.confidence,
      P_escape: detection.metrics.P_escape,
      direction: detection.direction
    });
    
    // Trim history
    if (this.detectionHistory.length > this.maxHistorySize) {
      this.detectionHistory.shift();
    }
    
    // Update stats
    this.stats.totalDetections++;
    this.stats.lastDetectionTime = detection.timestamp;
    
    if (detection.type === 'H1') this.stats.h1Count++;
    else if (detection.type === 'H2') this.stats.h2Count++;
    else if (detection.type === 'H3') this.stats.h3Count++;
    else this.stats.noneCount++;
    
    // Emit event
    this.emit('detection', detection);
    
    if (detection.type === 'H1') this.emit('h1_detected', detection);
    else if (detection.type === 'H2') this.emit('h2_detected', detection);
    else if (detection.type === 'H3') this.emit('h3_detected', detection);
  }
  
  /**
   * Check if alerts should be generated
   */
  checkAlerts(detection) {
    const alerts = [];
    
    // H1 detected
    if (detection.type === 'H1' && detection.confidence > 0.7) {
      alerts.push({
        id: `alert_${Date.now()}_h1`,
        type: 'H1_DETECTED',
        severity: 'HIGH',
        timestamp: detection.timestamp,
        message: `Good Escape detected with ${(detection.confidence * 100).toFixed(0)}% confidence`,
        details: detection
      });
    }
    
    // H2 detected
    if (detection.type === 'H2' && detection.confidence > 0.7) {
      alerts.push({
        id: `alert_${Date.now()}_h2`,
        type: 'H2_DETECTED',
        severity: 'MEDIUM',
        timestamp: detection.timestamp,
        message: `False Escape detected with ${(detection.confidence * 100).toFixed(0)}% confidence`,
        details: detection
      });
    }
    
    // H3 detected (CRITICAL!)
    if (detection.type === 'H3') {
      alerts.push({
        id: `alert_${Date.now()}_h3`,
        type: 'H3_DETECTED',
        severity: 'CRITICAL',
        timestamp: detection.timestamp,
        message: `⚠️ LIQUIDITY COLLAPSE detected with ${(detection.confidence * 100).toFixed(0)}% confidence!`,
        details: detection
      });
    }
    
    // High P_escape
    if (detection.metrics.P_escape > 0.8) {
      alerts.push({
        id: `alert_${Date.now()}_pescape`,
        type: 'HIGH_P_ESCAPE',
        severity: 'MEDIUM',
        timestamp: detection.timestamp,
        message: `Escape probability increased to ${(detection.metrics.P_escape * 100).toFixed(0)}%`,
        details: detection
      });
    }
    
    // Add alerts
    alerts.forEach(alert => {
      this.activeAlerts.unshift(alert); // Add to front
      this.emit('alert', alert);
    });
    
    // Trim alerts
    if (this.activeAlerts.length > this.maxAlerts) {
      this.activeAlerts = this.activeAlerts.slice(0, this.maxAlerts);
    }
  }
  
  /**
   * Get current detection
   */
  getCurrentDetection() {
    return this.currentDetection;
  }
  
  /**
   * Get detection history
   */
  getHistory(minutes = 60) {
    if (!minutes) return this.detectionHistory;
    
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.detectionHistory.filter(d => 
      new Date(d.timestamp) >= cutoff
    );
  }
  
  /**
   * Get active alerts
   */
  getAlerts() {
    return this.activeAlerts;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const avgConfidence = this.detectionHistory.length > 0 ?
      this.detectionHistory.reduce((sum, d) => sum + d.confidence, 0) / this.detectionHistory.length :
      0;
    
    return {
      ...this.stats,
      historySize: this.detectionHistory.length,
      averageConfidence: avgConfidence,
      activeAlerts: this.activeAlerts.length
    };
  }
  
  /**
   * Clear alerts
   */
  clearAlerts() {
    this.activeAlerts = [];
  }
}

module.exports = EscapeTypeDetector;
