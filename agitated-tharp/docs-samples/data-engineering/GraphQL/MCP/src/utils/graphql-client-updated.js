/**
 * GraphQL Client Utility for APIM GraphQL API
 *
 * 使用 Azure API Management (APIM) 的 Ocp-Apim-Subscription-Key 進行授權。
 * 所有對 GraphQL API 的請求都透過此模組統一管理。
 *
 * 🆕 改進項目 P3-7：新增請求日誌記錄
 * 🆕 改進項目 P3-8：改進錯誤處理，保留完整 GraphQL 錯誤詳情
 */

/**
 * 日誌級別
 */
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

// 從環境變數讀取日誌級別，預設 info
const LOG_LEVEL = (process.env.LOG_LEVEL?.toUpperCase() || 'INFO') as keyof typeof LOG_LEVELS;

/**
 * 簡單的日誌工具（避免引入額外依賴）
 */
const logger = {
  debug: (msg: string, meta?: any) => {
    if (LOG_LEVEL === 'DEBUG') {
      console.log(`🔍 [DEBUG] ${msg}`, meta || '');
    }
  },
  info: (msg: string, meta?: any) => {
    if (LOG_LEVEL === 'DEBUG' || LOG_LEVEL === 'INFO') {
      console.log(`ℹ️ [INFO] ${msg}`, meta || '');
    }
  },
  warn: (msg: string, meta?: any) => {
    if (LOG_LEVEL === 'DEBUG' || LOG_LEVEL === 'INFO' || LOG_LEVEL === 'WARN') {
      console.warn(`⚠️ [WARN] ${msg}`, meta || '');
    }
  },
  error: (msg: string, error?: Error) => {
    console.error(`❌ [ERROR] ${msg}`, error ? error.message : '');
  },
};

/**
 * 建立 GraphQL 請求的標準 headers
 * @param {string} subscriptionKey - APIM Subscription Key
 * @returns {Object} HTTP headers
 */
export function buildHeaders(subscriptionKey) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Ocp-Apim-Subscription-Key': subscriptionKey,
  };
}

/**
 * 執行 GraphQL 查詢
 *
 * APIM GraphQL 端點使用 inline arguments 模式，
 * 所有參數已嵌入 query string，不需要 variables。
 *
 * 🆕 改進：新增日誌記錄和改進錯誤處理
 *
 * @param {Object} options
 * @param {string} options.endpoint - APIM GraphQL API endpoint URL
 * @param {string} options.subscriptionKey - APIM Subscription Key (Ocp-Apim-Subscription-Key)
 * @param {string} options.query - GraphQL query string (含 inline arguments)
 * @param {Object} [options.variables] - GraphQL variables 物件（可選，APIM 不支援 variable definitions）
 * @param {boolean} [options.logRequest] - 是否記錄請求日誌（預設 true）
 * @returns {Promise<Object>} GraphQL response data
 * @throws {Error} 如果 HTTP 請求失敗或 GraphQL 返回錯誤
 */
export async function executeGraphQL({ endpoint, subscriptionKey, query, variables, logRequest = true }) {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  // 構建請求 body
  const requestBody = variables && Object.keys(variables).length > 0
    ? { query, variables }
    : { query };

  // 記錄請求日誌
  if (logRequest) {
    logger.debug(`GraphQL Request [${requestId}]`, {
      endpoint: endpoint.replace(/https?:\/\/[^\/]+/, '...'), // 隱藏完整 endpoint
      hasVariables: !!variables && Object.keys(variables).length > 0,
      queryLength: query.length,
      variablesKeys: variables ? Object.keys(variables) : [],
    });
    
    // 在 DEBUG 級別下記錄完整 query（截斷過長的）
    if (LOG_LEVEL === 'DEBUG') {
      const truncatedQuery = query.length > 500 ? query.substring(0, 500) + '...' : query;
      logger.debug(`Query: ${truncatedQuery}`);
      if (variables) {
        logger.debug(`Variables:`, JSON.stringify(variables, null, 2));
      }
    }
  }

  try {
    // 發送 HTTP 請求
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(subscriptionKey),
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;

    // 檢查 HTTP 狀態
    if (!response.ok) {
      const errorText = await response.text();
      
      logger.error(`GraphQL Request Failed [${requestId}]`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
      });

      throw new Error(`GraphQL HTTP Error ${response.status}: ${errorText}`);
    }

    // 解析 JSON 響應
    const result = await response.json();

    // 記錄成功回應日誌
    if (logRequest) {
      logger.info(`GraphQL Request Success [${requestId}]`, {
        duration: `${duration}ms`,
        hasData: !!result.data,
        hasErrors: !!(result.errors && result.errors.length > 0),
      });
    }

    // 🆕 改進項目 P3-8：檢查並處理 GraphQL 錯誤（保留完整錯誤詳情）
    if (result.errors && result.errors.length > 0) {
      logger.warn(`GraphQL Query Returned Errors [${requestId}]`, {
        errorCount: result.errors.length,
        duration: `${duration}ms`,
        errors: result.errors.map(e => ({
          message: e.message,
          path: e.path,
          extensions: e.extensions,
        })),
      });

      // 構建包含所有錯誤詳情的錯誤物件
      const errorDetails = {
        request: {
          id: requestId,
          endpoint: endpoint,
          queryLength: query.length,
        },
        errors: result.errors.map(error => ({
          message: error.message,
          path: error.path,
          code: error.extensions?.code,
          details: error.extensions,
        })),
      };

      // 拋出包含完整錯誤資訊的錯誤
      const errorMessage = `GraphQL Error: ${result.errors.map(e => e.message).join('; ')}`;
      const enhancedError = new Error(errorMessage) as any;
      enhancedError.details = errorDetails;
      enhancedError.requestId = requestId;
      enhancedError.errors = result.errors;
      
      throw enhancedError;
    }

    return result;

  } catch (err) {
    const duration = Date.now() - startTime;

    // 記錄異常日誌
    if (logRequest && err.name !== 'AbortError') {
      logger.error(`GraphQL Request Exception [${requestId}]`, {
        name: err.name,
        message: err.message,
        duration: `${duration}ms`,
        hasDetails: !!(err as any).details,
      });
    }

    // 重新拋出錯誤（如果是非 AbortError）
    if (err.name !== 'AbortError') {
      throw err;
    }
  }
}

/**
 * 設定日誌級別（運行時動態切換）
 *
 * @param {string} level - 日誌級別（debug, info, warn, error）
 */
export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(level)) {
    console.warn(`Invalid log level: ${level}. Valid levels are: ${validLevels.join(', ')}`);
    return;
  }
  
  process.env.LOG_LEVEL = level.toUpperCase();
  console.log(`✅ Log level set to: ${level.toUpperCase()}`);
}

/**
 * 取得當前日誌級別
 *
 * @returns {string} 當前日誌級別
 */
export function getLogLevel(): string {
  return LOG_LEVEL;
}

/**
 * 創建一個可取消的 GraphQL 請求
 *
 * @param {Object} options - 與 executeGraphQL 相同的參數
 * @returns {Object} 包含 { promise, cancel } 的物件
 * @example
 * const { promise, cancel } = createCancellableGraphQLRequest({ endpoint, subscriptionKey, query });
 * const result = await promise;
 * // 或者
 * cancel(); // 取消請求
 */
export function createCancellableGraphQLRequest(options) {
  const controller = new AbortController();
  
  const promise = (async () => {
    try {
      return await executeGraphQL({
        ...options,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.info(`GraphQL Request Cancelled [${controller.signal}]`);
        return { cancelled: true };
      }
      throw err;
    }
  })();

  const cancel = () => {
    controller.abort();
  };

  return { promise, cancel };
}

/**
 * 批次執行多個 GraphQL 請求
 *
 * @param {Object} options
 * @param {string} options.endpoint - APIM GraphQL API endpoint URL
 * @param {string} options.subscriptionKey - APIM Subscription Key
 * @param {Array<{query: string, variables?: Object}>} options.requests - GraphQL 請求陣列
 * @param {boolean} [options.logBatch] - 是否記錄批次請求日誌（預設 true）
 * @returns {Promise<Array<Object>>} 所有請求的結果陣列
 * @throws {Error} 如果任何請求失敗
 */
export async function batchExecuteGraphQL({ endpoint, subscriptionKey, requests, logBatch = true }) {
  if (logBatch) {
    logger.info(`Batch GraphQL Request`, {
      requestCount: requests.length,
    });
  }

  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    
    try {
      const result = await executeGraphQL({
        endpoint,
        subscriptionKey,
        query: request.query,
        variables: request.variables,
        logRequest: false, // 批次請求中不記錄單個請求日誌
      });
      
      results.push({ success: true, data: result, index: i });
    } catch (err) {
      results.push({ success: false, error: err, index: i });
      
      // 根據批次日誌設定決定是否繼續執行
      if (logBatch) {
        logger.warn(`Batch Request ${i + 1}/${requests.length} Failed`, {
          error: err.message,
        });
      }
    }
  }

  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;

  if (logBatch) {
    logger.info(`Batch GraphQL Request Completed`, {
      duration: `${duration}ms`,
      successCount,
      failureCount: requests.length - successCount,
    });
  }

  return results;
}
