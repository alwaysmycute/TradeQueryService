import { handler } from '../src/tools/query-trade-monthly-by-group.js';

async function run() {
  try {
    const res = await handler({ year: 2024, tradeFlow: '出口', first: 1 });
    console.log('TOOL RESULT:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('ERROR INVOKING TOOL:', err);
  }
}

run();
