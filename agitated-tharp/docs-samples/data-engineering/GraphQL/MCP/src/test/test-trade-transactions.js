/**
 * test-trade-transactions.js
 *
 * 測試 query_trade_transactions 簡化參數版
 *
 * 使用方式：
 *   node src/test/test-trade-transactions.js          # 單元測試（不呼叫 API）
 *   node src/test/test-trade-transactions.js --live   # 整合測試（實際呼叫 APIM API）
 */

import { buildFilterFromParams, execute } from '../tools/query-trade-transactions.js';
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

section('TEST 2: 日期範圍');
{
  const filter = buildFilterFromParams({ startDate: '2024-06-01', endDate: '2024-06-30' });
  assert(filter.TXN_DT.gte === '2024-06-01T00:00:00Z', 'startDate 轉換正確');
  assert(filter.TXN_DT.lte === '2024-06-30T23:59:59Z', 'endDate 轉換正確');
}

section('TEST 3: 只有 startDate');
{
  const filter = buildFilterFromParams({ startDate: '2024-01-01' });
  assert(filter.TXN_DT.gte === '2024-01-01T00:00:00Z', 'startDate 轉換正確');
  assert(filter.TXN_DT.lte === undefined, '無 endDate 時 lte 為 undefined');
}

section('TEST 4: 只有 endDate');
{
  const filter = buildFilterFromParams({ endDate: '2024-12-31' });
  assert(filter.TXN_DT.lte === '2024-12-31T23:59:59Z', 'endDate 轉換正確');
  assert(filter.TXN_DT.gte === undefined, '無 startDate 時 gte 為 undefined');
}

section('TEST 5: tradeFlow 出口 → "出口"');
{
  const filter = buildFilterFromParams({ tradeFlow: '出口' });
  assert(filter.TRADE_FLOW.eq === '出口', 'tradeFlow 出口 → TRADE_FLOW.eq = "出口"');
}

section('TEST 6: tradeFlow 進口 → "進口"');
{
  const filter = buildFilterFromParams({ tradeFlow: '進口' });
  assert(filter.TRADE_FLOW.eq === '進口', 'tradeFlow 進口 → TRADE_FLOW.eq = "進口"');
}

section('TEST 7: hsCode 短碼 → startsWith');
{
  const filter = buildFilterFromParams({ hsCode: '8542' });
  assert(filter.HS_CODE.startsWith === '8542', 'hsCode "8542" → startsWith');
}

section('TEST 8: hsCode 長碼 → eq');
{
  const filter = buildFilterFromParams({ hsCode: '847130' });
  assert(filter.HS_CODE.eq === '847130', 'hsCode "847130" → eq');
}

section('TEST 9: country ISO2 → COUNTRY_ID');
{
  const filter = buildFilterFromParams({ country: 'US' });
  assert(filter.COUNTRY_ID.eq === 'US', 'country "US" → COUNTRY_ID.eq');
}

section('TEST 10: country 中文 → COUNTRY_COMM_ZH');
{
  const filter = buildFilterFromParams({ country: '日本' });
  assert(filter.COUNTRY_COMM_ZH.contains === '日本', 'country "日本" → COUNTRY_COMM_ZH.contains');
}

section('TEST 11: productKeyword → HS_CODE_ZH');
{
  const filter = buildFilterFromParams({ productKeyword: '積體電路' });
  assert(filter.HS_CODE_ZH.contains === '積體電路', 'productKeyword → HS_CODE_ZH.contains');
}

section('TEST 12: 完整參數組合');
{
  const filter = buildFilterFromParams({
    startDate: '2024-06-01',
    endDate: '2024-06-30',
    tradeFlow: '出口',
    hsCode: '8542',
    country: 'US',
  });
  assert(filter.TXN_DT.gte !== undefined, '組合: TXN_DT.gte');
  assert(filter.TXN_DT.lte !== undefined, '組合: TXN_DT.lte');
  assert(filter.TRADE_FLOW.eq === '出口', '組合: TRADE_FLOW');
  assert(filter.HS_CODE.startsWith === '8542', '組合: HS_CODE');
  assert(filter.COUNTRY_ID.eq === 'US', '組合: COUNTRY_ID');
}

section('TEST 13: buildQuery 產生正確查詢');
{
  const filter = buildFilterFromParams({ startDate: '2024-06-01', endDate: '2024-06-30' });
  const normalizedParams = {
    filter,
    orderBy: { TXN_DT: 'DESC' },
    first: 50,
  };
  const { query } = buildQuery('TXN_MOF_NON_PROTECT_MT', normalizedParams);
  assert(query.includes('tXN_MOF_NON_PROTECT_MTs'), '查詢包含正確 resolver 名稱');
  assert(query.includes('filter:'), '查詢包含 inline filter');
  assert(query.includes('orderBy:'), '查詢包含 inline orderBy');
  assert(query.includes('items {'), '查詢包含 items 區塊');
  assert(!query.includes('$filter'), '查詢不包含 $variable 定義');
  assert(!query.includes('groupBy'), '查詢不包含 groupBy');
}

// ================================================================
//  PART 2: 整合測試（--live 模式）
// ================================================================

if (isLive) {

  section('LIVE TEST A: 日期範圍查詢 — 2024-06 半導體交易');
  {
    try {
      const result = await execute({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        hsCode: '8542',
        tradeFlow: '出口',
        first: 5,
      });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.tXN_MOF_NON_PROTECT_MTs;
      assert(data !== undefined, 'API 回應包含 tXN_MOF_NON_PROTECT_MTs');
      assert(Array.isArray(data?.items), 'items 是陣列');
      if (data?.items?.length > 0) {
        const item = data.items[0];
        assert(typeof item.TXN_DT === 'string', '有 TXN_DT 欄位');
        assert(typeof item.HS_CODE_EN === 'string' || item.HS_CODE_EN === null, '有 HS_CODE_EN 欄位（本表獨有）');
        console.log(`\n  [DATA] 前 3 筆:`);
        data.items.slice(0, 3).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.TXN_DT} | ${r.HS_CODE} | ${r.COUNTRY_COMM_ZH} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST B: 國家查詢 — 對美國出口');
  {
    try {
      const result = await execute({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        country: 'US',
        tradeFlow: '出口',
        first: 5,
        order: 'DESC',
      });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.tXN_MOF_NON_PROTECT_MTs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allUS = data.items.every(i => i.COUNTRY_ID === 'US');
        assert(allUS, '所有結果的 COUNTRY_ID 都是 US');
        console.log(`\n  [DATA] 對美國出口交易:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.TXN_DT} | ${r.HS_CODE} | ${r.COUNTRY_EN} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST C: 進口查詢 + 英文欄位');
  {
    try {
      const result = await execute({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        tradeFlow: '進口',
        country: 'JP',
        first: 5,
      });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.tXN_MOF_NON_PROTECT_MTs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const item = data.items[0];
        assert(item.TRADE_FLOW === '進口', 'TRADE_FLOW = "進口"');
        console.log(`\n  [DATA] 從日本進口:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.TXN_DT} | ${r.HS_CODE_EN?.substring(0, 30)} | Rate: ${r.RATE_VALUE}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST D: 品名關鍵字查詢');
  {
    try {
      const result = await execute({
        startDate: '2024-06-01',
        endDate: '2024-06-15',
        productKeyword: '積體電路',
        first: 5,
      });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.tXN_MOF_NON_PROTECT_MTs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        console.log(`\n  [DATA] 積體電路交易:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.TXN_DT} | ${r.HS_CODE_ZH?.substring(0, 30)} | USD ${r.TRADE_VALUE_USD_AMT}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST E: 排序驗證 — ASC');
  {
    try {
      const result = await execute({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        hsCode: '8542',
        order: 'ASC',
        first: 5,
      });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.tXN_MOF_NON_PROTECT_MTs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length >= 2) {
        const dates = data.items.map(i => i.TXN_DT);
        const sorted = dates.every((d, i) => i === 0 || d >= dates[i - 1]);
        assert(sorted, '日期按 ASC 排序');
        console.log(`\n  [DATA] ASC 排序日期: ${dates.join(', ')}`);
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
  console.log('   node src/test/test-trade-transactions.js --live\n');
}

process.exit(failed > 0 ? 1 : 0);
