/**
 * Tool: query_trade_yearly_by_countries
 *
 * 查詢按國家分組的年度貿易統計資料 (trade_yearly_by_countries)。
 *
 * 此表提供台灣按年度、國家與產業群組彙總的進出口貿易數據，
 * 包含地區歸屬資訊（AREA_ID, AREA_NM），可直接按洲別分析。
 */
console.log('loading query_trade_yearly_by_countries tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_trade_yearly_by_countries';

export const description =
  `查詢按國家分組的年度貿易統計資料。

用途：提供台灣按年度、國家與產業群組彙總的進出口貿易數據。
包含地區歸屬資訊，適合年度層級的國別/區域貿易比較分析。

與其他工具的選擇建議：
- 需要各國年度數據 → 用本工具
- 不需要國家維度、只看年度總量 → 用 query_trade_yearly_totals
- 需要月度國別數據 → 用 query_trade_monthly_by_countries
- 需要各國年度市佔率（佔比）→ 用 query_trade_yearly_share_by_countries（已預算好）
- 需要年度成長率 → 用 query_trade_yearly_growth

AREA_NM 有效值：東北亞、東南亞、南亞、西亞、歐洲、北美洲、中南美洲、大洋洲、非洲

可用欄位：
- YEAR: 年份（整數）
- TRADE_FLOW: 貿易流向（"出口"=Export, "進口"=Import）
- COUNTRY_ID: 國家代碼（ISO2 格式，如 "US"、"JP"）
- COUNTRY_COMM_ZH: 國家中文名稱
- AREA_ID: 地區代碼
- AREA_NM: 地區名稱（如「東北亞」「歐洲」「北美洲」）
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
1. 查詢 2024 年各國出口金額:
   year: 2024, tradeFlow: "出口"
2. 查詢對美國歷年出口趨勢:
   tradeFlow: "出口", country: "US", order: "ASC"
3. 查詢東南亞各國年度進口:
   year: 2024, tradeFlow: "進口", country: "東南亞"
4. 查詢電子產業對各國年度出口:
   year: 2024, tradeFlow: "出口", industryKeyword: "電子"`;

export const parameters = z.object({
  year: z.number().optional().describe('查詢年份，例如 2024'),
  tradeFlow: z.enum(['出口', '進口']).optional().describe('出口或進口'),
  industryKeyword: z.string().optional().describe('產業關鍵字，例如 "電子"、"機械"'),
  country: z.string().optional().describe('國家或地區（ISO2 代碼如 US → COUNTRY_ID，中文如 美國 → COUNTRY_COMM_ZH 或 東南亞 → AREA_NM，英文如 EUROPE → AREA_ID）'),
  order: z.enum(['ASC', 'DESC']).optional().describe('依年份排序'),
  first: z.number().optional().describe('回傳筆數，預設 50'),
});

const buildFilterFromParams = (params) => {
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

export const execute = async (params) => {
  const filter = buildFilterFromParams(params);
  const normalizedParams = {
    filter,
    orderBy: params.order ? { YEAR: params.order } : undefined,
    first: Math.min(params.first ?? 50, config.maxPageSize),
  };

  try {
    const RESOLVER = 'trade_yearly_by_country';
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
        text: JSON.stringify({ error: 'Trade yearly by countries query failed', details: err.message }),
      }],
      isError: true,
    };
  }
};

export async function handler(params) {
  return execute(params);
}
