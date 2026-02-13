/**
 * Tool Registry - 自動載入所有工具模組
 *
 * 擴充方式：
 * 1. 在 src/tools/ 目錄下新增工具檔案（遵循相同的 export 格式）
 * 2. 在此檔案的 toolModules 陣列中加入 import
 * 3. 工具會自動註冊到 MCP Server
 *
 * 每個工具模組必須 export：
 * - name: string - 工具名稱（MCP tool name）
 * - description: string - 工具說明（LLM 使用的說明文字）
 * - parameters: ZodSchema - 參數定義（Zod schema）
 * - handler: async function - 工具執行函數
 */

import * as introspectSchema from './introspect-schema.js';
import * as queryGraphql from './query-graphql.js';
import * as queryHscodeReference from './query-hscode-reference.js';
import * as queryCountryAreaReference from './query-country-area-reference.js';
import * as queryTradeMonthlyByCode from './query-trade-monthly-by-code.js';
import * as queryTradeMonthlyByGroup from './query-trade-monthly-by-group.js';
import * as queryTradeTransactions from './query-trade-transactions.js';


/**
 * 所有工具模組列表
 *
 * 新增 resolver 工具時，只需：
 * 1. 建立新的工具檔案（可參考現有工具的格式）
 * 2. 在 utils/query-builder.js 的 RESOLVER_REGISTRY 中新增 resolver 設定
 * 3. 在此處 import 並加入 toolModules 陣列
 */
const toolModules = [
  introspectSchema,
  queryGraphql,
  queryHscodeReference,
  queryCountryAreaReference,
  queryTradeMonthlyByCode,
  queryTradeMonthlyByGroup,
  queryTradeTransactions,
];

/**
 * 將所有工具註冊到 MCP Server
 *
 * @param {McpServer} server - MCP Server 實例
 */
export function registerAllTools(server) {
  for (const tool of toolModules) {
    if (!tool.name || !tool.description || !tool.parameters || !tool.handler) {
      console.warn(`Skipping invalid tool module: missing required exports`);
      continue;
    }

    // MCP SDK expects a ZodRawShape (plain object of Zod types), not a ZodObject.
    // If tool.parameters is a z.object(), extract .shape; otherwise use as-is.
    const schema = tool.parameters.shape ?? tool.parameters;

    // register main name
    server.tool(
      tool.name,
      tool.description,
      schema,
      tool.handler
    );
    console.log(`Registered tool: ${tool.name}`);

    // also register a camelCase alias if the tool name uses snake_case
    const camelAlias = tool.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (camelAlias !== tool.name) {
      try {
        server.tool(
          camelAlias,
          `${tool.description} (alias for ${tool.name})`,
          schema,
          tool.handler
        );
        console.log(`Registered tool alias: ${camelAlias} -> ${tool.name}`);
      } catch (e) {
        console.warn(`Failed to register alias ${camelAlias}: ${e.message}`);
      }
    }
  }

  console.log(`Total tools registered: ${toolModules.length}`);
}

/**
 * 取得所有已註冊工具的名稱列表
 * @returns {string[]}
 */
export function getToolNames() {
  return toolModules.map(t => t.name);
}
