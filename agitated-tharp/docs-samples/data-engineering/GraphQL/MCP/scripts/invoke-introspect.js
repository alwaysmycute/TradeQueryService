import { handler } from '../src/tools/introspect-schema.js';

async function run() {
  try {
    const res = await handler({ forceRefresh: true });
    console.log('INTROSPECT RESULT:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('ERROR INVOKING INTROSPECT:', err);
  }
}

run();
