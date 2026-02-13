/**
 * Tool: query_trade_monthly_by_code
 *
 * 查詢按 HS Code 與國家分組的月度貿易統計資料 (trade_monthly_by_code_country)。
 *
 * 這是最常用的貿易數據查詢工具之一，提供細到單一 HS Code 層級的月度統計資料。
 * 資料已預先按月彙總，查詢效率比原始交易明細 (TXN_MOF_NON_PROTECT_MT) 高很多。
 *
 * 適用場景：
 * - 查詢特定商品（HS Code）的進出口趨勢
 * - 分析特定商品在各國的貿易分布
 * - 比較不同時期的貿易金額變化
 * - 按國家或 HS Code 統計月度貿易總額
 *
 * 資料粒度：月 × HS Code × 國家 × 貿易流向（進口/出口）
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_monthly_by_code';

export const description =
  `查詢按 HS Code（貨品代碼）與國家分組的月度貿易統計資料。

用途：此工具提供台灣每月按個別 HS Code 與交易國家彙總的進出口貿易數據。
是分析特定商品貿易趨勢最常用的工具。資料已預先彙總，查詢效率高。

可用欄位：
- PERIOD_MONTH: 統計月份（DateTime 格式，如 2024-01-01T00:00:00）
- YEAR: 年份（整數，如 2024）
- MONTH: 月份（整數，1-12）
- TRADE_FLOW: 貿易流向（"1"=出口 Export, "2"=進口 Import）
- HS_CODE: HS Code 貨品代碼（如 "847130"、"8542310010"）
- HS_CODE_ZH: HS Code 中文品名
- COUNTRY_ID: 國家代碼（ISO3 格式，如 "USA"、"JPN"）
- COUNTRY_COMM_ZH: 國家中文名稱（如「美國」「日本」）
- TRADE_VALUE_USD_AMT: 貿易金額_美元（Decimal）
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣（Decimal）
- TRADE_WEIGHT: 貿易重量_公斤（Decimal）
- TRADE_QUANT: 貿易數量（Decimal，依商品計量單位）
- UNIT_PRICE_USD_PER_KG: 單位價格_美元/公斤（Decimal）
- ETL_DT: 資料更新日期

TRADE_FLOW 值說明：
- "1" = 出口（Export）：台灣出口到其他國家
- "2" = 進口（Import）：其他國家進口到台灣

篩選操作：
- 日期欄位(PERIOD_MONTH, ETL_DT): eq, gt, gte, lt, lte, neq, isNull, in
- 整數欄位(YEAR, MONTH): eq, gt, gte, lt, lte, neq, isNull, in
- 字串欄位(TRADE_FLOW, HS_CODE, HS_CODE_ZH, COUNTRY_ID, COUNTRY_COMM_ZH): eq, contains, startsWith, endsWith, neq, isNull, in
- 小數欄位(TRADE_VALUE_USD_AMT, TRADE_VALUE_TWD_AMT, TRADE_WEIGHT, TRADE_QUANT, UNIT_PRICE_USD_PER_KG): eq, gt, gte, lt, lte, neq, isNull, in
- 複合條件: and, or

常見使用場景：
1. 查詢 2024 年半導體出口數據:
   filter: { YEAR: { eq: 2024 }, TRADE_FLOW: { eq: "1" }, HS_CODE: { startsWith: "8542" } }
2. 查詢對美國的出口月度趨勢:
   filter: { COUNTRY_ID: { eq: "USA" }, TRADE_FLOW: { eq: "1" } }, orderBy: { PERIOD_MONTH: "ASC" }
3. 按國家統計出口總額:
   filter: { YEAR: { eq: 2024 }, TRADE_FLOW: { eq: "1" } }, groupBy: ["COUNTRY_ID", "COUNTRY_COMM_ZH"]
4. 查詢特定 HS Code 在各國的分布:
   filter: { HS_CODE: { eq: "847130" } }, groupBy: ["COUNTRY_ID", "COUNTRY_COMM_ZH"]`;

export const parameters = z.object({
  first: z.number().optional().describe(
    '回傳筆數上限。預設 100，最大 5000。月度統計資料量適中，可適當增加。'
  ),
  after: z.string().optional().describe(
    '分頁游標。使用前次查詢回傳的 endCursor 值來取得下一頁。'
  ),
  filter: z.object({
    PERIOD_MONTH: z.any().optional().describe('統計月份篩選（日期篩選: gte/lte 等）例: { gte: "2024-01-01T00:00:00Z" }'),
    YEAR: z.any().optional().describe('年份篩選（整數篩選）例: { eq: 2024 } 或 { gte: 2023, lte: 2024 }'),
    MONTH: z.any().optional().describe('月份篩選（整數篩選 1-12）例: { eq: 6 }'),
    TRADE_FLOW: z.any().optional().describe('貿易流向篩選（"1"=出口, "2"=進口）例: { eq: "1" }'),
    HS_CODE: z.any().optional().describe('HS Code 篩選（字串篩選）例: { startsWith: "8542" } 或 { eq: "847130" }'),
    HS_CODE_ZH: z.any().optional().describe('中文品名篩選（字串篩選）例: { contains: "積體電路" }'),
    COUNTRY_ID: z.any().optional().describe('國家代碼篩選（ISO3）例: { eq: "USA" } 或 { in: ["USA","JPN"] }'),
    COUNTRY_COMM_ZH: z.any().optional().describe('國家中文名稱篩選 例: { contains: "美" }'),
    TRADE_VALUE_USD_AMT: z.any().optional().describe('美元貿易金額篩選（小數篩選）例: { gte: 1000000 }'),
    TRADE_VALUE_TWD_AMT: z.any().optional().describe('新台幣貿易金額篩選（小數篩選）'),
    TRADE_WEIGHT: z.any().optional().describe('貿易重量篩選（小數篩選，單位: 公斤）'),
    TRADE_QUANT: z.any().optional().describe('貿易數量篩選（小數篩選）'),
    UNIT_PRICE_USD_PER_KG: z.any().optional().describe('單位價格篩選（美元/公斤）'),
    ETL_DT: z.any().optional().describe('資料更新日期篩選'),
    and: z.any().optional().describe('AND 複合條件'),
    or: z.any().optional().describe('OR 複合條件'),
  }).optional().describe(
    '篩選條件。建議至少指定 YEAR 或 PERIOD_MONTH 範圍以提升查詢效率。'
  ),
  orderBy: z.record(z.enum(['ASC', 'DESC'])).optional().describe(
    '排序條件。例: { "TRADE_VALUE_USD_AMT": "DESC" } 按金額降序。'
  ),
  fields: z.array(z.string()).optional().describe(
    '指定回傳欄位。預設所有欄位。例: ["YEAR","MONTH","HS_CODE","COUNTRY_ID","TRADE_VALUE_USD_AMT"]'
  ),
  groupBy: z.array(z.string()).optional().describe(
    '分組欄位。例: ["COUNTRY_ID","COUNTRY_COMM_ZH"] 按國家分組統計。'
  ),
  aggregations: z.array(z.object({
    field: z.string().describe('聚合欄位（數值欄位: YEAR, MONTH, TRADE_VALUE_USD_AMT, TRADE_VALUE_TWD_AMT, TRADE_WEIGHT, TRADE_QUANT, UNIT_PRICE_USD_PER_KG）'),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('聚合函數'),
  })).optional().describe(
    '聚合操作。搭配 groupBy 使用。例: [{ field: "TRADE_VALUE_USD_AMT", function: "sum" }]'
  ),
});

export async function handler(params) {
  try {
    const first = Math.min(params.first || config.defaultPageSize, config.maxPageSize);
    const { query } = buildQuery('trade_monthly_by_code_country', {
      ...params,
      first,
    });

    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'Trade monthly by code query failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
