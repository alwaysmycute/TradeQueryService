/**
 * Tool: query_hscode_reference
 *
 * 查詢 HS Code 參考資料表 (UNION_REF_HSCODE)。
 *
 * HS Code（國際商品統一分類制度）是國際貿易中用於分類商品的標準編碼系統。
 * 此表包含台灣經貿數據使用的 HS Code 對照資料。
 *
 * 此表為參考資料表（Reference Data），資料量相對小、查詢速度快，
 * 適合作為查詢其他貿易數據前的前置查詢。
 *
 * ⚠️ Important:
 * - 使用簡化參數介面，不直接傳入 GraphQL filter/orderBy
 * - 只透過 buildQuery 傳入 filter/orderBy/first，不傳 fields/groupBy/aggregations
 */
console.log('🔥 loading query_hscode_reference tool');

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

export const name = 'query_hscode_reference';

export const description =
  `查詢 HS Code 參考資料 (UNION_REF_HSCODE)。

用途：查詢台灣經貿數據中使用的 HS Code（國際商品統一分類代碼）對照表。
此表包含產業分類、HS Code 編碼、中文品名、計量單位等參考資訊。
資料量小、查詢速度快，適合作為前置查詢。

可用欄位：
- Report_ID: 報告編號
- Industry_ID: 產業編號（數值型）
- Industry: 產業名稱（中文，如「電子零組件」「機械」「塑膠及其製品」）
- HS_Code_Group: HS Code 群組（通常為 2-4 碼的前綴分類）
- HS_Code: 完整 HS Code（6-11 碼的貨品分類代碼）
- HS_Code_ZH: HS Code 中文品名說明
- Unit_Name: 計量單位名稱（如「公斤」「公噸」「個」）
- Unit: 計量單位代碼

常見使用場景：
1. 查詢特定產業的所有 HS Code:
   industryKeyword: "電子"
2. 查詢特定 HS Code 的品名:
   hsCode: "847130"
3. 模糊搜尋品名:
   productKeyword: "半導體"
4. 用 HS Code 前綴查群組:
   hsCode: "85"`;

export const parameters = z.object({
  industryKeyword: z.string().optional().describe('產業名稱關鍵字，例如 "電子"、"機械"、"紡織"'),
  hsCode: z.string().optional().describe('HS Code 或前綴，例如 "847130" 精確查詢、"85" 前綴查詢'),
  productKeyword: z.string().optional().describe('中文品名關鍵字，例如 "半導體"、"積體電路"'),
  first: z.number().optional().describe('回傳筆數，預設 50'),
});

export const buildFilterFromParams = (params) => {
  const filter = {};

  if (params.industryKeyword) {
    filter.Industry = { contains: params.industryKeyword };
  }
  if (params.hsCode) {
    const code = params.hsCode.trim();
    if (code.length >= 6) {
      filter.HS_Code = { eq: code };
    } else {
      filter.HS_Code = { startsWith: code };
    }
  }
  if (params.productKeyword) {
    filter.HS_Code_ZH = { contains: params.productKeyword };
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
};

export const execute = async (params) => {
  const filter = buildFilterFromParams(params);
  const normalizedParams = {
    filter,
    first: Math.min(params.first ?? 50, config.maxPageSize),
  };

  try {
    const RESOLVER = 'UNION_REF_HSCODE';
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
        text: JSON.stringify({ error: 'HS Code reference query failed', details: err.message }),
      }],
      isError: true,
    };
  }
};

export async function handler(params) {
  return execute(params);
}
