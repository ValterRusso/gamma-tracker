/**
 * Modelo de dados para uma Option
 */

class Option {
  constructor(data) {
    // Informações básicas
    this.symbol = data.symbol;
    this.underlying = this.parseUnderlying(data.symbol);
    this.strike = parseFloat(data.strikePrice || this.parseStrike(data.symbol));
    this.expiryDate = data.expiryDate || this.parseExpiry(data.symbol);
    this.side = data.side || this.parseSide(data.symbol); // 'CALL' ou 'PUT'
    this.contractSize = parseFloat(data.unit || data.contractSize || 1);
    
    // Mark price e volatilidade
    this.markPrice = parseFloat(data.markPrice || 0);
    this.bidIV = parseFloat(data.bidIV || 0);
    this.askIV = parseFloat(data.askIV || 0);
    this.markIV = parseFloat(data.markIV || 0);
    
    // Gregas
    this.delta = parseFloat(data.delta || 0);
    this.gamma = parseFloat(data.gamma || 0);
    this.theta = parseFloat(data.theta || 0);
    this.vega = parseFloat(data.vega || 0);
    
    // Open Interest (será atualizado separadamente)
    this.openInterest = parseFloat(data.openInterest || 0);
    
    // Timestamp da última atualização
    this.lastUpdate = Date.now();
  }

  /**
   * Parse do símbolo para extrair informações
   * Formato: BTC-251226-115000-C
   */
  parseUnderlying(symbol) {
    return symbol.split('-')[0];
  }

  parseStrike(symbol) {
    const parts = symbol.split('-');
    return parts.length >= 3 ? parseFloat(parts[2]) : 0;
  }

  parseExpiry(symbol) {
    const parts = symbol.split('-');
    if (parts.length >= 2) {
      const dateStr = parts[1]; // formato: YYMMDD
      const year = 2000 + parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4)) - 1;
      const day = parseInt(dateStr.substring(4, 6));
      return new Date(year, month, day, 8, 0, 0); // 08:00 UTC
    }
    return null;
  }

  parseSide(symbol) {
    const parts = symbol.split('-');
    return parts.length >= 4 ? (parts[3] === 'C' ? 'CALL' : 'PUT') : 'UNKNOWN';
  }

  /**
   * Atualiza as gregas da option
   */
  updateGreeks(greeksData) {
    this.delta = parseFloat(greeksData.delta || this.delta);
    this.gamma = parseFloat(greeksData.gamma || this.gamma);
    this.theta = parseFloat(greeksData.theta || this.theta);
    this.vega = parseFloat(greeksData.vega || this.vega);
    this.markIV = parseFloat(greeksData.markIV || this.markIV);
    this.lastUpdate = Date.now();
  }

  /**
   * Atualiza o mark price
   */
  updateMarkPrice(price) {
    this.markPrice = parseFloat(price);
    this.lastUpdate = Date.now();
  }

  /**
   * Atualiza o open interest
   */
  updateOpenInterest(oi) {
    this.openInterest = parseFloat(oi);
    this.lastUpdate = Date.now();
  }

  /**
   * Verifica se a option está expirada
   */
  isExpired() {
    return this.expiryDate && this.expiryDate < new Date();
  }

  /**
   * Verifica se os dados estão atualizados (menos de 10 segundos)
   */
  isStale(maxAgeMs = 10000) {
    return (Date.now() - this.lastUpdate) > maxAgeMs;
  }

  /**
   * Retorna representação JSON
   */
  toJSON() {
    return {
      symbol: this.symbol,
      underlying: this.underlying,
      strike: this.strike,
      expiryDate: this.expiryDate,
      side: this.side,
      contractSize: this.contractSize,
      markPrice: this.markPrice,
      markIV: this.markIV,
      delta: this.delta,
      gamma: this.gamma,
      theta: this.theta,
      vega: this.vega,
      openInterest: this.openInterest,
      lastUpdate: this.lastUpdate
    };
  }
}

module.exports = Option;