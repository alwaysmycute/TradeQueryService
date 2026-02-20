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
 * - 按國家或 HS Code 彙計月度貿易總額
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

與其他工具的選擇建議：
- 需要看特定商品（如某個 HS Code）的數據 → 用本工具
- 需要看整個產業（如「電子零組件」產業整體）的數據 → 用 query_trade_monthly_by_group
- 需要成長率（同比/環比）→ 用 query_trade_monthly_growth_by_countries（已預算好）
- 需要市佔率（佔比）→ 用 query_trade_monthly_share_by_countries（已預算好）

可用欄位：
- PERIOD_MONTH: 統計月份（DateTime）
- YEAR: 年份, MONTH: 月份（1-12）
- TRADE_FLOW: 貿易流向（"出口" / "進口"）
- HS_CODE: HS Code 貨品代碼（如 "847130"、"8542310010"）
- HS_CODE_ZH: HS Code 中文品名
- COUNTRY_ID: 國家代碼（ISO2 格式，如 "US"、"JP"）
- COUNTRY_COMM_ZH: 國家中文名稱（如「美國」「日本」）
- TRADE_VALUE_USD_AMT: 貿易金額_美元
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣
- TRADE_WEIGHT: 貿易重量_公斤
- TRADE_QUANT: 貿易數量
- UNIT_PRICE_USD_PER_KG: 單位價格_美元/公斤

常見使用場景：
1. 查詢對美國出口的半導體月度趨勢:
   hsCode: "8542", country: "US", tradeFlow: "出口", order: "ASC"
2. 2024 年各月台灣出口到主要國家的電子產品統計:
   year: 2024, tradeFlow: "出口", industryKeyword: "電子", first: 100
3. 查詢某個 HS Code 的完整歷史數據（所有國家）:
   hsCode: "847130", first: 10
4. 依金額排名的出口統計:
   hsCode: "847130", tradeFlow: "出口", country: "US", orderBy: "TRADE_VALUE_USD_AMT", order: "DESC"
5. 按國家分組彙總的貿易總額（使用 groupBy 和 aggregations）:
   hsCode: "847130", tradeFlow: "出口", groupBy: "COUNTRY_ID", aggregations: "TRADE_VALUE_USD_AMT,sum"`;

// 定義聚合函數的枚舉
const AGGREGATION_FUNCTIONS = ['sum', 'avg', 'min', 'max', 'count'];
const AGGREGATION_OPERATORS = AGGREGATION_FUNCTIONS.map(fn => {
  return [`${fn},sum`, `${fn},avg`, `${fn},min`, `${fn},max`, `${fn},count`];
}).flat();

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  hsCode: z.string().optional().describe('HS Code 或前綴，例如 "8542" 查前綴、"847130" 查精確代碼'),
  productKeyword: z.string().optional().describe('中文品名關鍵字，例如 "積體電路"、"半導體"'),
  country: z.string().optional().describe('國家代碼(ISO2 如 US，中文如 美國 或 東南亞，英文如 EUROPE）'),
  fields: z.array(z.string()).optional().describe('指定返回的欄位，例如 ["HS_CODE", "COUNTRY_ID", "TRADE_VALUE_USD_AMT"]'),
  groupBy: z.array(z.string()).optional().describe('按欄位分組統計，例如 ["COUNTRY_ID"] 或 ["HS_CODE", "COUNTRY_ID"]'),
  aggregations: z.array(z.string()).optional().describe('聚合函數，例如 ["TRADE_VALUE_USD_AMT,sum", "TRADE_VALUE_TWD_AMT,avg"]'),
  orderBy: z.string().optional().describe('排序欄位，例如 "TRADE_VALUE_USD_AMT" 或 "PERIOD_MONTH"'),
  order: z.enum(['ASC', 'DESC']).optional().describe('升序或降序'),
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
    if (tfRaw === '出口' || tfRaw === '1' || tfRaw === 'export') {
      tf = '出口';
    } else if (tfRaw === '進口' || tfRaw === '2' || tfRaw === 'import') {
      tf = '進口';
    } else {
      tf = String(params.tradeFlow);
    }
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
      // ISO2 code (US, JP, DE...)
      filter.COUNTRY_ID = { eq: val.toUpperCase() };
    } else if (/^[A-Z_]+$/i.test(val)) {
      // Area ID (EUROPE, SOUTHEAST_ASIA...)
      filter.AREA_ID = { eq: val.toUpperCase() };
    } else {
      // Chinese name or English name
      filter.or = [
        { COUNTRY_COMM_ZH: { eq: val } },
        { AREA_NM: { eq: val } },
      ];
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

  // 添加 fields 選擇（如果指定）
  if (params.fields && params.fields.length > 0) {
    normalizedParams.fields = params.fields;
  }

  // 添加 groupBy 和 aggregations（如果指定）
  if (params.groupBy && params.groupBy.length > 0) {
    normalizedParams.groupBy = params.groupBy;
  }

  if (params.aggregations && params.aggregations.length > 0) {
    // 驗證 aggregations 格式：應該是 "FIELD,FUNCTION"
    const validAggregations = [];
    for (const agg of params.aggregations) {
      const parts = agg.split(',');
      if (parts.length === 2 && AGGREGATION_FUNCTIONS.includes(parts[1].trim())) {
        validAggregations.push({
          field: parts[0].trim(),
          function: parts[1].trim(),
        });
      }
    }
    
    if (validAggregations.length > 0) {
      normalizedParams.aggregations = validAggregations;
    }
  }

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
        text: JSON.stringify({
          error: 'Trade monthly by code query failed',
          details: err.message,
          hint: '請檢查參數是否正確。如果使用 groupBy/aggregations，請確保欄位名稱正確。',
        }),
      }],
      isError: true,
    };
  }
}
