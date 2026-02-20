/**
 * Tool: query-graphql
 *
 * 通用 GraphQL 查詢工具，允許直接執行任意 GraphQL 查詢。
 * 這是最靈活但也最需要 GraphQL 知識的工具。
 *
 * 使用時機：
 * - 當其他專用 tools 無法滿足特定查詢需求時
 * - 需要執行複雜的巢狀查詢或組合多個 resolver 時
 * - 需要使用 mutation 操作時
 *
 * 建議：優先使用專用的 resolver tools（如 query_trade_monthly_by_code、
 * query_hscode_reference 等），因為它們提供了結構化參數和內建驗證，
 * 更不容易出錯。
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { config } from '../utils/config.js';

export const name = 'query-graphql';

export const description =
  `執行自訂的 GraphQL 查詢（通用工具，適用於其他專用 tools 無法滿足的場景）。

功能說明：
- 直接對 APIM GraphQL API 執行任意 GraphQL query 或 mutation
- 支援 GraphQL variables 傳遞
- 回傳完整的 GraphQL response（含 data 與可能的 errors）

可用的 Query 端點（Resolvers）：
1. uNION_REF_HSCODEs - HS Code 參考資料（產業分類、貨品代碼、中文品名）
2. trade_monthly_by_code_countries - 按 HS Code 與國家的月度貿易統計
3. trade_monthly_by_group_countries - 按產業群組與國家的月度貿易統計
4. uNION_REF_COUNTRY_AREAs - 國家/地區參考資料（ISO3 代碼、中英文國名）
5. tXN_MOF_NON_PROTECT_MTs - 完整交易明細（資料量大，查詢慢，非必要勿用）

所有查詢都支援：
- 分頁: first (筆數), after (游標)
- 篩選: filter (依欄位條件過濾)
- 排序: orderBy (依欄位排序)
- 回傳: items (資料), endCursor (下頁游標), hasNextPage (是否有下頁)
- 分組聚合: groupBy (分組統計)

注意：建議優先使用其他專用 tools，它們提供結構化參數更易於使用。`;

export const parameters = z.object({
  query: z.string().describe(
    'GraphQL 查詢字串。必須是有效的 GraphQL query 或 mutation 語法。'
  ),
  variables: z.record(z.any()).optional().describe(
    'GraphQL 查詢變數（JSON 物件）。用於參數化查詢，避免字串拼接。'
  ),
});

export async function handler({ query, variables }) {
  try {
    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query,
      variables: variables || {},
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
        text: JSON.stringify({ error: 'GraphQL query failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
