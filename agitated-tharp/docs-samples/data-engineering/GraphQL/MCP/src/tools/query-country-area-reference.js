/**
 * Tool: query_country_area_reference
 *
 * 查詢國家/地區參考資料表 (UNION_REF_COUNTRY_AREA)。
 *
 * 此表提供台灣經貿數據中使用的國家與地區對照資訊，包括：
 * - ISO3 代碼：國際標準三字母國家代碼（如 USA、JPN、CHN）
 * - 中英文國名：國家的中文通用名稱與英文名稱
 * - 地區歸屬：國家所屬的洲別或經濟區域（如「亞洲」「歐洲」「北美洲」）
 *
 * 此表為參考資料表（Reference Data），資料量小、查詢速度快。
 *
 * ⚠️ Important:
 * - 使用簡化參數介面，不直接傳入 GraphQL filter/orderBy
 * - 只透過 buildQuery 傳入 filter/orderBy/first，不傳 fields/groupBy/aggregations
 */
console.log('🔥 loading query_country_area_reference tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_country_area_reference';

export const description =
  `查詢國家/地區參考資料 (UNION_REF_COUNTRY_AREA)。

用途：查詢台灣經貿數據使用的國家與地區對照表，包含 ISO3 代碼、中英文國名及地區歸屬。
資料量小、查詢速度快，適合作為前置查詢或參考查詢。

可用欄位：
- ISO3: 國際標準三字母國家代碼（如 USA、JPN、CHN、DEU、KOR）
- COUNTRY_COMM_ZH: 國家中文通用名稱（如「美國」「日本」「中國大陸」）
- COUNTRY_COMM_EN: 國家英文名稱（如 "United States"、"Japan"）
- AREA_ID: 地區代碼（用於分組歸類）
- AREA_NM: 地區名稱（如「亞洲」「歐洲」「北美洲」「大洋洲」）
- ROW: 排序序號
- AREA_sort: 地區排序序號

常見使用場景：
1. 查詢特定國家的資訊:
   country: "USA" 或 country: "美國"
2. 查詢特定地區的所有國家:
   area: "亞洲"
3. 搜尋國家名稱:
   country: "韓"
4. 用英文搜尋國家:
   country: "Japan"`;

export const parameters = z.object({
  country: z.string().optional().describe('國家代碼(ISO3 如 USA)、中文名(如 美國)或英文名(如 Japan)'),
  area: z.string().optional().describe('地區名稱，例如 "亞洲"、"歐洲"、"北美洲"'),
  first: z.number().optional().describe('回傳筆數，預設 50'),
});

export const buildFilterFromParams = (params) => {
  const filter = {};

  if (params.country) {
    const val = params.country.trim();
    if (/^[A-Z]{3}$/i.test(val)) {
      // ISO3 code
      filter.ISO3 = { eq: val.toUpperCase() };
    } else if (/^[a-zA-Z\s]+$/.test(val)) {
      // English name
      filter.COUNTRY_COMM_EN = { contains: val };
    } else {
      // Chinese name
      filter.COUNTRY_COMM_ZH = { contains: val };
    }
  }
  if (params.area) {
    filter.AREA_NM = { contains: params.area };
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
    const RESOLVER = 'UNION_REF_COUNTRY_AREA';
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
          error: 'Country/area reference query failed',
          details: err.message,
        }),
      }],
      isError: true,
    };
  }
}
