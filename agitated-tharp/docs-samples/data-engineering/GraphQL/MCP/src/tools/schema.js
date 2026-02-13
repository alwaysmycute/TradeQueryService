/**
 * 預定義的 UNION_REF_COUNTRY_AREA GraphQL Schema
 *
 * 直接定義查詢的 schema，不再依賴 introspect-schema 預載。
 *
 * 重要：APIM resolver 使用 http-data-source 政策，
 * 會以自己預定義的 query 模板替換客戶端的 query，
 * 但會保留客戶端傳送的 variables。
 *
 * 因此：
 * - query 字串必須與 APIM resolver 預定義的格式一致
 * - 所有參數都透過 variables 傳遞
 * - groupBy 不在 resolver 預定義的 query 中，此端點不支援 groupBy
 */

// ── 欄位定義 ──────────────────────────────────────────────

export const FIELDS = {
  ISO3:             { type: 'String',  description: 'ISO3 國際標準三字母國家代碼（如 USA、JPN、CHN）' },
  COUNTRY_COMM_ZH:  { type: 'String',  description: '國家中文通用名稱（如「美國」「日本」）' },
  COUNTRY_COMM_EN:  { type: 'String',  description: '國家英文名稱（如 "United States"）' },
  AREA_ID:          { type: 'String',  description: '地區代碼（如 ASIA、EUROPE、NAMERICA）' },
  AREA_NM:          { type: 'String',  description: '地區名稱（如「東北亞」「東南亞」「歐洲」「北美洲」）' },
  ROW:              { type: 'Int',     description: '排序序號' },
  AREA_sort:        { type: 'Int',     description: '地區排序序號' },
};

export const ALL_FIELD_NAMES = Object.keys(FIELDS);

export const STRING_FIELDS = Object.entries(FIELDS)
  .filter(([, v]) => v.type === 'String')
  .map(([k]) => k);

export const NUMERIC_FIELDS = Object.entries(FIELDS)
  .filter(([, v]) => v.type === 'Int')
  .map(([k]) => k);

// ── 篩選操作定義 ──────────────────────────────────────────

export const STRING_FILTER_OPS = ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'isNull', 'in'];
export const NUMERIC_FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'in'];
export const COMPOUND_OPS = ['and', 'or'];

// ── 預定義 GraphQL Query ─────────────────────────────────
// 此 query 格式必須與 APIM resolver 的 http-data-source set-body 一致。
// APIM 會使用客戶端的 variables，但 query 由 resolver 自行定義。

export const PREDEFINED_QUERY = `
  query (
    $first: Int
    $after: String
    $filter: UNION_REF_COUNTRY_AREAFilterInput
    $orderBy: UNION_REF_COUNTRY_AREAOrderByInput
  ) {
    uNION_REF_COUNTRY_AREAs(
      first: $first
      after: $after
      filter: $filter
      orderBy: $orderBy
    ) {
      items {
        ISO3
        COUNTRY_COMM_ZH
        COUNTRY_COMM_EN
        AREA_ID
        AREA_NM
        ROW
        AREA_sort
      }
      endCursor
      hasNextPage
    }
  }
`;
