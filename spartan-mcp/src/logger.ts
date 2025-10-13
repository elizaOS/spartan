/**
 * Logger for MCP Gateway
 */

import { LoggingConfig, Logger } from './types.js';

class MCPLogger implements Logger {
  private config: LoggingConfig;
  private startTime: number = Date.now();

  constructor(config: LoggingConfig) {
    this.config = config;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      this.log('DEBUG', message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      this.log('INFO', message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      this.log('WARN', message, meta);
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      this.log('ERROR', message, error);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = this.config.level || 'info';
    const currentLevelIndex = levels.indexOf(level);
    const configLevelIndex = levels.indexOf(configLevel);
    return currentLevelIndex >= configLevelIndex;
  }

  private log(level: string, message: string, meta?: any): void {
    if (this.config.format === 'json') {
      this.logJson(level, message, meta);
    } else {
      this.logText(level, message, meta);
    }
  }

  private logJson(level: string, message: string, meta?: any): void {
    const logEntry: any = {
      level,
      message
    };

    if (this.config.include_timestamps) {
      logEntry.timestamp = new Date().toISOString();
    }

    if (this.config.include_context && meta) {
      logEntry.context = meta;
    }

    if (this.config.include_performance_metrics) {
      logEntry.uptime = Date.now() - this.startTime;
    }

    // Use stderr for all logs (MCP convention)
    console.error(JSON.stringify(logEntry));
  }

  private logText(level: string, message: string, meta?: any): void {
    let logLine = '';

    if (this.config.include_timestamps) {
      logLine += `[${new Date().toISOString()}] `;
    }

    logLine += `[${level}] ${message}`;

    if (this.config.include_context && meta) {
      logLine += ` ${JSON.stringify(meta)}`;
    }

    // Use stderr for all logs (MCP convention)
    console.error(logLine);
  }
}

export function createLogger(config: LoggingConfig): Logger {
  return new MCPLogger(config);
}

