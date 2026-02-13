import { buildQuery } from '../src/utils/query-builder.js';

const params = {
  first: 1,
  // no filter
};

try {
  const { query, variables } = buildQuery('trade_monthly_by_group_country', params);
  console.log('===== SIMPLE QUERY (NO FILTER) =====');
  console.log(query);
  console.log('\n===== VARIABLES =====');
  console.log(JSON.stringify(variables, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
}
