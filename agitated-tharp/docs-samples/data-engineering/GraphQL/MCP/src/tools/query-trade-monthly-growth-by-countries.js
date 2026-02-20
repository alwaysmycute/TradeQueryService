/**
 * Tool: query_trade_monthly_growth_by_countries
 *
 * 查詢各國月度貿易成長率 (trade_monthly_growth_by_countries)。
 * 已預算好各國的同比(YoY)/環比(MoM)成長率，含金額/重量/單價。
 */
console.log('loading query_trade_monthly_growth_by_countries tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_monthly_growth_by_countries';

export const description =
  `當用戶問「對某國出口成長多少」「哪個國家成長最快」「各國月度成長比較」時，用本工具。
已預算好各國的同比(YoY)與環比(MoM)成長率，含金額/重量/單價三維度。

用途：查詢台灣對各國的月度貿易成長率分析。
若不需要國家維度，只看總體成長 → 用 query_trade_monthly_growth。
若需要年度成長率 → 用 query_trade_yearly_growth。

可用欄位：
- PERIOD_MONTH, YEAR, MONTH: 時間
- TRADE_FLOW: "出口" / "進口"
- INDUSTRY_ID, INDUSTRY, HS_CODE_GROUP: 產業
- COUNTRY_ID(ISO2), COUNTRY_COMM_ZH: 國家
- AREA_ID, AREA_NM: 地區（東北亞、東南亞、歐洲、北美洲...）
- 金額同比: PREV_YEAR_TRADE_VALUE_USD_AMT, YOY_DELTA_TRADE_VALUE_USD_AMT, YOY_GROWTH_RATE_TRADE_VALUE_USD
- 金額環比: PREV_MONTH_TRADE_VALUE_USD_AMT, MOM_DELTA_TRADE_VALUE_USD_AMT, MOM_GROWTH_RATE_TRADE_VALUE_USD
- 重量同比: PREV_YEAR_TRADE_WEIGHT, YOY_DELTA_TRADE_WEIGHT, YOY_GROWTH_RATE_TRADE_WEIGHT
- 重量環比: PREV_MONTH_TRADE_WEIGHT, MOM_DELTA_TRADE_WEIGHT, MOM_GROWTH_RATE_TRADE_WEIGHT
- 單價同比: PREV_YEAR_UNIT_PRICE_USD_PER_KG, YOY_DELTA_UNIT_PRICE_USD_PER_KG, YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG
- 單價環比: PREV_MONTH_UNIT_PRICE_USD_PER_KG, MOM_DELTA_UNIT_PRICE_USD_PER_KG, MOM_GROWTH_RATE_UNIT_PRICE_USD_PER_KG
- ETL_DT: 資料更新日期

AREA_NM 有效值：東北亞、東南亞、南亞、西亞、歐洲、北美洲、中南美洲、大洋洲、非洲

常見使用場景：
1. 對美國出口月度成長率: year: 2024, tradeFlow: "出口", country: "US"
2. 東南亞各國進口成長比較: year: 2024, tradeFlow: "進口", country: "東南亞"
3. 電子產業對各國出口成長: year: 2024, tradeFlow: "出口", industryKeyword: "電子"`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  industryKeyword: z.string().optional().describe('產業關鍵字，例如 "電子"、"機械"'),
  country: z.string().optional().describe('國家或地區（ISO2 如 US，中文如 美國 或 東南亞，英文如 EUROPE）'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依月份排序'),
  first: z.number().optional().describe('回傳筆數，預設 50'),
});

const buildFilterFromParams = (params) => {
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
  if (params.country) {
    const val = params.country.trim();
    if (/^[A-Z]{2}$/i.test(val)) {
      filter.COUNTRY_ID = { eq: val.toUpperCase() };
    } else if (/^[A-Z_]+$/i.test(val)) {
      filter.AREA_ID = { eq: val.toUpperCase() };
    } else {
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

  try {
    const RESOLVER = 'trade_monthly_growth_by_country';
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
          error: 'Trade monthly growth by countries query failed',
          details: err.message,
        }),
      }],
      isError: true,
    };
  }
}
