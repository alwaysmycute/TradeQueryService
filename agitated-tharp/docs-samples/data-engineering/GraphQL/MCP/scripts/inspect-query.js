import { buildQuery } from '../src/utils/query-builder.js';

const params = {
  filter: { and: [{ YEAR: { eq: 2024 } }, { TRADE_FLOW: { eq: '1' } }] },
  first: 1,
};

try {
  const { query, variables } = buildQuery('trade_monthly_by_group_country', params);
  console.log('===== GENERATED GraphQL QUERY =====');
  console.log(query);
  console.log('\n===== VARIABLES =====');
  console.log(JSON.stringify(variables, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
}
