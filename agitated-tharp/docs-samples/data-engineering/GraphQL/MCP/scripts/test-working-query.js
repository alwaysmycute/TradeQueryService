import { executeGraphQL } from '../src/utils/graphql-client.js';
import { config } from '../src/utils/config.js';

// Test with the working tool's resolver
const query = `query {
  trade_monthly_by_code_countries(first: 1) {
    items {
      PERIOD_MONTH
      YEAR
      MONTH
      TRADE_FLOW
      HS_CODE
      HS_CODE_ZH
      COUNTRY_ID
      COUNTRY_COMM_ZH
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
  console.log('WORKING QUERY (trade_monthly_by_code_countries):');
  if (result.errors) {
    console.log('ERROR:', result.errors);
  } else if (result.data) {
    console.log('SUCCESS! Got data:');
    console.log(JSON.stringify(result.data.trade_monthly_by_code_countries.items.slice(0, 1), null, 2));
  }
} catch (err) {
  console.error('EXCEPTION:', err.message);
}
