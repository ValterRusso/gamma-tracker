/**
 * ============================================================================
 * GAMMA TRACKER - API SERVER
 * ============================================================================
 * 
 * Express API server para expor dados do Gamma Tracker em tempo real.
 * 
 * COMPONENTES PRINCIPAIS:
 * - DataCollector: Coleta dados de options da Binance
 * - GEXCalculator: Calcula Gamma Exposure
 * - RegimeAnalyzer: Analisa regime de mercado
 * - VolatilitySurfaceCalculator: Constrói superfície de volatilidade
 * - MaxPainCalculator: Calcula Max Pain
 * - SentimentAnalyzer: Analisa sentimento Put/Call
 * - StrategyRecommender: Recomenda estratégias de options
 * - LiquidationTracker: Rastreia liquidações forçadas (Binance Futures)
 * 
 * ENDPOINTS DISPONÍVEIS:
 * 
 * SISTEMA:
 * - GET /health                           - Health check
 * - GET /api/status                       - Status do coletor
 * 
 * MÉTRICAS:
 * - GET /api/metrics                      - Métricas completas (cached)
 * - GET /api/gamma-profile                - Perfil de gamma por strike
 * - GET /api/total-gex                    - GEX total
 * - GET /api/gamma-flip                   - Gamma flip level
 * - GET /api/walls                        - Put/Call walls
 * - GET /api/wall-zones                   - Zonas de suporte/resistência
 * 
 * VOLATILIDADE:
 * - GET /api/vol-surface                  - Superfície de volatilidade 3D
 * - GET /api/vol-skew                     - Volatility skew 2D
 * - GET /api/anomalies                    - Anomalias de volatilidade
 * 
 * MAX PAIN & SENTIMENT:
 * - GET /api/max-pain                     - Max Pain strike
 * - GET /api/sentiment                    - Análise de sentimento
 * 
 * ESTRATÉGIAS:
 * - GET /api/strategies/recommend         - Recomendações (top N)
 * - GET /api/strategies/all               - Todas as estratégias com scores
 * - GET /api/strategies/:id               - Estratégia específica
 * 
 * LIQUIDAÇÕES (NOVO):
 * - GET /api/liquidations/stats           - Estatísticas gerais
 * - GET /api/liquidations/energy          - Energy score (Half Pipe)
 * - GET /api/liquidations/summary         - Resumo completo
 * - GET /api/liquidations/recent          - Liquidações recentes
 * - GET /api/liquidations/early           - Early spike detection (H2)
 * - GET /api/liquidations/growth          - Taxa de crescimento (H1)
 * - GET /api/liquidations/cascade         - Detecção de cascata
 * 
 * HISTÓRICO (DATABASE):
 * - GET /api/market-history               - Histórico de snapshots
 * - GET /api/regime-history               - Histórico de regimes
 * 
 * PORTA: 3300 (padrão)
 * CORS: Habilitado
 * CACHE: Métricas com TTL de 5 segundos
 * 
 * ============================================================================
 */


const express = require('express');
const cors = require('cors');
const Logger = require('../utils/logger');
const VolatilitySurfaceCalculator = require('../calculators/VolatilitySurfaceCalculator');
const VolatilityAnomalyDetector = require('../calculators/VolatilityAnomalyDetector');
const MaxPainCalculator = require('../calculators/MaxPainCalculator');
const SentimentAnalyzer = require('../calculators/SentimentAnalyzer');
const { STRATEGIES } = require('../recommender/strategies');
const MarketStateAnalyzer = require('../recommender/MarketStateAnalyzer');
const StrategyRecommender = require('../recommender/StrategyRecommender');
const { Op } = require('sequelize');


class APIServer {
  constructor(dataCollector, gexCalculator, regimeAnalyzer, database, config = {}) {
    this.dataCollector = dataCollector;
    this.gexCalculator = gexCalculator;
    this.regimeAnalyzer = regimeAnalyzer;
    this.db = database;
    this.volSurfaceCalculator = new VolatilitySurfaceCalculator();
    this.maxPainCalculator = new MaxPainCalculator(this.logger);
    this.sentimentAnalyzer = new SentimentAnalyzer(this.logger);

    this.config = {
      port: config.port || process.env.API_PORT || 3300,
      host: config.host || '0.0.0.0'
    };

    this.logger = new Logger('APIServer');
    this.anomalyDetector = new VolatilityAnomalyDetector(this.logger);
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
  // ========================================
  // SISTEMA - health, status
  // ========================================    
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

    // ========================================
    // MÉTRICAS
    // ========================================
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
    // Gamma Profile (com filtro inteligente)
    this.app.get('/api/gamma-profile', async (req, res) => {
      try {
        const metrics = await this.getMetrics();

        if (!metrics || !metrics.gammaProfile || metrics.gammaProfile.length === 0) {
          return res.json({
            success: false,
            error: 'Nenhum dado disponível'
          });
        }

        // Parâmetros de filtro (query params)
        const rangePercent = parseFloat(req.query.range) || 0.3; // padrão: ±30%
        const gexThreshold = parseFloat(req.query.threshold) || 0.02; // padrão: 2%
        const autoRange = req.query.auto !== 'false'; // padrão: true

        let profile = metrics.gammaProfile;
        let rangeInfo = null;

        // Aplicar filtro inteligente se auto=true
        if (autoRange) {
          // Buscar wall zones para cálculo inteligente
          const wallZones = this.calculateWallZonesFromProfile(metrics.gammaProfile);

          const smartRange = this.gexCalculator.calculateSmartRange(
            metrics.gammaProfile,
            metrics.spotPrice,
            wallZones,
            rangePercent,
            gexThreshold
          );

          profile = smartRange.filteredProfile;
          rangeInfo = {
            minStrike: smartRange.minStrike,
            maxStrike: smartRange.maxStrike,
            totalStrikes: smartRange.totalStrikes,
            filteredStrikes: smartRange.filteredStrikes,
            compressionRatio: smartRange.compressionRatio,
            rangePercent: rangePercent,
            gexThreshold: gexThreshold
          };
        }

        res.json({
          success: true,
          data: profile,
          rangeInfo: rangeInfo,
          spotPrice: metrics.spotPrice
        });
      } catch (error) {
        this.logger.error('Erro ao gerar gamma profile', error);
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
    this.app.get('/api/wall-zones', async (req, res) => {
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

    // Volatility Surface (superfície de volatilidade 3D)
    this.app.get('/api/vol-surface', async (req, res) => {
      try {
        const metrics = await this.getMetrics();

        if (!metrics || !metrics.gammaProfile || metrics.gammaProfile.length === 0) {
          return res.json({
            success: false,
            error: 'Nenhum dado disponível'
          });
        }

        // Obter todas as options (não apenas o profile)
        // Precisamos das options completas com IV, expiry, etc.
        const allOptions = this.dataCollector.getAllOptions();

        if (!allOptions || allOptions.length === 0) {
          return res.json({
            success: false,
            error: 'Nenhuma option disponível'
          });
        }

        const spotPrice = metrics.spotPrice;
        const surface = this.volSurfaceCalculator.buildSurface(allOptions, spotPrice);

        if (!surface) {
          return res.json({
            success: false,
            error: 'Não foi possível construir superfície de volatilidade'
          });
        }

        res.json({
          success: true,
          data: surface
        });
      } catch (error) {
        this.logger.error('Erro ao gerar vol surface', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    // Endpoint: Detectar anomalias na volatility surface
    this.app.get('/api/vol-anomalies', async (req, res) => {
      try {
        this.logger.info('[API] GET /api/vol-anomalies - Iniciando detecção de anomalias');

        // Obter todas as options
        const allOptions = this.dataCollector.getAllOptions();

        if (!allOptions || allOptions.length === 0) {
          return res.json({
            success: true,
            data: {
              anomalies: [],
              stats: {
                total: 0,
                byType: { ivOutlier: 0, skewAnomaly: 0 },
                bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                byPriceType: { overpriced: 0, underpriced: 0 },
                avgRelevance: 0
              },
              threshold: 2.0,
              spotPrice: 0
            }
          });
        }
        // Obter spot price
        const metrics = await this.getMetrics();
        const spotPrice = metrics ? metrics.spotPrice : 0;

        // Construir superfície de volatilidade
        const surfaceData = this.volSurfaceCalculator.buildSurface(
          allOptions,
          spotPrice
        );

        if (!surfaceData) {
          return res.json({
            success: false,
            error: 'Não foi possível construir superfície de volatilidade'
          });
        }

        // Threshold configurável via query param (padrão: 2.0)
        const threshold = parseFloat(req.query.threshold) || 2.0;

        // Limite de resultados (padrão: 50, máximo: 200)
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);

        // Filtro por severidade (opcional)
        const severityFilter = req.query.severity?.toUpperCase(); // CRITICAL, HIGH, MEDIUM, LOW

        // Filtro por tipo (opcional)
        const typeFilter = req.query.type?.toUpperCase(); // IV_OUTLIER, SKEW_ANOMALY

        // Detectar anomalias
        let anomalies = this.anomalyDetector.detectAnomalies(surfaceData, threshold);

        // Aplicar filtros
        if (severityFilter) {
          anomalies = anomalies.filter(a => a.severity === severityFilter);
        }

        if (typeFilter) {
          anomalies = anomalies.filter(a => a.type === typeFilter);
        }

        // Gerar estatísticas
        const stats = this.anomalyDetector.generateStats(anomalies);

        // Limitar resultados
        const limitedAnomalies = anomalies.slice(0, limit);

        this.logger.info(`[API] Anomalias detectadas: ${anomalies.length} (retornando top ${limitedAnomalies.length})`);

        res.json({
          success: true,
          data: {
            anomalies: limitedAnomalies,
            stats,
            threshold,
            spotPrice: surfaceData.spotPrice,
            filters: {
              severity: severityFilter || 'ALL',
              type: typeFilter || 'ALL',
              limit
            }
          }
        });

      } catch (error) {
        this.logger.error('[API] Erro ao detectar anomalias:', error);
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

    // ========================================
    // MAX PAIN & SENTIMENT
    // ========================================

    // Max Pain endpoint
    this.app.get('/api/max-pain', async (req, res) => {
      try {
        const options = this.dataCollector.getAllOptions();
        const spotPrice = this.dataCollector.spotPrice;

        if (!options || options.length === 0) {
          return res.json({
            success: false,
            error: 'Nenhuma option disponível'
          });
        }

        // Calcular Max Pain
        const maxPain = this.maxPainCalculator.calculateMaxPain(options, spotPrice);

        if (!maxPain) {
          return res.json({
            success: false,
            error: 'Não foi possível calcular Max Pain'
          });
        }

        res.json({
          success: true,
          data: {
            maxPainStrike: maxPain.maxPainStrike,
            maxPainOI: maxPain.maxPainOI,
            maxPainCallOI: maxPain.maxPainCallOI,
            maxPainPutOI: maxPain.maxPainPutOI,
            spotPrice: spotPrice,
            analysis: maxPain.analysis,
            topStrikes: maxPain.strikeOIMap ?
              Object.entries(maxPain.strikeOIMap)
                .sort((a, b) => b[1].totalOI - a[1].totalOI)
                .slice(0, 10)
                .map(([strike, data]) => ({
                  strike: parseFloat(strike),
                  totalOI: data.totalOI,
                  callOI: data.callOI,
                  putOI: data.putOI
                })) : []
          }
        });
      } catch (error) {
        this.logger.error('Erro ao obter Max Pain', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Sentiment Analysis endpoint
    this.app.get('/api/sentiment', async (req, res) => {
      try {
        const options = this.dataCollector.getAllOptions();

        if (!options || options.length === 0) {
          return res.json({
            success: false,
            error: 'Nenhuma option disponível'
          });
        }

        // Calcular Sentiment
        const sentiment = this.sentimentAnalyzer.analyzeSentiment(options);

        if (!sentiment) {
          return res.json({
            success: false,
            error: 'Não foi possível analisar sentimento'
          });
        }

        res.json({
          success: true,
          data: sentiment
        });
      } catch (error) {
        this.logger.error('Erro ao obter sentimento', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Anomalies endpoint with filters
    this.app.get('/api/anomalies', async (req, res) => {
      try {
        const AnomaliesLog = this.db.getModel('AnomaliesLog');
        const { Op } = require('sequelize');

        // Query parameters
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const anomalyType = req.query.type; // IV_OUTLIER, SKEW_ANOMALY, etc.
        const minZScore = parseFloat(req.query.minZScore) || 0;
        const maxSpread = parseFloat(req.query.maxSpread); // Filter by liquidity
        const minOIVolRatio = parseFloat(req.query.minOIVolRatio); // Filter by position age
        const minDTE = parseInt(req.query.minDTE);
        const maxDTE = parseInt(req.query.maxDTE);

        // Build where clause
        const where = {};

        if (anomalyType) {
          where.anomaly_type = anomalyType;
        }

        if (minZScore > 0) {
          where.z_score = { [Op.gte]: minZScore };
        }

        if (maxSpread) {
          where.spread_pct = { [Op.lte]: maxSpread };
        }

        if (minOIVolRatio) {
          where.oi_volume_ratio = { [Op.gte]: minOIVolRatio };
        }

        if (minDTE || maxDTE) {
          where.dte = {};
          if (minDTE) where.dte[Op.gte] = minDTE;
          if (maxDTE) where.dte[Op.lte] = maxDTE;
        }

        // Query anomalies
        const anomalies = await AnomaliesLog.findAll({
          where: where,
          order: [['created_at', 'DESC']],
          limit: limit,
          offset: offset
        });

        // Count total
        const total = await AnomaliesLog.count({ where: where });

        // Group by type for summary
        const summary = await AnomaliesLog.findAll({
          attributes: [
            'anomaly_type',
            [this.db.sequelize.fn('COUNT', this.db.sequelize.col('id')), 'count'],
            [this.db.sequelize.fn('AVG', this.db.sequelize.col('z_score')), 'avg_z_score']
          ],
          where: where,
          group: ['anomaly_type'],
          raw: true
        });

        res.json({
          success: true,
          data: anomalies,
          pagination: {
            total: total,
            limit: limit,
            offset: offset,
            hasMore: (offset + limit) < total
          },
          summary: summary
        });
      } catch (error) {
        this.logger.error('Erro ao obter anomalias', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ========================================
    // ESTRATÉGIAS
    // ========================================

    // Endpoint: Recomendações (Top 3-5)
    this.app.get('/api/strategies/recommend', async (req, res) => {
      try {
        // Buscar modelo do banco de dados
        const MarketSnapshot = this.db.getModel('MarketSnapshot');
        const AnomaliesLog = this.db.getModel('AnomaliesLog');
        
        // Buscar último snapshot
        const latestSnapshot = await MarketSnapshot.findOne({
          order: [['timestamp', 'DESC']]
        });
        
        if (!latestSnapshot) {
          return res.status(404).json({
            success: false,
            error: 'No market data available'
          });
        }
        
        // Buscar dados de volatilidade
        let volData = [];
        try {
          if (latestSnapshot.vol_surface_data) {
            volData = JSON.parse(latestSnapshot.vol_surface_data);
          }
        } catch (e) {
          this.logger.error('Error parsing vol_surface_data:', e);
        }
        
        // Buscar anomalias recentes (última 1 hora)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const { Op } = require('sequelize');
        const recentAnomalies = await AnomaliesLog.findAll({        
          where: {
            created_at: {
              [Op.gte]: oneHourAgo
            }
          },
          order: [['created_at', 'DESC']],
          limit: 10
        });
        
        // Analisar estado do mercado
        const analyzer = new MarketStateAnalyzer(
          latestSnapshot.toJSON(),
          volData,
          recentAnomalies.map(a => a.toJSON())
        );
        const marketState = analyzer.analyze();
        
        // Recomendar estratégias
        const recommender = new StrategyRecommender(STRATEGIES, marketState);
        const topN = parseInt(req.query.topN) || 5;
        const minScore = parseInt(req.query.minScore) || 50;
        
        const recommendations = recommender.recommend({ topN, minScore });
        
        // Retornar resposta
        res.json({
          success: true,
          data: recommendations,
          marketState: marketState,
          timestamp: new Date(),
          meta: {
            totalStrategies: STRATEGIES.length,
            recommendedCount: recommendations.length,
            spotPrice: latestSnapshot.spot_price,
            regime: latestSnapshot.regime
          }
        });
        
      } catch (error) {
        this.logger.error('Erro ao recomendar estratégias', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    // Endpoint 2: Todas as estratégias com scores
    this.app.get('/api/strategies/all', async (req, res) => {
      try {
        const MarketSnapshot = this.db.getModel('MarketSnapshot');
        const AnomaliesLog = this.db.getModel('AnomaliesLog');
        
        const latestSnapshot = await MarketSnapshot.findOne({
          order: [['created_at', 'DESC']]  // ← TROCAR: timestamp → created_at
        });
        
        if (!latestSnapshot) {
          return res.status(404).json({
            success: false,
            error: 'No market data available'
          });
        }
        
        let volData = [];
        try {
          if (latestSnapshot.vol_surface_data) {
            volData = JSON.parse(latestSnapshot.vol_surface_data);
          }
        } catch (e) {
          this.logger.error('Error parsing vol_surface_data:', e);
        }
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const { Op } = require('sequelize');
        const recentAnomalies = await AnomaliesLog.findAll({
          where: {
            created_at: {  // ← TROCAR: timestamp → created_at
              [Op.gte]: oneHourAgo
            }
          }
        });
        
        const analyzer = new MarketStateAnalyzer(
          latestSnapshot.toJSON(),
          volData,
          recentAnomalies.map(a => a.toJSON())
        );
        const marketState = analyzer.analyze();
        
        const recommender = new StrategyRecommender(STRATEGIES, marketState);
        const allStrategies = recommender.getAllWithScores();
        
        res.json({
          success: true,
          data: allStrategies,
          marketState: marketState,
          timestamp: new Date()
        });
        
      } catch (error) {
        this.logger.error('Erro ao buscar todas as estratégias', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Endpoint: Detalhes de uma estratégia específica
    this.app.get('/api/strategies/:id', async (req, res) => {
      try {
        const strategyId = req.params.id;
        const strategy = STRATEGIES.find(s => s.id === strategyId);
        
        if (!strategy) {
          return res.status(404).json({
            success: false,
            error: `Strategy '${strategyId}' not found`
          });
        }
        
        // Tentar calcular score baseado no estado atual do mercado
        try {
          const MarketSnapshot = this.db.getModel('MarketSnapshot');
          const AnomaliesLog = this.db.getModel('AnomaliesLog');
          
          const latestSnapshot = await MarketSnapshot.findOne({
            order: [['created_at', 'DESC']]
          });
          
          if (latestSnapshot) {
            let volData = [];
            try {
              if (latestSnapshot.vol_surface_data) {
                volData = JSON.parse(latestSnapshot.vol_surface_data);
              }
            } catch (e) {
              this.logger.error('Error parsing vol_surface_data:', e);
            }
            
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);         
            
            const recentAnomalies = await AnomaliesLog.findAll({            
              
              limit: 20,
              order: [['created_at', 'DESC']]
            });
            
            const analyzer = new MarketStateAnalyzer(
              latestSnapshot.toJSON(),
              volData,
              recentAnomalies
            );
            const marketState = analyzer.analyze();
            
            const recommender = new StrategyRecommender([strategy], marketState);
            const scored = recommender.recommend({ topN: 1, minScore: 0 })[0];
            
            return res.json({
              success: true,
              data: scored,
              marketState: marketState,
              timestamp: new Date()
            });
          }
        } catch (e) {
          this.logger.error('Error calculating strategy score:', e);
        }
        
        // Se não conseguir calcular score, retornar estratégia sem score
        res.json({
          success: true,
          data: strategy,
          timestamp: new Date()
        });
        
      } catch (error) {
        this.logger.error('Erro ao buscar estratégia', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Market History endpoint
    this.app.get('/api/market-history', async (req, res) => {
      try {
        const MarketSnapshot = this.db.getModel('MarketSnapshot');
        const { Op } = require('sequelize');

        // Query parameters
        const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
        const hours = parseInt(req.query.hours) || 24; // Last N hours
        const fields = req.query.fields ? req.query.fields.split(',') : null;

        // Calculate time range
        const startTime = Date.now() - (hours * 60 * 60 * 1000);

        // Build attributes list
        const attributes = fields || [
          'id', 'timestamp', 'spot_price', 'total_options',
          'total_gex', 'max_gex_strike', 'regime',
          'max_pain_strike', 'max_pain_oi', 'max_pain_distance', 'max_pain_distance_pct',
          'sentiment', 'put_call_oi_ratio', 'put_call_vol_ratio'
        ];

        // Query snapshots
        const snapshots = await MarketSnapshot.findAll({
          attributes: attributes,
          where: {
            timestamp: { [Op.gte]: startTime }
          },
          order: [['timestamp', 'DESC']],
          limit: limit
        });

        res.json({
          success: true,
          data: snapshots,
          count: snapshots.length,
          timeRange: {
            start: startTime,
            end: Date.now(),
            hours: hours
          }
        });
      } catch (error) {
        this.logger.error('Erro ao obter histórico de mercado', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    /**
 * ============================================================================
 * LIQUIDATION ENDPOINTS - Gamma Tracker
 * ============================================================================
 * 
 * Este módulo contém todos os endpoints relacionados ao rastreamento de
 * liquidações forçadas da Binance Futures.
 * 
 * DEPENDÊNCIAS:
 * - LiquidationTracker integrado no DataCollector
 * - DataCollector deve estar inicializado e conectado
 * 
 * ENDPOINTS DISPONÍVEIS:
 * 1. GET /api/liquidations/stats          - Estatísticas gerais de liquidações
 * 2. GET /api/liquidations/energy         - Energy score (Half Pipe Model)
 * 3. GET /api/liquidations/summary        - Resumo completo
 * 4. GET /api/liquidations/recent         - Liquidações recentes (filtro por tempo)
 * 5. GET /api/liquidations/early          - Early spike detection (H2 - Falso Escape)
 * 6. GET /api/liquidations/growth         - Taxa de crescimento (H1 - Escape Bom)
 * 7. GET /api/liquidations/cascade        - Detecção de cascata
 * 
 * COMO INTEGRAR NO server.js:
 * 1. Adicionar este bloco completo dentro do método setupRoutes()
 * 2. Posicionar após os endpoints existentes
 * 3. Antes do fechamento do método setupRoutes()
 * 
 * EXEMPLO DE LOCALIZAÇÃO:
 * ```javascript
 * setupRoutes() {
 *   // ... endpoints existentes ...
 *   
 *   // ========================================
 *   // LIQUIDATION ENDPOINTS
 *   // ========================================
 *   // [ADICIONAR AQUI]
 *   
 * } // fim de setupRoutes()
 * ```
 * ============================================================================
 */

// ============================================================================
// ENDPOINT 1: LIQUIDATION STATS
// ============================================================================
/**
 * GET /api/liquidations/stats
 * 
 * Retorna estatísticas gerais de liquidações em múltiplos períodos.
 * 
 * QUERY PARAMS: Nenhum
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     totalValue: {
 *       last1h: 2500000,      // $ liquidado última 1h
 *       last4h: 8750000,      // $ liquidado últimas 4h
 *       last24h: 45000000     // $ liquidado últimas 24h
 *     },
 *     imbalance1h: {
 *       longLiquidated: 1800000,   // $ de longs liquidados
 *       shortLiquidated: 700000,   // $ de shorts liquidados
 *       ratio: 0.72,               // Proporção long/(long+short)
 *       direction: "BEARISH"       // BEARISH/BULLISH/NEUTRAL
 *     },
 *     cascade: false,              // Se cascata está ativa
 *     largestLiquidation: {
 *       timestamp: 1704047400000,
 *       side: "SELL",
 *       value: 250000,
 *       size: "MASSIVE"
 *     },
 *     count: {
 *       last1h: 45,
 *       last4h: 180,
 *       last24h: 892
 *     },
 *     lastUpdate: 1704050000000
 *   },
 *   timestamp: "2025-12-31T10:00:00.000Z"
 * }
 * 
 * CASOS DE USO:
 * - Dashboard principal (card de liquidações)
 * - Análise de pressão de mercado
 * - Detecção de sentimento (long vs short)
 */
this.app.get('/api/liquidations/stats', async (req, res) => {
  try {
    // Obter stats do LiquidationTracker via DataCollector
    const stats = this.dataCollector.getLiquidationStats();
    
    // Verificar se LiquidationTracker está disponível
    if (!stats) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter liquidation stats', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 2: LIQUIDATION ENERGY
// ============================================================================
/**
 * GET /api/liquidations/energy
 * 
 * Retorna o "energy score" das liquidações para o Half Pipe Model.
 * Combina valor, frequência, cascata e imbalance em um score normalizado.
 * 
 * QUERY PARAMS: Nenhum
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     score: 0.78,                    // Score normalizado 0-1
 *     level: "HIGH",                  // VERY_LOW/LOW/MEDIUM/HIGH/EXTREME
 *     direction: "BEARISH",           // BULLISH/NEUTRAL/BEARISH
 *     components: {
 *       value: 0.25,                  // Contribuição do valor (40%)
 *       frequency: 0.18,              // Contribuição da frequência (30%)
 *       cascade: 0,                   // Boost de cascata (0 ou +0.5)
 *       imbalance: 0.44               // Contribuição do imbalance (30%)
 *     },
 *     rawData: {
 *       totalValue: { ... },
 *       imbalance1h: { ... },
 *       cascade: false,
 *       count: { ... }
 *     }
 *   },
 *   timestamp: "2025-12-31T10:00:00.000Z"
 * }
 * 
 * INTERPRETAÇÃO DO SCORE:
 * - 0.0 - 0.2: VERY_LOW  - Energia mínima, mercado calmo
 * - 0.2 - 0.4: LOW       - Energia baixa, poucas liquidações
 * - 0.4 - 0.6: MEDIUM    - Energia moderada, movimento normal
 * - 0.6 - 0.8: HIGH      - Energia alta, possível escape iminente
 * - 0.8 - 1.0: EXTREME   - Energia extrema, escape muito provável
 * 
 * CASOS DE USO:
 * - Half Pipe Model (calcular P_escape)
 * - Alertas de escape iminente
 * - Dashboard de energia de mercado
 */
this.app.get('/api/liquidations/energy', async (req, res) => {
  try {
    // Obter energy score do LiquidationTracker
    const energy = this.dataCollector.getLiquidationEnergy();
    
    if (!energy) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    res.json({
      success: true,
      data: energy,
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter liquidation energy', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 3: LIQUIDATION SUMMARY
// ============================================================================
/**
 * GET /api/liquidations/summary
 * 
 * Retorna um resumo completo combinando stats + energy em uma única chamada.
 * Útil para reduzir número de requests.
 * 
 * QUERY PARAMS: Nenhum
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     stats: { ... },      // Mesmo formato de /stats
 *     energy: { ... },     // Mesmo formato de /energy
 *     connected: true,     // Status da conexão WebSocket
 *     lastUpdate: 1704050000000
 *   }
 * }
 * 
 * CASOS DE USO:
 * - Obter todos os dados de liquidação de uma vez
 * - Reduzir latência (1 request em vez de 2)
 * - Dashboard que precisa de visão completa
 */
this.app.get('/api/liquidations/summary', async (req, res) => {
  try {
    const stats = this.dataCollector.getLiquidationStats();
    const energy = this.dataCollector.getLiquidationEnergy();
    
    if (!stats || !energy) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    res.json({
      success: true,
      data: {
        stats: stats,
        energy: energy,
        connected: this.dataCollector.liquidationTracker?.connected || false,
        lastUpdate: Date.now()
      }
    });
  } catch (error) {
    this.logger.error('Erro ao obter liquidation summary', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 4: RECENT LIQUIDATIONS
// ============================================================================
/**
 * GET /api/liquidations/recent
 * 
 * Retorna lista de liquidações recentes em um período específico.
 * 
 * QUERY PARAMS:
 * - minutes (opcional): Número de minutos para buscar (padrão: 5)
 * 
 * EXEMPLO:
 * GET /api/liquidations/recent?minutes=10
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     liquidations: [
 *       {
 *         timestamp: 1704050000000,
 *         side: "SELL",              // BUY = short liquidado, SELL = long liquidado
 *         price: 95000.00,
 *         quantity: 0.500,
 *         value: 47500.00,
 *         size: "LARGE"              // SMALL/MEDIUM/LARGE/MASSIVE
 *       },
 *       // ... mais liquidações ...
 *     ],
 *     count: 15,
 *     totalValue: 750000,
 *     timeRange: {
 *       start: "2025-12-31T09:55:00.000Z",
 *       end: "2025-12-31T10:00:00.000Z",
 *       minutes: 5
 *     }
 *   },
 *   timestamp: "2025-12-31T10:00:00.000Z"
 * }
 * 
 * CASOS DE USO:
 * - Timeline de liquidações
 * - Análise de padrões temporais
 * - Debugging de eventos específicos
 */
this.app.get('/api/liquidations/recent', async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 5;
    const now = Date.now();
    const startTime = now - (minutes * 60 * 1000);
    
    // Acessar diretamente o liquidationTracker para getLiquidations()
    const tracker = this.dataCollector.liquidationTracker;
    
    if (!tracker) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    const liquidations = tracker.getLiquidations(startTime, now);
    
    res.json({
      success: true,
      data: {
        liquidations: liquidations,
        count: liquidations.length,
        totalValue: liquidations.reduce((sum, l) => sum + l.value, 0),
        timeRange: {
          start: new Date(startTime).toISOString(),
          end: new Date(now).toISOString(),
          minutes: minutes
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter liquidações recentes', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 5: EARLY LIQUIDATIONS (H2 - Falso Escape)
// ============================================================================
/**
 * GET /api/liquidations/early
 * 
 * Detecta "early spike" de liquidações - indicador de H2 (Falso Escape).
 * Quando >70% das liquidações ocorrem nos primeiros minutos, geralmente
 * indica stop hunt e o preço tende a voltar ao half-pipe.
 * 
 * QUERY PARAMS:
 * - minutes (opcional): Janela de tempo para "early" (padrão: 2)
 * 
 * EXEMPLO:
 * GET /api/liquidations/early?minutes=2
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     early: {
 *       count: 35,                   // Liquidações nos primeiros X minutos
 *       totalCount: 45,              // Total de liquidações
 *       percentage: 0.78,            // 78% foram early
 *       value: 1950000,              // $ liquidado early
 *       totalValue: 2500000,         // $ total liquidado
 *       minutes: 2                   // Janela de tempo
 *     },
 *     risk: "HIGH",                  // LOW/MEDIUM/HIGH
 *     warning: "Mais de 70% das liquidações nos primeiros minutos - Possível falso escape (stop hunt)"
 *   },
 *   timestamp: "2025-12-31T10:00:00.000Z"
 * }
 * 
 * INTERPRETAÇÃO:
 * - percentage < 0.5: Distribuição normal, sem alerta
 * - percentage 0.5-0.7: MEDIUM risk, monitorar
 * - percentage > 0.7: HIGH risk, provável falso escape (H2)
 * 
 * CASOS DE USO:
 * - Detectar armadilhas de mercado (stop hunt)
 * - Validar hipótese H2 (Falso Escape)
 * - Alertas de "não entrar agora"
 */
this.app.get('/api/liquidations/early', async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 2;
    const tracker = this.dataCollector.liquidationTracker;
    
    if (!tracker) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    const early = tracker.getEarlyLiquidations(minutes);
    
    // Classificar risco
    let risk = 'LOW';
    let warning = null;
    
    if (early.percentage > 0.7) {
      risk = 'HIGH';
      warning = 'Mais de 70% das liquidações nos primeiros minutos - Possível falso escape (stop hunt)';
    } else if (early.percentage > 0.5) {
      risk = 'MEDIUM';
      warning = 'Liquidações concentradas no início - Monitorar para falso escape';
    }
    
    res.json({
      success: true,
      data: {
        early: early,
        risk: risk,
        warning: warning
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter early liquidations', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 6: LIQUIDATION GROWTH (H1 - Escape Bom)
// ============================================================================
/**
 * GET /api/liquidations/growth
 * 
 * Analisa taxa de crescimento das liquidações ao longo do tempo.
 * Crescimento gradual indica H1 (Escape Bom por fluxo real).
 * 
 * QUERY PARAMS: Nenhum
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     growth: {
 *       trend: "INCREASING",         // INCREASING/STABLE/DECREASING
 *       growth: 0.72,                // Taxa de crescimento (0-1)
 *       buckets: [
 *         { period: "0-5min", value: 500000 },
 *         { period: "5-10min", value: 750000 },
 *         { period: "10-15min", value: 1200000 }
 *       ]
 *     },
 *     quality: "GOOD",               // GOOD/NEUTRAL/POOR/UNKNOWN
 *     description: "Liquidações crescendo gradualmente - Possível escape direcional por fluxo real (H1)"
 *   },
 *   timestamp: "2025-12-31T10:00:00.000Z"
 * }
 * 
 * INTERPRETAÇÃO:
 * - INCREASING + growth > 0.5: GOOD - Escape direcional (H1)
 * - STABLE: NEUTRAL - Sem sinal claro
 * - DECREASING: POOR - Energia enfraquecendo
 * 
 * CASOS DE USO:
 * - Validar hipótese H1 (Escape Bom)
 * - Confirmar continuidade de movimento
 * - Alertas de "entrada segura"
 */
this.app.get('/api/liquidations/growth', async (req, res) => {
  try {
    const tracker = this.dataCollector.liquidationTracker;
    
    if (!tracker) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    const growth = tracker.getLiquidationGrowth();
    
    // Classificar qualidade do escape
    let quality = 'UNKNOWN';
    let description = '';
    
    if (growth.trend === 'INCREASING' && growth.growth > 0.5) {
      quality = 'GOOD';
      description = 'Liquidações crescendo gradualmente - Possível escape direcional por fluxo real (H1)';
    } else if (growth.trend === 'STABLE') {
      quality = 'NEUTRAL';
      description = 'Liquidações estáveis - Sem sinal claro de escape';
    } else if (growth.trend === 'DECREASING') {
      quality = 'POOR';
      description = 'Liquidações diminuindo - Energia enfraquecendo';
    }
    
    res.json({
      success: true,
      data: {
        growth: growth,
        quality: quality,
        description: description
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao obter liquidation growth', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 7: CASCADE DETECTION
// ============================================================================
/**
 * GET /api/liquidations/cascade
 * 
 * Detecta se uma cascata de liquidações está em andamento.
 * Cascata = >10 liquidações por minuto (configurável).
 * 
 * QUERY PARAMS: Nenhum
 * 
 * RESPOSTA:
 * {
 *   success: true,
 *   data: {
 *     cascadeDetected: true,         // Se cascata está ativa
 *     liquidationsLastMinute: 15,    // Liquidações no último minuto
 *     threshold: 10,                 // Threshold configurado
 *     recentLiquidations: [
 *       { timestamp: ..., side: "SELL", value: 50000, ... },
 *       // ... últimas 10 liquidações ...
 *     ]
 *   },
 *   timestamp: "2025-12-31T10:00:00.000Z"
 * }
 * 
 * INTERPRETAÇÃO:
 * - cascadeDetected = true: Energia extrema, escape iminente ou em curso
 * - liquidationsLastMinute > threshold: Pressão intensa
 * 
 * CASOS DE USO:
 * - Alertas de emergência
 * - Pausar trading automático
 * - Notificações push
 * - Dashboard de risco
 */
this.app.get('/api/liquidations/cascade', async (req, res) => {
  try {
    const stats = this.dataCollector.getLiquidationStats();
    const tracker = this.dataCollector.liquidationTracker;
    
    if (!stats || !tracker) {
      return res.status(503).json({
        success: false,
        error: 'LiquidationTracker não está disponível'
      });
    }
    
    // Detalhes da cascata
    const now = Date.now();
    const lastMinute = tracker.getLiquidations(now - 60 * 1000, now);
    
    res.json({
      success: true,
      data: {
        cascadeDetected: stats.cascade,
        liquidationsLastMinute: lastMinute.length,
        threshold: tracker.config.cascadeThreshold,
        recentLiquidations: lastMinute.slice(0, 10)  // Últimas 10
      },
      timestamp: new Date()
    });
  } catch (error) {
    this.logger.error('Erro ao detectar cascata', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ============================================================================
 * FIM DOS LIQUIDATION ENDPOINTS
 * ============================================================================
 * 
 * PRÓXIMOS PASSOS:
 * 1. Copiar este bloco completo
 * 2. Colar dentro de setupRoutes() no server.js
 * 3. Reiniciar o servidor
 * 4. Testar endpoints com curl ou Postman
 * 
 * TESTES RÁPIDOS:
 * curl http://localhost:3300/api/liquidations/energy
 * curl http://localhost:3300/api/liquidations/stats
 * curl http://localhost:3300/api/liquidations/recent?minutes=10
 * 
 * DOCUMENTAÇÃO COMPLETA:
 * Ver LIQUIDATION_TRACKER_INTEGRATION.md
 * ============================================================================
 */



    // Regime History endpoint
    this.app.get('/api/regime-history', async (req, res) => {
      try {
        const MarketSnapshot = this.db.getModel('MarketSnapshot');
        const { Op } = require('sequelize');

        // Query parameters
        const hours = parseInt(req.query.hours) || 24;
        const startTime = Date.now() - (hours * 60 * 60 * 1000);

        // Query regime changes
        const snapshots = await MarketSnapshot.findAll({
          attributes: ['timestamp', 'regime', 'spot_price', 'total_gex'],
          where: {
            timestamp: { [Op.gte]: startTime },
            regime: { [Op.ne]: null }
          },
          order: [['timestamp', 'ASC']]
        });

        // Detect regime changes
        const regimeChanges = [];
        let lastRegime = null;

        snapshots.forEach(snapshot => {
          if (snapshot.regime !== lastRegime) {
            regimeChanges.push({
              timestamp: snapshot.timestamp,
              regime: snapshot.regime,
              spotPrice: snapshot.spot_price,
              totalGex: snapshot.total_gex
            });
            lastRegime = snapshot.regime;
          }
        });

        // Calculate regime duration statistics
        const regimeStats = {};
        for (let i = 0; i < regimeChanges.length; i++) {
          const regime = regimeChanges[i].regime;
          const duration = i < regimeChanges.length - 1
            ? regimeChanges[i + 1].timestamp - regimeChanges[i].timestamp
            : Date.now() - regimeChanges[i].timestamp;

          if (!regimeStats[regime]) {
            regimeStats[regime] = {
              count: 0,
              totalDuration: 0,
              avgDuration: 0
            };
          }

          regimeStats[regime].count++;
          regimeStats[regime].totalDuration += duration;
          regimeStats[regime].avgDuration = regimeStats[regime].totalDuration / regimeStats[regime].count;
        }

        res.json({
          success: true,
          data: {
            currentRegime: lastRegime,
            regimeChanges: regimeChanges,
            regimeStats: regimeStats,
            timeRange: {
              start: startTime,
              end: Date.now(),
              hours: hours
            }
          }
        });
      } catch (error) {
        this.logger.error('Erro ao obter histórico de regime', error);
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

    // Add regime analysis
    try {
      const regimeAnalysis = this.regimeAnalyzer.analyzeRegime(metrics);
      // Truncate regime to max 20 characters to fit database column
      const regime = regimeAnalysis.regime || '';
      metrics.regime = regime.substring(0, 20);
      metrics.regimeAnalysis = regimeAnalysis;
    } catch (error) {
      this.logger.error('Erro ao analisar regime', error);
      metrics.regime = null;
    }

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