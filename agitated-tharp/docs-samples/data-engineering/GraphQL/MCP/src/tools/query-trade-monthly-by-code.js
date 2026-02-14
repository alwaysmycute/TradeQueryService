/**
 * Tool: query_trade_monthly_by_code
 *
 * 查詢按 HS Code 與國家分組的月度貿易統計資料 (trade_monthly_by_code_countries)。
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
 *
 * ⚠️ Important:
 * - 使用簡化參數介面，不直接傳入 GraphQL filter/orderBy
 * - TRADE_FLOW 在此表為 "出口" / "進口"
 * - COUNTRY_ID 在此表為 ISO2 格式（如 "US"、"JP"）
 */
console.log('🔥 loading query_trade_monthly_by_code tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_monthly_by_code';

export const description =
  `查詢按 HS Code（貨品代碼）與國家分組的月度貿易統計資料。

用途：此工具提供台灣每月按個別 HS Code 與交易國家彙總的進出口貿易數據。
是分析特定商品貿易趨勢最常用的工具。資料已預先彙總，查詢效率高。

與 query_trade_monthly_by_group 的選擇建議：
- 需要看特定商品（如某個 HS Code）的數據 → 用本工具
- 需要看整個產業（如「電子零組件」產業整體）的數據 → 用 query_trade_monthly_by_group

可用欄位：
- PERIOD_MONTH: 統計月份（DateTime 格式）
- YEAR: 年份（整數）
- MONTH: 月份（整數，1-12）
- TRADE_FLOW: 貿易流向（"出口"=Export, "進口"=Import）
- HS_CODE: HS Code 貨品代碼（如 "847130"、"8542310010"）
- HS_CODE_ZH: HS Code 中文品名
- COUNTRY_ID: 國家代碼（ISO2 格式，如 "US"、"JP"）
- COUNTRY_COMM_ZH: 國家中文名稱（如「美國」「日本」）
- TRADE_VALUE_USD_AMT: 貿易金額_美元
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣
- TRADE_WEIGHT: 貿易重量_公斤
- TRADE_QUANT: 貿易數量
- UNIT_PRICE_USD_PER_KG: 單位價格_美元/公斤
- ETL_DT: 資料更新日期

TRADE_FLOW 值說明：
- "出口" = Export：台灣出口到其他國家
- "進口" = Import：其他國家進口到台灣

常見使用場景：
1. 查詢 2024 年半導體出口數據:
   year: 2024, tradeFlow: "出口", hsCode: "8542"
2. 查詢對美國的出口月度趨勢:
   country: "USA", tradeFlow: "出口", order: "ASC"
3. 查詢某品名的商品:
   productKeyword: "積體電路"
4. 查詢特定 HS Code 的完整資料:
   hsCode: "847130"`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  hsCode: z.string().optional().describe('HS Code 或前綴，例如 "8542" 查前綴、"847130" 查精確代碼'),
  productKeyword: z.string().optional().describe('中文品名關鍵字，例如 "積體電路"、"半導體"'),
  country: z.string().optional().describe('國家代碼(ISO2 如 US、JP)或中文名(如 美國、日本)'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依月份排序'),
  first: z.number().optional().describe('回傳筆數，預設 50'),
});

export const buildFilterFromParams = (params) => {
  const filter = {};

  if (params.year) {
    filter.YEAR = { eq: params.year };
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
    // 6碼以上視為精確查詢，否則視為前綴查詢
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
      // ISO2 code (US, JP, DE...)
      filter.COUNTRY_ID = { eq: val.toUpperCase() };
    } else {
      // Chinese name
      filter.COUNTRY_COMM_ZH = { contains: val };
    }
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
};

export const execute = async (params) => {
  const filter = buildFilterFromParams(params);
  const normalizedParams = {
    filter,
    orderBy: params.order ? { PERIOD_MONTH: params.order } : undefined,
    first: Math.min(params.first ?? 50, config.maxPageSize),
  };

  try {
    const RESOLVER = 'trade_monthly_by_code_country';
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
        text: JSON.stringify({ error: 'Trade monthly by code query failed', details: err.message }),
      }],
      isError: true,
    };
  }
};

export async function handler(params) {
  return execute(params);
}
