/**
 * API Server - Express server para expor dados do Gamma Tracker
 */

const express = require('express');
const cors = require('cors');
const Logger = require('../utils/logger');

class APIServer {
  constructor(dataCollector, gexCalculator, regimeAnalyzer, config = {}) {
    this.dataCollector = dataCollector;
    this.gexCalculator = gexCalculator;
    this.regimeAnalyzer = regimeAnalyzer;
    
    this.config = {
      port: config.port || process.env.API_PORT || 3300,
      host: config.host || '0.0.0.0'
    };
    
    this.logger = new Logger('APIServer');
    this.app = express();
    this.server = null;
    
    // Cache de métricas (atualizado periodicamente)
    this.metricsCache = null;
    this.lastMetricsUpdate = 0;
    this.metricsCacheTTL = 5000; // 5 segundos
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Configura middlewares
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Logging middleware
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Configura rotas da API
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // Status do coletor
    this.app.get('/api/status', (req, res) => {
      try {
        const stats = this.dataCollector.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        this.logger.error('Erro ao obter status', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Métricas completas (com cache)
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        this.logger.error('Erro ao obter métricas', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Perfil de gamma
    this.app.get('/api/gamma-profile', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json({
          success: true,
          data: metrics.gammaProfile
        });
      } catch (error) {
        this.logger.error('Erro ao obter perfil de gamma', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // GEX total
    this.app.get('/api/total-gex', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json({
          success: true,
          data: metrics.totalGEX
        });
      } catch (error) {
        this.logger.error('Erro ao obter GEX total', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Gamma Flip
    this.app.get('/api/gamma-flip', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json({
          success: true,
          data: metrics.gammaFlip
        });
      } catch (error) {
        this.logger.error('Erro ao obter gamma flip', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Put/Call Walls
    this.app.get('/api/walls', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json({
          success: true,
          data: {
            putWall: metrics.putWall,
            callWall: metrics.callWall
          }
        });
      } catch (error) {
        this.logger.error('Erro ao obter walls', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Wall Zones (zonas de suporte/resistência)
    this.app.get('/api/wall-zones', async(req, res) => {
      try {
        const metrics = await this.getMetrics();       
        
        if (!metrics || !metrics.gammaProfile || metrics.gammaProfile.length === 0) {
          return res.json({
            success: false,
            error: 'Nenhuma option disponível'
          });
        }        

        const wallZones = this.calculateWallZonesFromProfile(metrics.gammaProfile);
        const spotPrice = metrics.spotPrice;
        
        // Adicionar distâncias do spot
        if (wallZones.putWallZone) {
          wallZones.putWallZone.distanceFromSpot = {
            peak: spotPrice - wallZones.putWallZone.peak,
            zoneLow: spotPrice - wallZones.putWallZone.zoneLow,
            zoneHigh: spotPrice - wallZones.putWallZone.zoneHigh
          };
          wallZones.putWallZone.distancePercent = {
            peak: ((spotPrice - wallZones.putWallZone.peak) / spotPrice) * 100,
            zoneLow: ((spotPrice - wallZones.putWallZone.zoneLow) / spotPrice) * 100,
            zoneHigh: ((spotPrice - wallZones.putWallZone.zoneHigh) / spotPrice) * 100
          };
        }
        
        if (wallZones.callWallZone) {
          wallZones.callWallZone.distanceFromSpot = {
            peak: wallZones.callWallZone.peak - spotPrice,
            zoneLow: wallZones.callWallZone.zoneLow - spotPrice,
            zoneHigh: wallZones.callWallZone.zoneHigh - spotPrice
          };
          wallZones.callWallZone.distancePercent = {
            peak: ((wallZones.callWallZone.peak - spotPrice) / spotPrice) * 100,
            zoneLow: ((wallZones.callWallZone.zoneLow - spotPrice) / spotPrice) * 100,
            zoneHigh: ((wallZones.callWallZone.zoneHigh - spotPrice) / spotPrice) * 100
          };
        }

        res.json({
          success: true,
          data: {
            spotPrice,
            ...wallZones
          }
        });
      } catch (error) {
        this.logger.error('[APIServer] Erro ao calcular wall zones', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });


    // Insights e análise de regime
    this.app.get('/api/insights', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        const insights = this.regimeAnalyzer.generateInsights(metrics);
        res.json({
          success: true,
          data: insights
        });
      } catch (error) {
        this.logger.error('Erro ao gerar insights', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Lista de options
    this.app.get('/api/options', (req, res) => {
      try {
        const options = this.dataCollector.getAllOptions();
        const optionsData = options.map(opt => opt.toJSON());
        
        res.json({
          success: true,
          data: optionsData,
          count: optionsData.length
        });
      } catch (error) {
        this.logger.error('Erro ao obter options', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Options por strike
    this.app.get('/api/options/strike/:strike', (req, res) => {
      try {
        const strike = parseFloat(req.params.strike);
        const options = this.dataCollector.getOptionsByStrike(strike);
        const optionsData = options.map(opt => opt.toJSON());
        
        res.json({
          success: true,
          data: optionsData,
          count: optionsData.length
        });
      } catch (error) {
        this.logger.error('Erro ao obter options por strike', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Strikes únicos
    this.app.get('/api/strikes', (req, res) => {
      try {
        const strikes = this.dataCollector.getUniqueStrikes();
        res.json({
          success: true,
          data: strikes,
          count: strikes.length
        });
      } catch (error) {
        this.logger.error('Erro ao obter strikes', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Datas de expiração únicas
    this.app.get('/api/expiries', (req, res) => {
      try {
        const expiries = this.dataCollector.getUniqueExpiries();
        res.json({
          success: true,
          data: expiries,
          count: expiries.length
        });
      } catch (error) {
        this.logger.error('Erro ao obter expiries', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  /**
   * Obtém métricas (com cache)
   */
  async getMetrics() {
    const now = Date.now();
    
    // Retornar cache se ainda válido
    if (this.metricsCache && (now - this.lastMetricsUpdate) < this.metricsCacheTTL) {
      return this.metricsCache;
    }
    
    // Calcular novas métricas
    const options = this.dataCollector.getAllOptions();
    
    // Usar spot price real do coletor
    const spotPrice = this.dataCollector.spotPrice || this.estimateSpotPrice(options);
    this.gexCalculator.setSpotPrice(spotPrice);
    
    const metrics = this.gexCalculator.calculateAllMetrics(options);
    
    // Atualizar cache
    this.metricsCache = metrics;
    this.lastMetricsUpdate = now;
    
    return metrics;
  }

  /**
 * Calcula wall zones a partir do gamma profile
 */
calculateWallZonesFromProfile(gammaProfile, threshold = 0.7) {
  if (!gammaProfile || gammaProfile.length === 0) {
    return { putWallZone: null, callWallZone: null };
  }

  // Encontrar picos de Put e Call
  const putPeak = gammaProfile.reduce((max, item) => 
    item.putGEX < max.putGEX ? item : max
  );
  
  const callPeak = gammaProfile.reduce((max, item) => 
    item.callGEX > max.callGEX ? item : max
  );

  // Calcular zona de Put Wall
  let putWallZone = null;
  if (putPeak && putPeak.putGEX < 0) {
    const putThreshold = Math.abs(putPeak.putGEX) * threshold;
    const putZoneStrikes = gammaProfile
      .filter(p => p.putGEX < 0 && Math.abs(p.putGEX) >= putThreshold)
      .map(p => ({
        strike: p.strike,
        gex: p.putGEX,
        percentage: (Math.abs(p.putGEX) / Math.abs(putPeak.putGEX)) * 100
      }))
      .sort((a, b) => a.strike - b.strike);

    if (putZoneStrikes.length > 0) {
      const zoneLow = putZoneStrikes[0].strike;
      const zoneHigh = putZoneStrikes[putZoneStrikes.length - 1].strike;
      
      putWallZone = {
        peak: putPeak.strike,
        peakGEX: putPeak.putGEX,
        zoneLow: zoneLow,
        zoneHigh: zoneHigh,
        zoneWidth: zoneHigh - zoneLow,
        zoneStrikes: putZoneStrikes,
        strikeCount: putZoneStrikes.length,
        threshold: threshold,
        totalZoneGEX: putZoneStrikes.reduce((sum, s) => sum + s.gex, 0)
      };
    }
  }

  // Calcular zona de Call Wall
  let callWallZone = null;
  if (callPeak && callPeak.callGEX > 0) {
    const callThreshold = callPeak.callGEX * threshold;
    const callZoneStrikes = gammaProfile
      .filter(p => p.callGEX > 0 && p.callGEX >= callThreshold)
      .map(p => ({
        strike: p.strike,
        gex: p.callGEX,
        percentage: (p.callGEX / callPeak.callGEX) * 100
      }))
      .sort((a, b) => a.strike - b.strike);

    if (callZoneStrikes.length > 0) {
      const zoneLow = callZoneStrikes[0].strike;
      const zoneHigh = callZoneStrikes[callZoneStrikes.length - 1].strike;
      
      callWallZone = {
        peak: callPeak.strike,
        peakGEX: callPeak.callGEX,
        zoneLow: zoneLow,
        zoneHigh: zoneHigh,
        zoneWidth: zoneHigh - zoneLow,
        zoneStrikes: callZoneStrikes,
        strikeCount: callZoneStrikes.length,
        threshold: threshold,
        totalZoneGEX: callZoneStrikes.reduce((sum, s) => sum + s.gex, 0)
      };
    }
  }

  return { putWallZone, callWallZone };
}


  /**
   * Estima o spot price baseado nas options ATM
   */
  estimateSpotPrice(options) {
    // Encontrar options ATM (delta próximo de 0.5 para calls)
    const atmCalls = options
      .filter(opt => opt.side === 'CALL' && opt.delta > 0.4 && opt.delta < 0.6)
      .sort((a, b) => Math.abs(a.delta - 0.5) - Math.abs(b.delta - 0.5));
    
    if (atmCalls.length > 0) {
      return atmCalls[0].strike;
    }
    
    // Fallback: usar média dos strikes
    const strikes = options.map(opt => opt.strike);
    return strikes.reduce((sum, s) => sum + s, 0) / strikes.length;
  }

  /**
   * Inicia o servidor
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.logger.success(`API Server rodando em http://${this.config.host}:${this.config.port}`);
          resolve();
        });
      } catch (error) {
        this.logger.error('Erro ao iniciar servidor', error);
        reject(error);
      }
    });
  }

  /**
   * Para o servidor
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('API Server parado');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = APIServer;