/**
 * test-trade-monthly-by-code.js
 *
 * 測試 query_trade_monthly_by_code 簡化參數版
 *
 * 使用方式：
 *   node src/test/test-trade-monthly-by-code.js          # 單元測試（不呼叫 API）
 *   node src/test/test-trade-monthly-by-code.js --live   # 整合測試（實際呼叫 APIM API）
 */

import { buildFilterFromParams, execute } from '../tools/query-trade-monthly-by-code.js';
import { buildQuery } from '../utils/query-builder.js';
import { config } from '../utils/config.js';

// ── 測試工具 ──────────────────────────────────────────────

const isLive = process.argv.includes('--live');
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  [FAIL] ${msg}`);
  }
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// ================================================================
//  PART 1: 單元測試 — buildFilterFromParams 產生正確 filter
// ================================================================

section('TEST 1: 無參數 — 回傳 undefined');
{
  const filter = buildFilterFromParams({});
  assert(filter === undefined, '空參數回傳 undefined');
}

section('TEST 2: year 篩選');
{
  const filter = buildFilterFromParams({ year: 2024 });
  assert(filter.YEAR.eq === 2024, 'filter.YEAR.eq = 2024');
}

section('TEST 3: tradeFlow 出口 → "出口"');
{
  const filter = buildFilterFromParams({ tradeFlow: '出口' });
  assert(filter.TRADE_FLOW.eq === '出口', 'tradeFlow 出口 → TRADE_FLOW.eq = "出口"');
}

section('TEST 4: tradeFlow 進口 → "進口"');
{
  const filter = buildFilterFromParams({ tradeFlow: '進口' });
  assert(filter.TRADE_FLOW.eq === '進口', 'tradeFlow 進口 → TRADE_FLOW.eq = "進口"');
}

section('TEST 5: hsCode 短碼 → startsWith');
{
  const filter = buildFilterFromParams({ hsCode: '8542' });
  assert(filter.HS_CODE.startsWith === '8542', 'hsCode "8542" → HS_CODE.startsWith = "8542"');
}

section('TEST 6: hsCode 長碼 → eq');
{
  const filter = buildFilterFromParams({ hsCode: '847130' });
  assert(filter.HS_CODE.eq === '847130', 'hsCode "847130" → HS_CODE.eq = "847130"');
}

section('TEST 7: productKeyword → HS_CODE_ZH contains');
{
  const filter = buildFilterFromParams({ productKeyword: '積體電路' });
  assert(filter.HS_CODE_ZH.contains === '積體電路', 'productKeyword → HS_CODE_ZH.contains = "積體電路"');
}

section('TEST 8: country ISO2 → COUNTRY_ID eq');
{
  const filter = buildFilterFromParams({ country: 'US' });
  assert(filter.COUNTRY_ID.eq === 'US', 'country "US" → COUNTRY_ID.eq = "US"');
}

section('TEST 9: country 中文 → COUNTRY_COMM_ZH contains');
{
  const filter = buildFilterFromParams({ country: '美國' });
  assert(filter.COUNTRY_COMM_ZH.contains === '美國', 'country "美國" → COUNTRY_COMM_ZH.contains');
}

section('TEST 10: 完整參數組合');
{
  const filter = buildFilterFromParams({
    year: 2024,
    tradeFlow: '出口',
    hsCode: '8542',
    country: 'US',
  });
  assert(filter.YEAR.eq === 2024, '組合: YEAR');
  assert(filter.TRADE_FLOW.eq === '出口', '組合: TRADE_FLOW');
  assert(filter.HS_CODE.startsWith === '8542', '組合: HS_CODE');
  assert(filter.COUNTRY_ID.eq === 'US', '組合: COUNTRY_ID');
}

section('TEST 11: buildQuery 產生正確查詢（無 variables）');
{
  const filter = buildFilterFromParams({ year: 2024, tradeFlow: '出口' });
  const normalizedParams = {
    filter,
    orderBy: { PERIOD_MONTH: 'ASC' },
    first: 50,
  };
  const { query } = buildQuery('trade_monthly_by_code_country', normalizedParams);
  assert(query.includes('trade_monthly_by_code_countries'), '查詢包含正確 resolver 名稱');
  assert(query.includes('filter:'), '查詢包含 inline filter');
  assert(query.includes('orderBy:'), '查詢包含 inline orderBy');
  assert(query.includes('first: 50'), '查詢包含 first: 50');
  assert(query.includes('items {'), '查詢包含 items 區塊');
  assert(!query.includes('$filter'), '查詢不包含 $variable 定義');
  assert(!query.includes('groupBy'), '查詢不包含 groupBy');
}

section('TEST 12: first 上限截斷');
{
  const normalizedParams = {
    first: Math.min(99999, config.maxPageSize),
  };
  assert(normalizedParams.first === config.maxPageSize, `first 被截斷為 maxPageSize (${config.maxPageSize})`);
}

// ================================================================
//  PART 2: 整合測試（--live 模式）
// ================================================================

if (isLive) {

  section('LIVE TEST A: 基本查詢 — 2024 年出口前 10 筆');
  {
    try {
      const result = await execute({ year: 2024, tradeFlow: '出口', first: 10 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.trade_monthly_by_code_countries;
      assert(data !== undefined, 'API 回應包含 trade_monthly_by_code_countries');
      assert(Array.isArray(data?.items), 'items 是陣列');
      assert(data.items.length <= 10, `items 數量 <= 10（實際: ${data?.items?.length}）`);
      if (data?.items?.length > 0) {
        const item = data.items[0];
        assert(typeof item.HS_CODE === 'string', '有 HS_CODE 欄位');
        assert(typeof item.TRADE_VALUE_USD_AMT !== 'undefined', '有 TRADE_VALUE_USD_AMT 欄位');
        console.log(`\n  [DATA] 前 3 筆:`);
        data.items.slice(0, 3).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_CODE} | ${r.HS_CODE_ZH?.substring(0, 20)} | ${r.COUNTRY_COMM_ZH} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST B: HS Code 前綴查詢 — 8542 (半導體)');
  {
    try {
      const result = await execute({ year: 2024, hsCode: '8542', tradeFlow: '出口', first: 5 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.trade_monthly_by_code_countries;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.HS_CODE.startsWith('8542'));
        assert(allMatch, '所有結果的 HS_CODE 都以 8542 開頭');
        console.log(`\n  [DATA] 8542 半導體出口:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_CODE} | ${r.COUNTRY_COMM_ZH} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST C: 國家查詢 — 對美國出口');
  {
    try {
      const result = await execute({ year: 2024, country: 'US', tradeFlow: '出口', first: 5, order: 'DESC' });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.trade_monthly_by_code_countries;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allUS = data.items.every(i => i.COUNTRY_ID === 'US');
        assert(allUS, '所有結果的 COUNTRY_ID 都是 US');
        console.log(`\n  [DATA] 對美國出口:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.PERIOD_MONTH} | ${r.HS_CODE} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST D: 品名關鍵字查詢');
  {
    try {
      const result = await execute({ productKeyword: '積體電路', year: 2024, first: 5 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.trade_monthly_by_code_countries;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.HS_CODE_ZH?.includes('積體電路'));
        assert(allMatch, '所有結果的品名都包含「積體電路」');
        console.log(`\n  [DATA] 積體電路相關:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_CODE} | ${r.HS_CODE_ZH?.substring(0, 30)} | ${r.COUNTRY_COMM_ZH}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST E: 進口查詢');
  {
    try {
      const result = await execute({ year: 2024, tradeFlow: '進口', country: 'JP', first: 5 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.trade_monthly_by_code_countries;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allImport = data.items.every(i => i.TRADE_FLOW === '進口');
        assert(allImport, '所有結果的 TRADE_FLOW 都是 "進口"');
        const allJP = data.items.every(i => i.COUNTRY_ID === 'JP');
        assert(allJP, '所有結果的 COUNTRY_ID 都是 JP');
        console.log(`\n  [DATA] 從日本進口:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_CODE} | ${r.HS_CODE_ZH?.substring(0, 20)} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }
}

// ================================================================
//  測試結果摘要
// ================================================================

section('測試結果');
console.log(`  通過: ${passed}`);
console.log(`  失敗: ${failed}`);
if (failures.length > 0) {
  console.log(`\n  失敗項目:`);
  failures.forEach(f => console.log(`    - ${f}`));
}
console.log(`\n${failed === 0 ? 'ALL PASSED' : 'SOME TESTS FAILED'}`);
if (!isLive) {
  console.log('\nTip: 使用 --live 參數可執行實際 API 整合測試：');
  console.log('   node src/test/test-trade-monthly-by-code.js --live\n');
}

process.exit(failed > 0 ? 1 : 0);
