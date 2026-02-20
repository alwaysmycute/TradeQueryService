/**
 * Tool: query_trade_yearly_share_by_countries
 *
 * 查詢各國年度貿易市佔率 (trade_yearly_share_by_countries)。
 * 已預算好各國佔台灣年度總出口/進口的比重。
 */
console.log('loading query_trade_yearly_share_by_countries tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_yearly_share_by_countries';

export const description =
  `當用戶問「某國佔台灣年度出口多少比重」「各國年度市佔排名」時，用本工具。
已預算好各國年度市佔率，不需手動計算。

用途：查詢各國佔台灣年度貿易總額的比重。
若需要月度市佔率 → 用 query_trade_monthly_share_by_countries。

可用欄位：
- YEAR: 年份
- TRADE_FLOW: "出口" / "進口"
- INDUSTRY_ID, INDUSTRY, HS_CODE_GROUP: 產業
- COUNTRY_ID(ISO2), COUNTRY_COMM_ZH: 國家
- AREA_ID, AREA_NM: 地區
- TRADE_VALUE_USD_AMT: 該國年度貿易金額
- TOTAL_TRADE_VALUE_USD_AMT: 台灣該年總貿易金額
- SHARE_RATIO_TRADE_VALUE_USD: 金額市佔率（小數，0.15 = 15%）
- TRADE_WEIGHT: 該國年度重量
- TOTAL_TRADE_WEIGHT: 台灣該年總重量
- SHARE_RATIO_TRADE_WEIGHT: 重量市佔率
- UNIT_PRICE_USD_PER_KG: 單價
- ETL_DT: 資料更新日期

AREA_NM 有效值：東北亞、東南亞、南亞、西亞、歐洲、北美洲、中南美洲、大洋洲、非洲

常見使用場景：
1. 2024 年各國出口佔比排名: year: 2024, tradeFlow: "出口", first: 100
2. 美國歷年佔比趨勢: tradeFlow: "出口", country: "US", order: "ASC"
3. 東南亞年度進口佔比: year: 2024, tradeFlow: "進口", country: "東南亞"
4. 電子產業各國年度市佔: year: 2024, tradeFlow: "出口", industryKeyword: "電子"`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  industryKeyword: z.string().optional().describe('產業關鍵字，例如 "電子"、"機械"'),
  country: z.string().optional().describe('國家或地區（ISO2 如 US，中文如 美國 或 東南亞，英文如 EUROPE）'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依年份排序'),
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
    const RESOLVER = 'trade_yearly_share_by_country';
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
          error: 'Trade yearly share by countries query failed',
          details: err.message,
        }),
      }],
      isError: true,
    };
  }
}
