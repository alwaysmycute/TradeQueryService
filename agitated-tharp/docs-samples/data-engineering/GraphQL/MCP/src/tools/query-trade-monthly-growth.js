/**
 * Tool: query_trade_monthly_growth
 *
 * 查詢月度貿易成長率資料 (trade_monthly_growth_totals)。
 * 已預算好同比(YoY)與環比(MoM)成長率，不需手動計算。
 */
console.log('loading query_trade_monthly_growth tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_monthly_growth';

export const description =
  `當用戶問「成長多少」「月增率」「年增率」「同比」「環比」等月度成長趨勢時，用本工具。
已預算好同比(YoY)與環比(MoM)成長率，不需要手動拉兩期數據計算。

用途：查詢台灣各產業月度貿易的同比/環比成長率（不含國家維度）。
若需要各國別的成長率 → 用 query_trade_monthly_growth_by_countries。
若需要年度成長率 → 用 query_trade_yearly_growth。

可用欄位：
- PERIOD_MONTH: 統計月份（DateTime）
- YEAR: 年份, MONTH: 月份（1-12）
- TRADE_FLOW: 貿易流向（"出口" / "進口"）
- INDUSTRY_ID: 產業編號, INDUSTRY: 產業名稱, HS_CODE_GROUP: 群組代碼
- TRADE_VALUE_USD_AMT: 本期貿易金額（美元）
- TRADE_WEIGHT: 本期重量（公斤）
- UNIT_PRICE_USD_PER_KG: 本期單價
- PREV_YEAR_TRADE_VALUE_USD_AMT: 去年同期金額
- YOY_DELTA_TRADE_VALUE_USD_AMT: 同比差額（本期 - 去年同期）
- YOY_GROWTH_RATE_TRADE_VALUE_USD: 同比成長率（小數，0.05 = 5%）
- PREV_MONTH_TRADE_VALUE_USD_AMT: 上月金額
- MOM_DELTA_TRADE_VALUE_USD_AMT: 環比差額（本期 - 上月）
- MOM_GROWTH_RATE_TRADE_VALUE_USD: 環比成長率（小數）
- ETL_DT: 資料更新日期

AREA_NM 有效值：東北亞、東南亞、南亞、西亞、歐洲、北美洲、中南美洲、大洋洲、非洲

常見使用場景：
1. 2024 年各月出口同比成長率: year: 2024, tradeFlow: "出口", order: "ASC"
2. 電子產業月度成長趨勢: year: 2024, industryKeyword: "電子", order: "ASC"
3. 最近幾月進口環比變化: year: 2024, tradeFlow: "進口", order: "DESC"`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  industryKeyword: z.string().optional().describe('產業關鍵字，例如 "電子"、"機械"'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依月份排序'),
  first: z.number().optional().describe('回傳筆數，預設 50'),
});

export const buildFilterFromParams = (params) => {
  const filter = {};
  if (params.year) filter.YEAR = { eq: params.year };
  if (params.tradeFlow) {
    const tfRaw = String(params.tradeFlow).toLowerCase();
    let tf;
    if (tfRaw === '出口' || tfRaw === '1' || tfRaw === 'export') tf = '出口';
    else if (tfRaw === '進口' || tfRaw === '2' || tfRaw === 'import') tf = '進口';
    else tf = String(params.tradeFlow);
    filter.TRADE_FLOW = { eq: tf };
  }
  if (params.industryKeyword) filter.INDUSTRY = { contains: params.industryKeyword };
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
    const { query } = buildQuery('trade_monthly_growth_total', normalizedParams);
    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Trade monthly growth query failed', details: err.message }) }],
      isError: true,
    };
  }
};

export async function handler(params) { return execute(params); }
