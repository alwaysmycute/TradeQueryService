/**
 * Tool: query_trade_yearly_growth
 *
 * 查詢年度貿易成長率資料 (trade_yearly_growth_totals)。
 * 已預算好年度同比(YoY)成長率，含金額、重量、單價三維度。
 */
console.log('loading query_trade_yearly_growth tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_yearly_growth';

export const description =
  `當用戶問「去年成長多少」「年增率」「歷年成長趨勢」時，用本工具。
已預算好年度同比成長率（金額/重量/單價），不需要手動計算。

用途：查詢台灣各產業年度貿易的同比成長率（不含國家維度）。
若需要各國別的成長率 → 用 query_trade_monthly_growth_by_countries。
若需要月度成長率 → 用 query_trade_monthly_growth。

可用欄位：
- YEAR: 年份
- TRADE_FLOW: 貿易流向（"出口" / "進口"）
- INDUSTRY_ID: 產業編號, INDUSTRY: 產業名稱
- 金額成長:
  - TRADE_VALUE_USD_AMT: 本年金額, PREV_YEAR_TRADE_VALUE_USD_AMT: 前年金額
  - YOY_DELTA_TRADE_VALUE_USD_AMT: 差額, YOY_GROWTH_RATE_TRADE_VALUE_USD: 成長率
- 重量成長:
  - TRADE_WEIGHT: 本年重量, PREV_YEAR_TRADE_WEIGHT: 前年重量
  - YOY_DELTA_TRADE_WEIGHT: 差額, YOY_GROWTH_RATE_TRADE_WEIGHT: 成長率
- 單價成長:
  - UNIT_PRICE_USD_PER_KG: 本年單價, PREV_YEAR_UNIT_PRICE_USD_PER_KG: 前年單價
  - YOY_DELTA_UNIT_PRICE_USD_PER_KG: 差額, YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG: 成長率
- ETL_DT: 資料更新日期

常見使用場景：
1. 各產業 2024 年出口成長率: year: 2024, tradeFlow: "出口"
2. 電子產業歷年成長趨勢: tradeFlow: "出口", industryKeyword: "電子", order: "ASC"
3. 進口成長最快的年份: tradeFlow: "進口", order: "ASC"`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  industryKeyword: z.string().optional().describe('產業關鍵字，例如 "電子"、"機械"'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依年份排序'),
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
    orderBy: params.order ? { YEAR: params.order } : undefined,
    first: Math.min(params.first ?? 50, config.maxPageSize),
  };

  try {
    const { query } = buildQuery('trade_yearly_growth_total', normalizedParams);
    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Trade yearly growth query failed', details: err.message }) }],
      isError: true,
    };
  }
};

export async function handler(params) { return execute(params); }
