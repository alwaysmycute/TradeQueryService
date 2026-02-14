/**
 * GraphQL Query Builder Utility
 *
 * 將結構化的工具參數轉換為 GraphQL 查詢字串。
 * 此模組為所有 resolver-specific tools 的核心建構器，
 * 確保產生的查詢符合 APIM GraphQL API 的格式要求。
 *
 * 設計考量：
 * - 支援 pagination (first, after)
 * - 支援 filter (各欄位的篩選條件)
 * - 支援 orderBy (排序)
 * - 支援 groupBy + aggregations (分組聚合)
 * - 擴充彈性：新增 resolver 時只需定義欄位與名稱映射
 */

/**
 * Resolver 設定註冊表
 *
 * 每個 resolver 的設定包含：
 * - queryName: GraphQL query 中的欄位名稱
 * - connectionType: Connection type 名稱
 * - fields: 可查詢的欄位列表
 * - numericFields: 可做數值聚合的欄位列表
 * - filterInputType: Filter input type 名稱
 * - orderByInputType: OrderBy input type 名稱
 *
 * 新增 resolver 時，只需在此註冊表中新增一筆設定即可。
 */
export const RESOLVER_REGISTRY = {
  UNION_REF_HSCODE: {
    queryName: 'uNION_REF_HSCODEs',
    fields: ['Report_ID', 'Industry_ID', 'Industry', 'HS_Code_Group', 'HS_Code', 'HS_Code_ZH', 'Unit_Name', 'Unit'],
    numericFields: ['Industry_ID'],
    scalarFieldsEnum: 'UNION_REF_HSCODEScalarFields',
    numericAggregateEnum: 'UNION_REF_HSCODENumericAggregateFields',
    filterInputType: 'UNION_REF_HSCODEFilterInput',
    orderByInputType: 'UNION_REF_HSCODEOrderByInput',
    description: 'HS Code 參考資料表 - 包含產業分類、HS Code 對照、中文品名等',
  },
  trade_monthly_by_code_country: {
    queryName: 'trade_monthly_by_code_countries',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'HS_CODE', 'HS_CODE_ZH', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'MONTH', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_monthly_by_code_countryScalarFields',
    numericAggregateEnum: 'trade_monthly_by_code_countryNumericAggregateFields',
    filterInputType: 'trade_monthly_by_code_countryFilterInput',
    orderByInputType: 'trade_monthly_by_code_countryOrderByInput',
    description: '按 HS Code 與國家的月度貿易統計 - 細到單一貨品代碼層級',
  },
  trade_monthly_by_group_country: {
    queryName: 'trade_monthly_by_group_countries',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'AREA_ID', 'AREA_NM', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'MONTH', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_monthly_by_group_countryScalarFields',
    numericAggregateEnum: 'trade_monthly_by_group_countryNumericAggregateFields',
    filterInputType: 'trade_monthly_by_group_countryFilterInput',
    orderByInputType: 'trade_monthly_by_group_countryOrderByInput',
    description: '按產業群組與國家的月度貿易統計 - 含產業分類與地區歸屬',
  },
  UNION_REF_COUNTRY_AREA: {
    queryName: 'uNION_REF_COUNTRY_AREAs',
    fields: ['ISO3', 'COUNTRY_COMM_ZH', 'COUNTRY_COMM_EN', 'AREA_ID', 'AREA_NM', 'ROW', 'AREA_sort'],
    numericFields: ['ROW', 'AREA_sort'],
    scalarFieldsEnum: 'UNION_REF_COUNTRY_AREAScalarFields',
    numericAggregateEnum: 'UNION_REF_COUNTRY_AREANumericAggregateFields',
    filterInputType: 'UNION_REF_COUNTRY_AREAFilterInput',
    orderByInputType: 'UNION_REF_COUNTRY_AREAOrderByInput',
    description: '國家/地區參考資料表 - 包含 ISO3 代碼、中英文國名、所屬地區',
  },
  trade_yearly_total: {
    queryName: 'trade_yearly_totals',
    fields: ['YEAR', 'TRADE_FLOW', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_yearly_totalScalarFields',
    numericAggregateEnum: 'trade_yearly_totalNumericAggregateFields',
    filterInputType: 'trade_yearly_totalFilterInput',
    orderByInputType: 'trade_yearly_totalOrderByInput',
    description: '按產業群組的年度貿易總計 - 不含國家維度，適合年度趨勢分析',
  },
  trade_monthly_total: {
    queryName: 'trade_monthly_totals',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'MONTH', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_monthly_totalScalarFields',
    numericAggregateEnum: 'trade_monthly_totalNumericAggregateFields',
    filterInputType: 'trade_monthly_totalFilterInput',
    orderByInputType: 'trade_monthly_totalOrderByInput',
    description: '按產業群組的月度貿易總計 - 不含國家維度，適合月度趨勢分析',
  },
  trade_monthly_by_country: {
    queryName: 'trade_monthly_by_countries',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'AREA_ID', 'AREA_NM', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'MONTH', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_monthly_by_countryScalarFields',
    numericAggregateEnum: 'trade_monthly_by_countryNumericAggregateFields',
    filterInputType: 'trade_monthly_by_countryFilterInput',
    orderByInputType: 'trade_monthly_by_countryOrderByInput',
    description: '按國家的月度貿易統計 - 含地區歸屬，適合月度國別分析',
  },
  trade_yearly_by_country: {
    queryName: 'trade_yearly_by_countries',
    fields: ['YEAR', 'TRADE_FLOW', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'AREA_ID', 'AREA_NM', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TRADE_VALUE_TWD_AMT', 'TRADE_WEIGHT', 'TRADE_QUANT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_yearly_by_countryScalarFields',
    numericAggregateEnum: 'trade_yearly_by_countryNumericAggregateFields',
    filterInputType: 'trade_yearly_by_countryFilterInput',
    orderByInputType: 'trade_yearly_by_countryOrderByInput',
    description: '按國家的年度貿易統計 - 含地區歸屬，適合年度國別分析',
  },
  trade_monthly_growth_total: {
    queryName: 'trade_monthly_growth_totals',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'TRADE_VALUE_USD_AMT', 'TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'PREV_YEAR_TRADE_VALUE_USD_AMT', 'YOY_DELTA_TRADE_VALUE_USD_AMT', 'YOY_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_MONTH_TRADE_VALUE_USD_AMT', 'MOM_DELTA_TRADE_VALUE_USD_AMT', 'MOM_GROWTH_RATE_TRADE_VALUE_USD', 'ETL_DT', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP'],
    numericFields: ['YEAR', 'MONTH', 'TRADE_VALUE_USD_AMT', 'TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'PREV_YEAR_TRADE_VALUE_USD_AMT', 'YOY_DELTA_TRADE_VALUE_USD_AMT', 'YOY_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_MONTH_TRADE_VALUE_USD_AMT', 'MOM_DELTA_TRADE_VALUE_USD_AMT', 'MOM_GROWTH_RATE_TRADE_VALUE_USD', 'INDUSTRY_ID'],
    scalarFieldsEnum: 'trade_monthly_growth_totalScalarFields',
    numericAggregateEnum: 'trade_monthly_growth_totalNumericAggregateFields',
    filterInputType: 'trade_monthly_growth_totalFilterInput',
    orderByInputType: 'trade_monthly_growth_totalOrderByInput',
    description: '月度貿易成長率（總體） - 含同比/環比成長率',
  },
  trade_yearly_growth_total: {
    queryName: 'trade_yearly_growth_totals',
    fields: ['YEAR', 'TRADE_FLOW', 'TRADE_VALUE_USD_AMT', 'TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'PREV_YEAR_TRADE_VALUE_USD_AMT', 'YOY_DELTA_TRADE_VALUE_USD_AMT', 'YOY_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_YEAR_TRADE_WEIGHT', 'YOY_DELTA_TRADE_WEIGHT', 'YOY_GROWTH_RATE_TRADE_WEIGHT', 'PREV_YEAR_UNIT_PRICE_USD_PER_KG', 'YOY_DELTA_UNIT_PRICE_USD_PER_KG', 'YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG', 'ETL_DT', 'INDUSTRY_ID', 'INDUSTRY'],
    numericFields: ['YEAR', 'TRADE_VALUE_USD_AMT', 'TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'PREV_YEAR_TRADE_VALUE_USD_AMT', 'YOY_DELTA_TRADE_VALUE_USD_AMT', 'YOY_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_YEAR_TRADE_WEIGHT', 'YOY_DELTA_TRADE_WEIGHT', 'YOY_GROWTH_RATE_TRADE_WEIGHT', 'PREV_YEAR_UNIT_PRICE_USD_PER_KG', 'YOY_DELTA_UNIT_PRICE_USD_PER_KG', 'YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG', 'INDUSTRY_ID'],
    scalarFieldsEnum: 'trade_yearly_growth_totalScalarFields',
    numericAggregateEnum: 'trade_yearly_growth_totalNumericAggregateFields',
    filterInputType: 'trade_yearly_growth_totalFilterInput',
    orderByInputType: 'trade_yearly_growth_totalOrderByInput',
    description: '年度貿易成長率（總體） - 含金額/重量/單價同比成長率',
  },
  trade_monthly_growth_by_country: {
    queryName: 'trade_monthly_growth_by_countries',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'AREA_ID', 'AREA_NM', 'TRADE_VALUE_USD_AMT', 'TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'PREV_YEAR_TRADE_VALUE_USD_AMT', 'YOY_DELTA_TRADE_VALUE_USD_AMT', 'YOY_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_YEAR_TRADE_WEIGHT', 'YOY_DELTA_TRADE_WEIGHT', 'YOY_GROWTH_RATE_TRADE_WEIGHT', 'PREV_YEAR_UNIT_PRICE_USD_PER_KG', 'YOY_DELTA_UNIT_PRICE_USD_PER_KG', 'YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG', 'PREV_MONTH_TRADE_VALUE_USD_AMT', 'MOM_DELTA_TRADE_VALUE_USD_AMT', 'MOM_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_MONTH_TRADE_WEIGHT', 'MOM_DELTA_TRADE_WEIGHT', 'MOM_GROWTH_RATE_TRADE_WEIGHT', 'PREV_MONTH_UNIT_PRICE_USD_PER_KG', 'MOM_DELTA_UNIT_PRICE_USD_PER_KG', 'MOM_GROWTH_RATE_UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'MONTH', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'PREV_YEAR_TRADE_VALUE_USD_AMT', 'YOY_DELTA_TRADE_VALUE_USD_AMT', 'YOY_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_YEAR_TRADE_WEIGHT', 'YOY_DELTA_TRADE_WEIGHT', 'YOY_GROWTH_RATE_TRADE_WEIGHT', 'PREV_YEAR_UNIT_PRICE_USD_PER_KG', 'YOY_DELTA_UNIT_PRICE_USD_PER_KG', 'YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG', 'PREV_MONTH_TRADE_VALUE_USD_AMT', 'MOM_DELTA_TRADE_VALUE_USD_AMT', 'MOM_GROWTH_RATE_TRADE_VALUE_USD', 'PREV_MONTH_TRADE_WEIGHT', 'MOM_DELTA_TRADE_WEIGHT', 'MOM_GROWTH_RATE_TRADE_WEIGHT', 'PREV_MONTH_UNIT_PRICE_USD_PER_KG', 'MOM_DELTA_UNIT_PRICE_USD_PER_KG', 'MOM_GROWTH_RATE_UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_monthly_growth_by_countryScalarFields',
    numericAggregateEnum: 'trade_monthly_growth_by_countryNumericAggregateFields',
    filterInputType: 'trade_monthly_growth_by_countryFilterInput',
    orderByInputType: 'trade_monthly_growth_by_countryOrderByInput',
    description: '各國月度貿易成長率 - 含同比/環比，金額/重量/單價三維度',
  },
  trade_monthly_share_by_country: {
    queryName: 'trade_monthly_share_by_countries',
    fields: ['PERIOD_MONTH', 'YEAR', 'MONTH', 'TRADE_FLOW', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'AREA_ID', 'AREA_NM', 'TRADE_VALUE_USD_AMT', 'TOTAL_TRADE_VALUE_USD_AMT', 'SHARE_RATIO_TRADE_VALUE_USD', 'TRADE_WEIGHT', 'TOTAL_TRADE_WEIGHT', 'SHARE_RATIO_TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT'],
    numericFields: ['YEAR', 'MONTH', 'INDUSTRY_ID', 'TRADE_VALUE_USD_AMT', 'TOTAL_TRADE_VALUE_USD_AMT', 'SHARE_RATIO_TRADE_VALUE_USD', 'TRADE_WEIGHT', 'TOTAL_TRADE_WEIGHT', 'SHARE_RATIO_TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG'],
    scalarFieldsEnum: 'trade_monthly_share_by_countryScalarFields',
    numericAggregateEnum: 'trade_monthly_share_by_countryNumericAggregateFields',
    filterInputType: 'trade_monthly_share_by_countryFilterInput',
    orderByInputType: 'trade_monthly_share_by_countryOrderByInput',
    description: '各國月度貿易市佔率 - 含金額佔比與重量佔比',
  },
  trade_yearly_share_by_country: {
    queryName: 'trade_yearly_share_by_countries',
    fields: ['YEAR', 'TRADE_FLOW', 'COUNTRY_ID', 'COUNTRY_COMM_ZH', 'AREA_ID', 'AREA_NM', 'TRADE_VALUE_USD_AMT', 'TOTAL_TRADE_VALUE_USD_AMT', 'SHARE_RATIO_TRADE_VALUE_USD', 'TRADE_WEIGHT', 'TOTAL_TRADE_WEIGHT', 'SHARE_RATIO_TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'ETL_DT', 'INDUSTRY_ID', 'INDUSTRY', 'HS_CODE_GROUP'],
    numericFields: ['YEAR', 'TRADE_VALUE_USD_AMT', 'TOTAL_TRADE_VALUE_USD_AMT', 'SHARE_RATIO_TRADE_VALUE_USD', 'TRADE_WEIGHT', 'TOTAL_TRADE_WEIGHT', 'SHARE_RATIO_TRADE_WEIGHT', 'UNIT_PRICE_USD_PER_KG', 'INDUSTRY_ID'],
    scalarFieldsEnum: 'trade_yearly_share_by_countryScalarFields',
    numericAggregateEnum: 'trade_yearly_share_by_countryNumericAggregateFields',
    filterInputType: 'trade_yearly_share_by_countryFilterInput',
    orderByInputType: 'trade_yearly_share_by_countryOrderByInput',
    description: '各國年度貿易市佔率 - 含金額佔比與重量佔比',
  },
  TXN_MOF_NON_PROTECT_MT: {
    queryName: 'tXN_MOF_NON_PROTECT_MTs',
    fields: ['TXN_DT', 'HS_CODE', 'HS_CODE_ZH', 'HS_CODE_EN', 'COUNTRY_ID', 'COUNTRY_ZH', 'COUNTRY_EN', 'COUNTRY_COMM_ZH', 'COUNTRY_COMM_EN', 'TRADE_FLOW', 'TRADE_VALUE_TWD_AMT', 'TRADE_QUANT', 'TRADE_WEIGHT_ORG', 'TRADE_WEIGHT', 'RATE_VALUE', 'TRADE_VALUE_USD_AMT', 'ETL_DT'],
    numericFields: ['TRADE_VALUE_TWD_AMT', 'TRADE_QUANT', 'TRADE_WEIGHT_ORG', 'TRADE_WEIGHT', 'RATE_VALUE', 'TRADE_VALUE_USD_AMT'],
    scalarFieldsEnum: 'TXN_MOF_NON_PROTECT_MTScalarFields',
    numericAggregateEnum: 'TXN_MOF_NON_PROTECT_MTNumericAggregateFields',
    filterInputType: 'TXN_MOF_NON_PROTECT_MTFilterInput',
    orderByInputType: 'TXN_MOF_NON_PROTECT_MTOrderByInput',
    description: '完整交易明細資料表 - 包含每筆進出口交易的完整資訊(資料量大，查詢較慢)',
  },
};

/**
 * GraphQL enum values — 在 query 中不加引號
 */
const GRAPHQL_ENUMS = new Set(['ASC', 'DESC']);

/**
 * 將 JavaScript 值轉換為 GraphQL inline literal 格式
 *
 * 用於 groupBy enum fields 等無法使用 variable definitions 的場景。
 *
 * 轉換規則：
 * - number/boolean → 直接輸出 (2024, true)
 * - string (enum)  → 不加引號 (ASC, DESC)
 * - string (一般)  → 加引號 ("出口", "US")
 * - array          → [item1, item2]
 * - object         → { key1: val1, key2: val2 } (key 不加引號)
 * - null/undefined → null
 *
 * @param {any} value - 要轉換的值
 * @returns {string} GraphQL literal 字串
 */
export function toGraphQLLiteral(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    if (GRAPHQL_ENUMS.has(value)) return value;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => toGraphQLLiteral(v)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => `${k}: ${toGraphQLLiteral(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return String(value);
}

/**
 * 建構 GraphQL 查詢字串（inline arguments 模式）
 *
 * APIM 使用 pass-through resolver policy，將 client 的 query 直接轉發到 Fabric backend。
 * 因此所有參數必須以 inline literal 嵌入 query string。
 * APIM GraphQL parser 不支援 $variable definitions（會產生 parse error）。
 *
 * @param {string} resolverKey - RESOLVER_REGISTRY 中的 key
 * @param {Object} params - 查詢參數
 * @param {number} [params.first] - 分頁筆數限制
 * @param {string} [params.after] - 分頁游標
 * @param {Object} [params.filter] - 篩選條件物件
 * @param {Object} [params.orderBy] - 排序條件物件
 * @param {string[]} [params.fields] - 指定回傳欄位 (預設回傳所有欄位)
 * @param {string[]} [params.groupBy] - 分組欄位列表
 * @param {Array} [params.aggregations] - 聚合操作列表 [{field, function}]
 * @returns {Object} { query: string, variables: Object }
 */
export function buildQuery(resolverKey, params = {}) {
  const config = RESOLVER_REGISTRY[resolverKey];
  if (!config) {
    throw new Error(`Unknown resolver: ${resolverKey}. Available resolvers: ${Object.keys(RESOLVER_REGISTRY).join(', ')}`);
  }

  const { first, after, filter, orderBy, fields, groupBy, aggregations } = params;

  // 建構 inline arguments
  const queryArgs = [];

  if (first !== undefined && first !== null) {
    queryArgs.push(`first: ${toGraphQLLiteral(first)}`);
  }

  if (after !== undefined && after !== null) {
    queryArgs.push(`after: ${toGraphQLLiteral(after)}`);
  }

  if (filter && Object.keys(filter).length > 0) {
    queryArgs.push(`filter: ${toGraphQLLiteral(filter)}`);
  }

  if (orderBy && Object.keys(orderBy).length > 0) {
    queryArgs.push(`orderBy: ${toGraphQLLiteral(orderBy)}`);
  }

  // 決定回傳欄位
  const selectedFields = fields && fields.length > 0
    ? fields.filter(f => config.fields.includes(f))
    : config.fields;

  // 建構 items 部分
  const itemsBlock = selectedFields.join('\n          ');

  // 建構 groupBy 部分
  let groupByBlock = '';
  if (groupBy && groupBy.length > 0) {
    const groupByFields = groupBy.filter(f => config.fields.includes(f));
    const aggBlock = buildAggregationBlock(aggregations, config.numericFields);

    groupByBlock = `
      groupBy(fields: [${groupByFields.join(', ')}]) {
        fields {
          ${groupByFields.join('\n          ')}
        }
        ${aggBlock}
      }`;
  }

  // 組合完整查詢（無 variable definitions，APIM 不支援）
  const argsStr = queryArgs.length > 0 ? `(${queryArgs.join(', ')})` : '';

  const query = `query {
    ${config.queryName}${argsStr} {
      items {
        ${itemsBlock}
      }
      endCursor
      hasNextPage${groupByBlock}
    }
  }`;

  console.log('[buildQuery] resolver:', config.queryName);
  console.log('[buildQuery] inline args:', argsStr);

  return { query };
}

/**
 * 建構聚合操作區塊
 *
 * 聚合函數支援: sum, avg, min, max, count
 * 每個聚合函數接受以下參數：
 * - field: NumericAggregateFields enum（指定要聚合的數值欄位）
 * - having: DecimalFilterInput（可選，對聚合結果進行過濾）
 * - distinct: Boolean（可選，是否只計算不同值）
 *
 * @param {Array} aggregations - [{field, function}] 聚合操作列表
 * @param {string[]} numericFields - 可聚合的數值欄位
 * @returns {string} GraphQL aggregation block
 */
function buildAggregationBlock(aggregations, numericFields) {
  if (!aggregations || aggregations.length === 0) {
    // 預設只取 count（不帶 field 參數時回傳總筆數）
    return `aggregations {
          count
        }`;
  }

  const aggParts = aggregations.map(agg => {
    const fn = agg.function || 'sum';
    const field = agg.field;

    if (field && numericFields.includes(field)) {
      return `${fn}(field: ${field})`;
    }

    // 無指定欄位或欄位不是數值型，使用不帶參數的 count
    return `count`;
  });

  // 去重
  const unique = [...new Set(aggParts)];

  return `aggregations {
          ${unique.join('\n          ')}
        }`;
}

/**
 * 取得所有已註冊的 resolver 資訊
 * @returns {Object[]} resolver 列表
 */
export function getRegisteredResolvers() {
  return Object.entries(RESOLVER_REGISTRY).map(([key, config]) => ({
    key,
    queryName: config.queryName,
    fields: config.fields,
    numericFields: config.numericFields,
    description: config.description,
  }));
}
