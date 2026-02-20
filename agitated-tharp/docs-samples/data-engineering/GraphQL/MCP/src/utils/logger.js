/**
 * Logger Utility
 *
 * 使用 Pino 作為日誌庫，提供結構化日誌輸出。
 * 根據環境變數 LOG_LEVEL 設定日誌級別。
 */

import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
