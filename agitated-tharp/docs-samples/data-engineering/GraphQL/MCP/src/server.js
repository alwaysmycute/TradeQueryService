/**
 * Taiwan Trade Analytics MCP Server
 *
 * 基於 Model Context Protocol (MCP) 的台灣經貿數據查詢服務。
 * 透過 APIM GraphQL API 提供結構化的貿易數據查詢能力給 LLM 使用。
 *
 * 主要功能：
 * - Schema Introspection（含快取機制）
 * - 通用 GraphQL 查詢
 * - 5 個專用 Resolver Tools：
 *   1. query_hscode_reference - HS Code 參考資料
 *   2. query_country_area_reference - 國家/地區參考資料
 *   3. query_trade_monthly_by_code - 按 HS Code 月度貿易統計
 *   4. query_trade_monthly_by_group - 按產業群組月度貿易統計
 *   5. query_trade_transactions - 完整交易明細（大資料量，慎用）
 *
 * 認證方式：APIM Subscription Key (Ocp-Apim-Subscription-Key)
 * 傳輸方式：Streamable HTTP (MCP 標準傳輸協議)
 *
 * 部署模式：
 * - 本地開發：node src/server.js
 * - Azure Function App：透過 azure-function/ 目錄的包裝器
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';

/**
 * 建立並設定 MCP Server 實例
 *
 * @returns {McpServer} 已註冊所有工具的 MCP Server
 */
export function createMcpServer() {
  const server = new McpServer({
    name: 'taiwan-trade-analytics-mcp',
    version: '2.0.0',
    description:
      '台灣經貿數據分析 MCP 服務 - 提供台灣進出口貿易數據查詢，' +
      '包含 HS Code 參考資料、國家/地區對照、按商品或產業的月度統計、' +
      '以及完整交易明細。資料來源為財政部關務署進出口貿易統計。',
  }, {
    capabilities: {},
  });

  console.log('🧭 MCP Server name:', server.name); // ← 就是這一行

  // 註冊所有工具
  registerAllTools(server);

  return server;
}
