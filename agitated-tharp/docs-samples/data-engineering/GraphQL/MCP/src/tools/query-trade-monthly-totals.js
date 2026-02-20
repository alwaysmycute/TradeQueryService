/**
 * Tool: query_trade_monthly_totals
 *
 * 查詢按產業群組的月度貿易總計資料 (trade_monthly_totals)。
 *
 * 此表提供台灣按月度與產業群組彙總的進出口貿易數據（不含國家分組），
 * 適合觀察月度趨勢變化。
 */
console.log('loading query_trade_monthly_totals tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_monthly_totals';

export const description =
  `查詢按產業群組的月度貿易總計資料。

用途：提供台灣按月度與產業群組彙總的進出口貿易數據（不含國家維度）。
適合觀察月度趨勢變化，不需要國家明細時使用此工具效率最高。

與其他工具的選擇建議：
- 只需要月度總量趨勢 → 用本工具
- 需要看各國別的月度數據 → 用 query_trade_monthly_by_countries
- 需要年度趨勢 → 用 query_trade_yearly_totals
- 需要月度成長率（同比/環比）→ 用 query_trade_monthly_growth（已預算好，不需手動計算）
- 需要各國月度市佔率 → 用 query_trade_monthly_share_by_countries

可用欄位：
- PERIOD_MONTH: 統計月份（DateTime 格式）
- YEAR: 年份（整數）
- MONTH: 月份（整數，1-12）
- TRADE_FLOW: 貿易流向（"出口"=Export, "進口"=Import）
- INDUSTRY_ID: 產業編號
- INDUSTRY: 產業名稱（中文）
- HS_CODE_GROUP: HS Code 群組代碼
- TRADE_VALUE_USD_AMT: 貿易金額_美元
- TRADE_VALUE_TWD_AMT: 貿易金額_新台幣
- TRADE_WEIGHT: 貿易重量_公斤
- TRADE_QUANT: 貿易數量
- UNIT_PRICE_USD_PER_KG: 單位價格_美元/公斤
- ETL_DT: 資料更新日期

常見使用場景：
1. 查詢 2024 年各月出口趨勢:
   year: 2024, tradeFlow: "出口", order: "ASC"
2. 查詢電子產業月度趨勢:
   year: 2024, tradeFlow: "出口", industryKeyword: "電子", order: "ASC"
3. 查詢最近幾個月的進口數據:
   year: 2024, tradeFlow: "進口", order: "DESC", first: 20`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  industryKeyword: z.string().optional().describe('產業關鍵字，例如 "電子"、"機械"'),
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
  if (params.industryKeyword) {
    filter.INDUSTRY = { contains: params.industryKeyword };
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
    const RESOLVER = 'trade_monthly_total';
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
          error: 'Trade monthly totals query failed',
          details: err.message,
        }),
      }],
      isError: true,
    };
  }
}
