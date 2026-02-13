import { handler } from '../src/tools/introspect-schema.js';

async function run() {
  try {
    const res = await handler({ forceRefresh: true });
    console.log('RAW RES:', JSON.stringify(res, null, 2));
    const payload = JSON.parse(res.content[0].text);
    console.log('PARSED PAYLOAD KEYS:', Object.keys(payload));
    const schema = payload.__schema || payload.data && payload.data.__schema || payload.schema || payload;
    if (!schema || !schema.__schema) {
      // try nested keys
      const maybe = payload.__schema || payload.data || payload.schema;
      if (maybe && maybe.__schema) {
        console.log('Nested schema found');
      }
    }
    const types = (payload.__schema && payload.__schema.types) || (payload.data && payload.data.__schema && payload.data.__schema.types) || payload.types || [];
    const target = types.find(t => t.name === 'trade_monthly_by_group_countryFilterInput');
    if (!target) {
      console.error('Filter input type not found; available type names sample:', types.slice(0,10).map(t=>t.name));
      return;
    }
    console.log('Found type:', target.name);
    console.log(JSON.stringify(target.inputFields, null, 2));
  } catch (err) {
    console.error('ERROR:', err);
  }
}

run();
