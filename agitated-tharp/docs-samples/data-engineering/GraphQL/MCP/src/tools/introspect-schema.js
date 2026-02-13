/**
 * Tool: introspect-schema
 *
 * 從 APIM GraphQL API 取得完整的 GraphQL Schema 定義。
 * 包含所有 types、queries、mutations、directives 等結構資訊。
 *
 * 此工具會自動使用快取機制：
 * - 首次調用時從 API 取得 schema 並快取到記憶體及本地檔案
 * - 後續調用優先使用快取，減少網路請求
 * - 快取 TTL 預設 24 小時，過期後自動重新取得
 * - 可透過 forceRefresh 參數強制重新取得
 */

import { z } from 'zod';
import { executeGraphQL } from '../utils/graphql-client.js';
import { getCachedSchema, setCachedSchema, getCacheStatus } from '../utils/schema-cache.js';
import { config } from '../utils/config.js';

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }
  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }
  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }
  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
`;

export const name = 'introspect-schema';

export const description =
  `取得 APIM GraphQL API 的完整 Schema 定義（含快取機制）。

功能說明：
- 回傳包含所有 types、queries、input types、enums 等完整的 GraphQL schema
- 自動使用本地快取，避免重複的大量網路請求（schema 約 110KB）
- 快取有效期內（預設 24 小時）會直接回傳快取內容

使用時機：
- 當需要了解 API 支援哪些查詢和資料結構時
- 當需要確認某個欄位的型別或可用的篩選條件時
- 通常在對話開始時調用一次即可

注意：此 schema 資料量較大，一般情況下不需要頻繁調用。
建議使用其他專用 tools 來執行實際的資料查詢。`;

export const parameters = z.object({
  forceRefresh: z.boolean()
    .optional()
    .describe('設為 true 時強制從 API 重新取得 schema，忽略快取。預設 false。'),
});

export async function handler({ forceRefresh }) {
  try {
    // 嘗試使用快取
    if (!forceRefresh) {
      const cached = await getCachedSchema({ ttlMs: config.schemaCacheTtlMs });
      if (cached) {
        const status = getCacheStatus();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              _source: 'cache',
              _cacheAge: status.memoryCacheAge,
              ...cached,
            }),
          }],
        };
      }
    }

    // 從 API 取得 schema
    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query: INTROSPECTION_QUERY,
    });

    // 儲存到快取
    await setCachedSchema(result);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ _source: 'api', ...result }),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'Schema introspection failed', details: err.message }),
      }],
      isError: true,
    };
  }
}
