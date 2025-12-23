/**
 * Logger utilitário para o projeto
 */

class Logger {
  constructor(module) {
    this.module = module;
  }

  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.module}] ${message}`;
  }

  info(message) {
    console.log(this._formatMessage('INFO', message));
  }

  error(message, error = null) {
    console.error(this._formatMessage('ERROR', message));
    if (error) {
      console.error(error);
    }
  }

  warn(message) {
    console.warn(this._formatMessage('WARN', message));
  }

  debug(message) {
    if (process.env.DEBUG === 'true') {
      console.log(this._formatMessage('DEBUG', message));
    }
  }

  success(message) {
    console.log(this._formatMessage('✓', message));
  }
}

module.exports = Logger;