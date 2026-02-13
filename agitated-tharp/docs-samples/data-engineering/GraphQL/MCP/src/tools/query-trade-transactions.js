/**
 * Tool: query_trade_transactions
 *
 * 查詢完整交易明細資料 (TXN_MOF_NON_PROTECT_MT)。
 *
 * ⚠️ 重要注意事項：
 * 此表包含所有進出口交易的原始明細資料，資料量極大，查詢時間較長。
 * 請僅在以下情況使用此工具：
 * 1. 其他彙總工具（query_trade_monthly_by_code / query_trade_monthly_by_group）
 *    無法提供所需的資料細節
 * 2. 需要查詢日級別（而非月級別）的交易資料
 * 3. 需要查詢其他工具沒有的欄位（如 HS_CODE_EN、COUNTRY_EN、RATE_VALUE 等）
 *
 * 此表相比月度彙總表，額外包含：
 * - 英文品名 (HS_CODE_EN)
 * - 英文國名 (COUNTRY_EN)
 * - 原始國家中文名 (COUNTRY_ZH) 與通用國家中文名 (COUNTRY_COMM_ZH)
 * - 原始重量 (TRADE_WEIGHT_ORG)
 * - 匯率 (RATE_VALUE)
 * - 日級別交易日期 (TXN_DT)
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_transactions';

export const description =
  `查詢完整交易明細資料 (TXN_MOF_NON_PROTECT_MT)。

⚠️ 注意：此為大資料量明細表，查詢時間較長。
請優先使用以下工具，僅在它們無法滿足需求時才使用本工具：
- query_trade_monthly_by_code: 按 HS Code 的月度統計（最常用）
- query_trade_monthly_by_group: 按產業群組的月度統計（含地區資訊）
- query_hscode_reference: HS Code 參考資料查詢
- query_country_area_reference: 國家/地區參考資料查詢

本工具的獨特價值（其他工具沒有的功能）：
1. 日級別交易日期 (TXN_DT) - 可查詢特定日期的交易
2. 英文品名 (HS_CODE_EN) 和英文國名 (COUNTRY_EN)
3. 匯率資訊 (RATE_VALUE)
4. 原始重量 (TRADE_WEIGHT_ORG)

可用欄位：
- TXN_DT: 交易日期（DateTime，日級別精度）
- HS_CODE: HS Code 貨品代碼
- HS_CODE_ZH: HS Code 中文品名
- HS_CODE_EN: HS Code 英文品名（本表獨有）
- COUNTRY_ID: 國家代碼（ISO3 格式）
- COUNTRY_ZH: 國家中文名稱（原始）
- COUNTRY_EN: 國家英文名稱（本表獨有）
- COUNTRY_COMM_ZH: 國家中文通用名稱
- COUNTRY_COMM_EN: 國家英文通用名稱
- TRADE_FLOW: 貿易流向（"1"=出口, "2"=進口）
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣
- TRADE_QUANT: 貿易數量
- TRADE_WEIGHT_ORG: 原始貿易重量（本表獨有）
- TRADE_WEIGHT: 貿易重量_公斤
- RATE_VALUE: 匯率（本表獨有）
- TRADE_VALUE_USD_AMT: 貿易金額_美元
- ETL_DT: 資料更新日期

使用建議：
- 務必指定日期範圍篩選 (TXN_DT) 以限制查詢資料量
- 建議搭配 HS_CODE 或 COUNTRY_ID 等篩選條件
- 設定合理的 first 參數（建議 100-500）
- 避免不帶篩選條件的查詢

常見使用場景：
1. 查詢特定日期的交易明細:
   filter: { TXN_DT: { gte: "2024-06-01T00:00:00Z", lte: "2024-06-30T23:59:59Z" }, HS_CODE: { startsWith: "8542" } }
2. 查詢含英文品名的資料:
   filter: { HS_CODE: { eq: "847130" } }, fields: ["TXN_DT","HS_CODE","HS_CODE_ZH","HS_CODE_EN","TRADE_VALUE_USD_AMT"]
3. 查詢含匯率的交易資料:
   filter: { TXN_DT: { gte: "2024-01-01T00:00:00Z" }, COUNTRY_ID: { eq: "USA" } }`;

export const parameters = z.object({
  first: z.number().optional().describe(
    '回傳筆數上限。預設 100，最大 5000。因資料量大，建議設定較小值（100-500）。'
  ),
  after: z.string().optional().describe(
    '分頁游標。使用前次查詢回傳的 endCursor 取得下一頁。'
  ),
  filter: z.object({
    TXN_DT: z.any().optional().describe('交易日期篩選（日期篩選: gte/lte）⚠️ 強烈建議指定此欄位以限制查詢範圍'),
    HS_CODE: z.any().optional().describe('HS Code 篩選（字串篩選: eq/startsWith/contains/in）'),
    HS_CODE_ZH: z.any().optional().describe('中文品名篩選'),
    HS_CODE_EN: z.any().optional().describe('英文品名篩選'),
    COUNTRY_ID: z.any().optional().describe('國家代碼篩選（ISO3）'),
    COUNTRY_ZH: z.any().optional().describe('國家中文名稱篩選（原始）'),
    COUNTRY_EN: z.any().optional().describe('國家英文名稱篩選'),
    COUNTRY_COMM_ZH: z.any().optional().describe('國家中文通用名稱篩選'),
    COUNTRY_COMM_EN: z.any().optional().describe('國家英文通用名稱篩選'),
    TRADE_FLOW: z.any().optional().describe('貿易流向篩選（"1"=出口, "2"=進口）'),
    TRADE_VALUE_TWD_AMT: z.any().optional().describe('新台幣金額篩選'),
    TRADE_QUANT: z.any().optional().describe('數量篩選'),
    TRADE_WEIGHT_ORG: z.any().optional().describe('原始重量篩選'),
    TRADE_WEIGHT: z.any().optional().describe('重量篩選（公斤）'),
    RATE_VALUE: z.any().optional().describe('匯率篩選'),
    TRADE_VALUE_USD_AMT: z.any().optional().describe('美元金額篩選'),
    ETL_DT: z.any().optional().describe('資料更新日期篩選'),
    and: z.any().optional().describe('AND 複合條件'),
    or: z.any().optional().describe('OR 複合條件'),
  }).optional().describe(
    '篩選條件。⚠️ 務必指定 TXN_DT 日期範圍，避免查詢過多資料。'
  ),
  orderBy: z.record(z.enum(['ASC', 'DESC'])).optional().describe(
    '排序條件。例: { "TXN_DT": "DESC", "TRADE_VALUE_USD_AMT": "DESC" }'
  ),
  fields: z.array(z.string()).optional().describe(
    '指定回傳欄位。建議僅選取需要的欄位以減少資料傳輸量。'
  ),
  groupBy: z.array(z.string()).optional().describe(
    '分組欄位。例: ["HS_CODE","HS_CODE_ZH"] 按商品分組。'
  ),
  aggregations: z.array(z.object({
    field: z.string().describe('聚合欄位（數值欄位: TRADE_VALUE_TWD_AMT, TRADE_QUANT, TRADE_WEIGHT_ORG, TRADE_WEIGHT, RATE_VALUE, TRADE_VALUE_USD_AMT）'),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('聚合函數'),
  })).optional().describe(
    '聚合操作。搭配 groupBy 使用。'
  ),
});

export async function handler(params) {
  try {
    const first = Math.min(params.first || config.defaultPageSize, config.maxPageSize);
    const { query } = buildQuery('TXN_MOF_NON_PROTECT_MT', {
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
        text: JSON.stringify({ error: 'Trade transaction query failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
