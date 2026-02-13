import { handler } from './query-graphql.js';

async function run() {
  try {
    const res = await handler({
      resolver: 'trade_monthly_by_group_country',
      params: {
        // filter: Fabric GraphQL 需要 { eq: value } 包裝
        filter: { YEAR: { eq: 2024 }, INDUSTRY: { eq: '自行車' }, TRADE_FLOW: { eq: '出口' } },
        // group by country ID + display name
        groupBy: ['COUNTRY_ID', 'COUNTRY_COMM_ZH'],
        // aggregate sum of trade value (USD)
        aggregations: [{ field: 'TRADE_VALUE_USD_AMT', function: 'sum' }],
        // 設較大 first 確保取得所有國家分組，再排序取 top 20
        first: 1000,
        fields: ['COUNTRY_ID', 'COUNTRY_COMM_ZH']
      },
      variables: {}
    });

    // 解析結果
    const payload = JSON.parse(res.content[0].text);

    if (res.isError) {
      console.error('查詢失敗:', payload);
      return;
    }

    const groups = payload.data.trade_monthly_by_group_countries.groupBy;

    // 依 sum(TRADE_VALUE_USD_AMT) 降序排列，取前 20 名
    const top20 = groups
      .map(g => ({
        INDUSTRY: '自行車',
        COUNTRY_ID: g.fields.COUNTRY_ID,
        COUNTRY_COMM_ZH: g.fields.COUNTRY_COMM_ZH,
        TRADE_VALUE_USD_AMT: g.aggregations.sum,
      }))
      .sort((a, b) => b.TRADE_VALUE_USD_AMT - a.TRADE_VALUE_USD_AMT)
      .slice(0, 20);

    // 印出表格
    console.log('INDUSTRY\tCOUNTRY_ID\tCOUNTRY_COMM_ZH\tTRADE_VALUE_USD_AMT');
    top20.forEach(r => {
      console.log(`${r.INDUSTRY}\t${r.COUNTRY_ID}\t${r.COUNTRY_COMM_ZH}\t${r.TRADE_VALUE_USD_AMT}`);
    });

  } catch (err) {
    console.error('ERROR:', err);
  }
}

run();
