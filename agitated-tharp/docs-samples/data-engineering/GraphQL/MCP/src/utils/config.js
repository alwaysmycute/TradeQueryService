/**
 * MCP Server Configuration
 *
 * 集中管理所有環境變數與預設設定。
 * 支援 local development (.env) 與 Azure Function App (Application Settings) 兩種模式。
 */

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // APIM GraphQL API Endpoint
  // 此 URL 指向 Azure API Management 上的 GraphQL API
  graphqlEndpoint: process.env.APIM_GRAPHQL_ENDPOINT || '',

  // APIM Subscription Key (Ocp-Apim-Subscription-Key)
  // 透過 APIM Product 層級的訂閱金鑰進行授權
  subscriptionKey: process.env.APIM_SUBSCRIPTION_KEY || '',

  // Server 設定
  port: parseInt(process.env.PORT || '3000', 10),

  // Schema 快取 TTL (毫秒), 預設 24 小時
  schemaCacheTtlMs: parseInt(process.env.SCHEMA_CACHE_TTL_MS || String(24 * 60 * 60 * 1000), 10),

  // 預設分頁筆數
  defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '100', 10),

  // 最大分頁筆數（APIM/Fabric 回應大小有限制，all fields × 2000+ items 會 500）
  maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '1000', 10),
};

/**
 * 驗證必要的設定是否已填寫
 * @throws {Error} 如果缺少必要設定
 */
export function validateConfig() {
  const missing = [];
  if (!config.graphqlEndpoint) missing.push('APIM_GRAPHQL_ENDPOINT');
  if (!config.subscriptionKey) missing.push('APIM_SUBSCRIPTION_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Please set them in .env file or Azure Function App Application Settings.`
    );
  }
}
