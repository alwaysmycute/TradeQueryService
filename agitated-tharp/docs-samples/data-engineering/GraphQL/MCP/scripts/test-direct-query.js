import { executeGraphQL } from '../src/utils/graphql-client.js';
import { config } from '../src/utils/config.js';

const query = `query {
  trade_monthly_by_group_countries(first: 1) {
    items {
      PERIOD_MONTH
      YEAR
      MONTH
      TRADE_FLOW
      INDUSTRY_ID
      INDUSTRY
      HS_CODE_GROUP
      COUNTRY_ID
      COUNTRY_COMM_ZH
      AREA_ID
      AREA_NM
      TRADE_VALUE_USD_AMT
      TRADE_VALUE_TWD_AMT
      TRADE_WEIGHT
      TRADE_QUANT
      UNIT_PRICE_USD_PER_KG
      ETL_DT
    }
    endCursor
    hasNextPage
  }
}`;

try {
  const result = await executeGraphQL({
    endpoint: config.graphqlEndpoint,
    subscriptionKey: config.subscriptionKey,
    query,
  });
  console.log('RESULT:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
}
