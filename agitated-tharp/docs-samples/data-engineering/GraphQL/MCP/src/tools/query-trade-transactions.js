/**
 * Tool: query_trade_transactions
 *
 * 查詢完整交易明細資料 (TXN_MOF_NON_PROTECT_MT)。
 *
 * ⚠️ 重要注意事項：
 * 此表包含所有進出口交易的原始明細資料，資料量極大，查詢時間較長。
 * 請僅在以下情況使用此工具：
 * 1. 其他彙總工具無法提供所需的資料細節
 * 2. 需要查詢日級別（而非月級別）的交易資料
 * 3. 需要查詢其他工具沒有的欄位（如 HS_CODE_EN、COUNTRY_EN、RATE_VALUE 等）
 *
 * ⚠️ Important:
 * - 使用簡化參數介面，不直接傳入 GraphQL filter/orderBy
 * - TRADE_FLOW 在此表為 "出口" / "進口"
 * - COUNTRY_ID 在此表為 ISO2 格式
 * - 務必指定日期範圍以避免查詢過多資料
 */
console.log('🔥 loading query_trade_transactions tool');

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
- query_trade_monthly_growth / query_trade_monthly_growth_by_countries: 成長率分析（已預算好）
- query_trade_monthly_share_by_countries / query_trade_yearly_share_by_countries: 市佔率分析（已預算好）

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
- COUNTRY_ID: 國家代碼（ISO2 格式）
- COUNTRY_ZH: 國家中文名稱（原始）
- COUNTRY_EN: 國家英文名稱（本表獨有）
- COUNTRY_COMM_ZH: 國家中文通用名稱
- COUNTRY_COMM_EN: 國家英文通用名稱
- TRADE_FLOW: 貿易流向（"出口"=Export, "進口"=Import）
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣
- TRADE_QUANT: 貿易數量
- TRADE_WEIGHT_ORG: 原始貿易重量（本表獨有）
- TRADE_WEIGHT: 貿易重量_公斤
- RATE_VALUE: 匯率（本表獨有）
- TRADE_VALUE_USD_AMT: 貿易金額_美元
- ETL_DT: 資料更新日期

常見使用場景：
1. 查詢特定日期範圍的半導體交易:
   startDate: "2024-06-01", endDate: "2024-06-30", hsCode: "8542"
2. 查詢對美國的出口（含英文品名）:
   startDate: "2024-01-01", endDate: "2024-01-31", country: "USA", tradeFlow: "出口"
3. 查詢含匯率的交易資料:
   startDate: "2024-06-01", endDate: "2024-06-30", country: "JPN"`;

export const parameters = z.object({
  startDate: z.string().optional().describe('起始日期，格式 YYYY-MM-DD，例如 "2024-01-01"。⚠️ 強烈建議指定'),
  endDate: z.string().optional().describe('結束日期，格式 YYYY-MM-DD，例如 "2024-01-31"'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  hsCode: z.string().optional().describe('HS Code 或前綴，例如 "8542"'),
  productKeyword: z.string().optional().describe('中文品名關鍵字，例如 "積體電路"'),
  country: z.string().optional().describe('國家代碼(ISO2 如 US、JP)或中文名(如 美國)'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依交易日期排序'),
  first: z.number().optional().describe('回傳筆數，預設 50，建議 100-500'),
});

export const buildFilterFromParams = (params) => {
  const filter = {};

  // 日期範圍
  if (params.startDate || params.endDate) {
    const dtFilter = {};
    if (params.startDate) {
      dtFilter.gte = `${params.startDate}T00:00:00Z`;
    }
    if (params.endDate) {
      dtFilter.lte = `${params.endDate}T23:59:59Z`;
    }
    filter.TXN_DT = dtFilter;
  }

  if (params.tradeFlow) {
    const tfRaw = String(params.tradeFlow).toLowerCase();
    let tf;
    if (tfRaw === '出口' || tfRaw === '1' || tfRaw === 'export') tf = '出口';
    else if (tfRaw === '進口' || tfRaw === '2' || tfRaw === 'import') tf = '進口';
    else tf = String(params.tradeFlow);

    filter.TRADE_FLOW = { eq: tf };
  }
  if (params.hsCode) {
    const code = params.hsCode.trim();
    if (code.length >= 6) {
      filter.HS_CODE = { eq: code };
    } else {
      filter.HS_CODE = { startsWith: code };
    }
  }
  if (params.productKeyword) {
    filter.HS_CODE_ZH = { contains: params.productKeyword };
  }
  if (params.country) {
    const val = params.country.trim();
    if (/^[A-Z]{2}$/i.test(val)) {
      filter.COUNTRY_ID = { eq: val.toUpperCase() };
    } else {
      filter.COUNTRY_COMM_ZH = { contains: val };
    }
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
};


export async function handler(params) {
  const filter = buildFilterFromParams(params);
  const normalizedParams = {
    filter,
    orderBy: params.orderBy ? { [params.orderBy]: params.order || 'ASC' } : undefined,
    first: Math.min(params.first ?? 50, config.maxPageSize),
  };

  try {
    const RESOLVER = 'TXN_MOF_NON_PROTECT_MT';
    const { query } = buildQuery(RESOLVER, normalizedParams);

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
        text: JSON.stringify({
          error: 'Trade transactions query failed',
          details: err.message,
        }),
      }],
      isError: true,
    };
  }
}
