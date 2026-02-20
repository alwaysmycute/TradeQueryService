/**
 * GraphQL Client Utility for APIM GraphQL API
 *
 * 使用 Azure API Management (APIM) 的 Ocp-Apim-Subscription-Key 進行授權。
 * 所有對 GraphQL API 的請求都透過此模組統一管理。
 */

import { logger } from './logger.js';

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
 * 格式化 GraphQL 錯誤訊息，保留完整錯誤詳情
 * @param {Array<Object>} errors - GraphQL errors array
 * @returns {Object} 格式化的錯誤物件
 */
function formatGraphQLErrors(errors) {
  return {
    message: errors.map(e => e.message).join('; '),
    errors: errors.map((e, index) => ({
      index: index + 1,
      message: e.message,
      path: e.path,
      locations: e.locations,
      extensions: e.extensions,
    })),
  };
}

/**
 * 執行 GraphQL 查詢
 *
 * APIM GraphQL 端點使用 inline arguments 模式，
 * 所有參數已嵌入 query string，不需要 variables。
 *
 * 改進項目：
 * - P3-7: 加入請求日誌記錄
 * - P3-8: 錯誤訊息完整化，保留完整的 GraphQL 錯誤詳情
 *
 * @param {Object} options
 * @param {string} options.endpoint - APIM GraphQL API endpoint URL
 * @param {string} options.subscriptionKey - APIM Subscription Key (Ocp-Apim-Subscription-Key)
 * @param {string} options.query - GraphQL query string (含 inline arguments)
 * @param {Object} [options.variables] - GraphQL variables（可選，APIM 不支援 variable definitions）
 * @returns {Promise<Object>} GraphQL response data
 * @throws {Error} 如果 HTTP 請求失敗或 GraphQL 回傳錯誤
 */
export async function executeGraphQL({ endpoint, subscriptionKey, query, variables }) {
  const requestBody = variables && Object.keys(variables).length > 0
    ? { query, variables }
    : { query };

  // P3-7: 記錄請求日誌
  logger.debug({
    type: 'graphql_request',
    endpoint,
    queryLength: query.length,
    hasVariables: !!variables,
    variableCount: variables ? Object.keys(variables).length : 0,
  }, 'Executing GraphQL request');

  const startTime = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(subscriptionKey),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const duration = Date.now() - startTime;

      // P3-7: 記錄 HTTP 錯誤
      logger.error({
        type: 'graphql_http_error',
        status: response.status,
        statusText: response.statusText,
        duration,
        endpoint,
      }, `GraphQL HTTP Error ${response.status}`);

      // P3-8: 完整的 HTTP 錯誤訊息
      const error = new Error(`GraphQL HTTP Error ${response.status}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.details = errorText;
      error.duration = duration;
      throw error;
    }

    const result = await response.json();
    const duration = Date.now() - startTime;

    // P3-7: 記錄成功回應
    logger.debug({
      type: 'graphql_response',
      duration,
      hasData: !!result.data,
      hasErrors: !!(result.errors && result.errors.length > 0),
      errorCount: result.errors ? result.errors.length : 0,
    }, 'GraphQL request completed');

    if (result.errors && result.errors.length > 0) {
      // P3-7: 記錄 GraphQL 錯誤
      logger.error({
        type: 'graphql_error',
        duration,
        errorCount: result.errors.length,
        errors: result.errors,
      }, 'GraphQL returned errors');

      // P3-8: 完整的 GraphQL 錯誤訊息
      const formattedErrors = formatGraphQLErrors(result.errors);
      const error = new Error(`GraphQL Error: ${formattedErrors.message}`);
      error.graphqlErrors = formattedErrors.errors;
      error.duration = duration;
      throw error;
    }

    return result;
  } catch (err) {
    const duration = Date.now() - startTime;

    // 如果不是我們自己建立的錯誤，包裝它
    if (!err.status && !err.graphqlErrors) {
      logger.error({
        type: 'graphql_request_error',
        duration,
        error: err.message,
      }, 'GraphQL request failed unexpectedly');
    }

    throw err;
  }
}
