import { handler } from './query-graphql.js';

async function run() {
  try {
    const res = await handler({
      resolver: 'UNION_REF_HSCODE',
      params: { first: 1, fields: ['HS_Code', 'HS_Code_ZH'] },
      variables: { demo: 123 }
    });

    console.log('HANDLER RESULT:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('ERROR running handler:', err);
  }
}

run();
