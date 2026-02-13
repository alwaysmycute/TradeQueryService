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
 * 此表為參考資料表（Reference Data），資料量小、查詢速度快，
 * 適合用於：
 * - 查詢國家代碼與名稱的對照關係
 * - 了解國家的地區歸屬
 * - 作為其他貿易數據查詢的輔助參考
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_country_area_reference';

export const description =
  `查詢國家/地區參考資料 (UNION_REF_COUNTRY_AREA)。

用途：查詢台灣經貿數據使用的國家與地區對照表，包含 ISO3 代碼、中英文國名及地區歸屬。

可用欄位：
- ISO3: 國際標準三字母國家代碼（如 USA、JPN、CHN、DEU、KOR）
- COUNTRY_COMM_ZH: 國家中文通用名稱（如「美國」「日本」「中國大陸」）
- COUNTRY_COMM_EN: 國家英文名稱（如 "United States"、"Japan"）
- AREA_ID: 地區代碼（用於分組歸類）
- AREA_NM: 地區名稱（如「亞洲」「歐洲」「北美洲」「大洋洲」）
- ROW: 排序序號
- AREA_sort: 地區排序序號

支援的篩選操作：
- 字串欄位(ISO3, COUNTRY_COMM_ZH, COUNTRY_COMM_EN, AREA_ID, AREA_NM): eq, contains, startsWith, endsWith, neq, isNull, in
- 數值欄位(ROW, AREA_sort): eq, gt, gte, lt, lte, neq, isNull, in
- 複合條件: and, or

常見使用場景：
1. 查詢特定國家的資訊: filter: { ISO3: { eq: "USA" } }
2. 搜尋國家名稱: filter: { COUNTRY_COMM_ZH: { contains: "韓" } }
3. 查詢特定地區的所有國家: filter: { AREA_NM: { eq: "亞洲" } }
4. 列出所有地區分類: groupBy: ["AREA_NM"]`;

export const parameters = z.object({
  first: z.number().optional().describe(
    '回傳筆數上限。預設 100，最大 5000。'
  ),
  after: z.string().optional().describe(
    '分頁游標。使用前次查詢回傳的 endCursor 值來取得下一頁資料。'
  ),
  filter: z.object({
    ISO3: z.any().optional().describe('ISO3 國家代碼篩選（字串篩選: eq/contains/in）例: { eq: "USA" } 或 { in: ["USA","JPN","KOR"] }'),
    COUNTRY_COMM_ZH: z.any().optional().describe('國家中文名稱篩選（字串篩選: eq/contains）例: { contains: "日本" }'),
    COUNTRY_COMM_EN: z.any().optional().describe('國家英文名稱篩選（字串篩選）'),
    AREA_ID: z.any().optional().describe('地區代碼篩選（字串篩選）'),
    AREA_NM: z.any().optional().describe('地區名稱篩選（字串篩選）例: { eq: "亞洲" }'),
    ROW: z.any().optional().describe('排序序號篩選（數值篩選: eq/gt/gte/lt/lte）'),
    AREA_sort: z.any().optional().describe('地區排序序號篩選（數值篩選）'),
    and: z.any().optional().describe('AND 複合條件'),
    or: z.any().optional().describe('OR 複合條件'),
  }).optional().describe(
    '篩選條件。'
  ),
  orderBy: z.record(z.enum(['ASC', 'DESC'])).optional().describe(
    '排序條件。例: { "AREA_NM": "ASC", "COUNTRY_COMM_ZH": "ASC" }'
  ),
  fields: z.array(z.string()).optional().describe(
    '指定回傳欄位。預設回傳所有欄位。例: ["ISO3", "COUNTRY_COMM_ZH", "AREA_NM"]'
  ),
  groupBy: z.array(z.string()).optional().describe(
    '分組欄位。例: ["AREA_NM"] 可統計每個地區有多少國家。'
  ),
  aggregations: z.array(z.object({
    field: z.string().describe('聚合欄位（數值欄位: ROW, AREA_sort）'),
    function: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('聚合函數'),
  })).optional().describe(
    '聚合操作。需搭配 groupBy 使用。'
  ),
});

export async function handler(params) {
  try {
    const first = Math.min(params.first || config.defaultPageSize, config.maxPageSize);
    const { query } = buildQuery('UNION_REF_COUNTRY_AREA', {
      ...params,
      first,
    });

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
        text: JSON.stringify({ error: 'Country/area reference query failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
