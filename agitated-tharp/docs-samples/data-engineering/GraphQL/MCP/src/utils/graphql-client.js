/**
 * GraphQL Client Utility for APIM GraphQL API
 *
 * 使用 Azure API Management (APIM) 的 Ocp-Apim-Subscription-Key 進行授權。
 * 所有對 GraphQL API 的請求都透過此模組統一管理。
 */

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(subscriptionKey),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GraphQL HTTP Error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    const messages = result.errors.map(e => e.message).join('; ');
    throw new Error(`GraphQL Error: ${messages}`);
  }

  return result;
}
