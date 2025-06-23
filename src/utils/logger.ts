/**
 * 千机阁MCP服务器日志工具
 */

import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Logger } from '@/types';

/**
 * 创建日志器实例
 */
export function createLoggerInstance(
  level: string = 'info',
  logFile?: string,
  enableConsole: boolean = true
): Logger {
  // 确保日志目录存在
  if (logFile) {
    const logDir = join(process.cwd(), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  // 日志格式配置
  const logFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json(),
    format.prettyPrint()
  );

  // 控制台格式
  const consoleFormat = format.combine(
    format.colorize(),
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(({ timestamp, level, message, meta, stack }) => {
      let log = `${timestamp} [${level}] ${message}`;
      if (meta && Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      if (stack) {
        log += `\n${stack}`;
      }
      return log;
    })
  );

  // 传输配置
  const logTransports: any[] = [];

  // 控制台输出
  if (enableConsole) {
    logTransports.push(
      new transports.Console({
        level,
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
      })
    );
  }

  // 文件输出
  if (logFile) {
    logTransports.push(
      new transports.File({
        filename: logFile,
        level,
        format: logFormat,
        handleExceptions: true,
        handleRejections: true,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      })
    );

    // 错误日志单独文件
    logTransports.push(
      new transports.File({
        filename: logFile.replace('.log', '.error.log'),
        level: 'error',
        format: logFormat,
        handleExceptions: true,
        handleRejections: true,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      })
    );
  }

  const winstonLogger = createLogger({
    level,
    format: logFormat,
    transports: logTransports,
    exitOnError: false
  });

  // 包装Winston Logger以符合我们的接口
  return {
    debug: (message: string, meta?: any) => {
      winstonLogger.debug(message, { meta });
    },
    
    info: (message: string, meta?: any) => {
      winstonLogger.info(message, { meta });
    },
    
    warn: (message: string, meta?: any) => {
      winstonLogger.warn(message, { meta });
    },
    
    error: (message: string, error?: Error, meta?: any) => {
      const logMeta = { ...meta };
      if (error) {
        logMeta.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      }
      winstonLogger.error(message, logMeta);
    }
  };
}

/**
 * 默认日志器实例
 */
export const logger = createLoggerInstance(
  process.env.LOG_LEVEL || 'info',
  process.env.LOG_FILE,
  process.env.NODE_ENV !== 'test'
);

/**
 * 请求日志中间件
 */
export function logRequest(requestId: string, method: string, details?: any) {
  logger.info(`Request ${requestId}: ${method}`, {
    requestId,
    method,
    ...details
  });
}

/**
 * 响应日志中间件
 */
export function logResponse(
  requestId: string, 
  method: string, 
  duration: number, 
  success: boolean,
  details?: any
) {
  const level = success ? 'info' : 'error';
  const message = `Response ${requestId}: ${method} (${duration}ms) - ${success ? 'SUCCESS' : 'FAILED'}`;
  
  logger[level](message, {
    requestId,
    method,
    duration,
    success,
    ...details
  });
}

/**
 * 错误日志助手
 */
export function logError(
  context: string,
  error: Error,
  additionalInfo?: any
) {
  logger.error(`Error in ${context}`, error, {
    context,
    ...additionalInfo
  });
}

/**
 * 性能日志助手
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: any
) {
  logger.info(`Performance: ${operation} took ${duration}ms`, {
    operation,
    duration,
    ...metadata
  });
}

/**
 * 调试日志助手
 */
export function logDebug(
  component: string,
  action: string,
  data?: any
) {
  logger.debug(`[${component}] ${action}`, {
    component,
    action,
    data
  });
} 