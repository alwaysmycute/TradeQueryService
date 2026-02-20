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
import * as queryTradeYearlyTotals from './query-trade-yearly-totals.js';
import * as queryTradeMonthlyTotals from './query-trade-monthly-totals.js';
import * as queryTradeMonthlyByCountries from './query-trade-monthly-by-countries.js';
import * as queryTradeYearlyByCountries from './query-trade-yearly-by-countries.js';
import * as queryTradeMonthlyGrowth from './query-trade-monthly-growth.js';
import * as queryTradeYearlyGrowth from './query-trade-yearly-growth.js';
import * as queryTradeMonthlyGrowthByCountries from './query-trade-monthly-growth-by-countries.js';
import * as queryTradeMonthlyShareByCountries from './query-trade-monthly-share-by-countries.js';
import * as queryTradeYearlyShareByCountries from './query-trade-yearly-share-by-countries.js';

/**
 * 提取 Zod Schema 的原始形狀（ZodRawShape）
 *
 * MCP SDK expects a ZodRawShape (plain object of Zod types), not a ZodObject.
 * 如果 tool.parameters 是一個 z.object()，則提取 .shape；否則直接使用。
 *
 * 此函數會驗證 schema 格式，並在發現問題時拋出錯誤。
 *
 * @param {any} schema - 工具的 parameters 定義
 * @returns {object} ZodRawShape
 * @throws {Error} 如果 schema 格式無效
 */
function extractZodSchema(schema) {
  // 情況 1：schema 是 ZodObject，提取 .shape
  if (schema && typeof schema === 'object' && schema.shape && typeof schema.shape === 'object') {
    return schema.shape;
  }

  // 情況 2：schema 本身就是 ZodRawShape（plain object of Zod types）
  if (schema && typeof schema === 'object' && !schema._def) {
    return schema;
  }

  // 情況 3：無效的 schema
  throw new Error(
    `Invalid parameters schema: expected ZodObject or ZodRawShape (plain object), got ${typeof schema}. ` +
    `Tool parameters should be defined as: \n` +
    `export const parameters = z.object({ ... })`
  );
}

/**
 * 驗證工具模組是否符合 MCP 要求
 *
 * @param {any} tool - 工具模組
 * @returns {boolean} 是否有效
 */
function validateToolModule(tool) {
  const requiredExports = ['name', 'description', 'parameters', 'handler'];
  
  for (const exportName of requiredExports) {
    if (!tool[exportName]) {
      console.error(`Tool module missing required export: ${exportName}`);
      return false;
    }
  }

  // 驗證 handler 是一個異步函數
  if (typeof tool.handler !== 'function') {
    console.error(`Tool handler must be an async function, got: ${typeof tool.handler}`);
    return false;
  }

  // 驗證 schema 格式
  try {
    extractZodSchema(tool.parameters);
  } catch (err) {
    console.error(`Tool parameters schema validation failed for tool "${tool.name}":`, err.message);
    return false;
  }

  return true;
}

/**
 * 所有工具模組列表
 *
 * 新增 resolver 工具時，只需：
 * 1. 建立新的工具檔案（可參考現有工具的格式）
 * 2. 在 utils/query-builder.js 的 RESOLVER_REGISTRY 中新增 resolver 定義
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
  queryTradeYearlyTotals,
  queryTradeMonthlyTotals,
  queryTradeMonthlyByCountries,
  queryTradeYearlyByCountries,
  queryTradeMonthlyGrowth,
  queryTradeYearlyGrowth,
  queryTradeMonthlyGrowthByCountries,
  queryTradeMonthlyShareByCountries,
  queryTradeYearlyShareByCountries,
];

/**
 * 將所有工具註冊到 MCP Server
 *
 * @param {McpServer} server - MCP Server 實例
 */
export function registerAllTools(server) {
  let registeredCount = 0;
  let skippedCount = 0;

  for (const tool of toolModules) {
    if (!validateToolModule(tool)) {
      console.warn(`Skipping invalid tool module: ${tool.name || 'unknown'}`);
      skippedCount++;
      continue;
    }

    try {
      // 提取 Zod Schema 的原始形狀
      const schema = extractZodSchema(tool.parameters);

      // 註冊工具到 MCP Server
      server.tool(
        tool.name,
        tool.description,
        schema,
        tool.handler
      );

      console.log(`✅ Registered tool: ${tool.name}`);
      registeredCount++;
    } catch (err) {
      console.error(`❌ Failed to register tool "${tool.name}":`, err.message);
      skippedCount++;
    }
  }

  console.log(`\n═════════════════════════════════════════════════`);
  console.log(`Tool Registration Summary:`);
  console.log(`  ✅ Registered: ${registeredCount} tools`);
  console.log(`  ❌ Skipped:   ${skippedCount} tools`);
  console.log(`  📊 Total:     ${toolModules.length} tools`);
  console.log(`═════════════════════════════════════════════════\n`);
}

/**
 * 取得所有已註冊工具的名稱列表
 * @returns {string[]}
 */
export function getToolNames() {
  return toolModules.map(t => t.name);
}
