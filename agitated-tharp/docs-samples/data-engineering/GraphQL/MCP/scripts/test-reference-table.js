import { executeGraphQL } from '../src/utils/graphql-client.js';
import { config } from '../src/utils/config.js';

// Test with a simpler reference table
const query = `query {
  uNION_REF_HSCODEs(first: 1) {
    items {
      Report_ID
      Industry_ID
      Industry
      HS_Code_Group
      HS_Code
      HS_Code_ZH
      Unit_Name
      Unit
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
  console.log('REFERENCE TABLE QUERY (uNION_REF_HSCODEs):');
  if (result.errors) {
    console.log('ERROR:', JSON.stringify(result.errors, null, 2));
  } else if (result.data && result.data.uNION_REF_HSCODEs) {
    console.log('SUCCESS! Got data:');
    console.log(JSON.stringify(result.data.uNION_REF_HSCODEs.items.slice(0, 1), null, 2));
  } else {
    console.log('RESPONSE:', JSON.stringify(result, null, 2));
  }
} catch (err) {
  console.error('EXCEPTION:', err.message);
}
