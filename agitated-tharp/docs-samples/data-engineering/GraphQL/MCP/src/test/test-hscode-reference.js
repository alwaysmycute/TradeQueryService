/**
 * test-hscode-reference.js
 *
 * 測試 query_hscode_reference 簡化參數版
 *
 * 使用方式：
 *   node src/test/test-hscode-reference.js          # 單元測試（不呼叫 API）
 *   node src/test/test-hscode-reference.js --live   # 整合測試（實際呼叫 APIM API）
 */

import { buildFilterFromParams, execute } from '../tools/query-hscode-reference.js';
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

section('TEST 2: industryKeyword → Industry contains');
{
  const filter = buildFilterFromParams({ industryKeyword: '電子' });
  assert(filter.Industry.contains === '電子', 'industryKeyword "電子" → Industry.contains');
}

section('TEST 3: hsCode 短碼 → HS_Code startsWith');
{
  const filter = buildFilterFromParams({ hsCode: '85' });
  assert(filter.HS_Code.startsWith === '85', 'hsCode "85" → HS_Code.startsWith');
}

section('TEST 4: hsCode 長碼 → HS_Code eq');
{
  const filter = buildFilterFromParams({ hsCode: '847130' });
  assert(filter.HS_Code.eq === '847130', 'hsCode "847130" → HS_Code.eq');
}

section('TEST 5: productKeyword → HS_Code_ZH contains');
{
  const filter = buildFilterFromParams({ productKeyword: '半導體' });
  assert(filter.HS_Code_ZH.contains === '半導體', 'productKeyword "半導體" → HS_Code_ZH.contains');
}

section('TEST 6: 完整參數組合');
{
  const filter = buildFilterFromParams({
    industryKeyword: '電子',
    hsCode: '85',
    productKeyword: '積體電路',
  });
  assert(filter.Industry.contains === '電子', '組合: Industry');
  assert(filter.HS_Code.startsWith === '85', '組合: HS_Code');
  assert(filter.HS_Code_ZH.contains === '積體電路', '組合: HS_Code_ZH');
}

section('TEST 7: buildQuery 產生正確查詢');
{
  const filter = buildFilterFromParams({ industryKeyword: '電子' });
  const normalizedParams = {
    filter,
    first: 50,
  };
  const { query } = buildQuery('UNION_REF_HSCODE', normalizedParams);
  assert(query.includes('uNION_REF_HSCODEs'), '查詢包含正確 resolver 名稱');
  assert(query.includes('filter:'), '查詢包含 inline filter');
  assert(query.includes('first: 50'), '查詢包含 first: 50');
  assert(query.includes('items {'), '查詢包含 items 區塊');
  assert(!query.includes('$filter'), '查詢不包含 $variable 定義');
  assert(!query.includes('groupBy'), '查詢不包含 groupBy');
}

section('TEST 8: first 上限截斷');
{
  const normalizedParams = {
    first: Math.min(99999, config.maxPageSize),
  };
  assert(normalizedParams.first === config.maxPageSize, `first 被截斷為 maxPageSize (${config.maxPageSize})`);
}

section('TEST 9: 無 orderBy（參考表不需排序）');
{
  const filter = buildFilterFromParams({ industryKeyword: '電子' });
  const normalizedParams = {
    filter,
    first: 50,
  };
  const { query } = buildQuery('UNION_REF_HSCODE', normalizedParams);
  assert(!query.includes('orderBy:'), '參考表查詢不含 orderBy');
}

// ================================================================
//  PART 2: 整合測試（--live 模式）
// ================================================================

if (isLive) {

  section('LIVE TEST A: 基本查詢 — 前 10 筆');
  {
    try {
      const result = await execute({ first: 10 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_HSCODEs;
      assert(data !== undefined, 'API 回應包含 uNION_REF_HSCODEs');
      assert(Array.isArray(data?.items), 'items 是陣列');
      assert(data.items.length <= 10, `items 數量 <= 10（實際: ${data?.items?.length}）`);
      if (data?.items?.length > 0) {
        const item = data.items[0];
        assert(typeof item.HS_Code === 'string', '有 HS_Code 欄位');
        assert(typeof item.Industry === 'string', '有 Industry 欄位');
        console.log(`\n  [DATA] 前 3 筆:`);
        data.items.slice(0, 3).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_Code} | ${r.Industry} | ${r.HS_Code_ZH?.substring(0, 30)}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST B: 產業關鍵字查詢 — "電子"');
  {
    try {
      const result = await execute({ industryKeyword: '電子', first: 10 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_HSCODEs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.Industry?.includes('電子'));
        assert(allMatch, '所有結果的 Industry 都包含「電子」');
        console.log(`\n  [DATA] 電子產業 HS Code:`);
        data.items.slice(0, 5).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_Code} | ${r.Industry} | ${r.HS_Code_ZH?.substring(0, 30)}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST C: HS Code 前綴查詢 — "85"');
  {
    try {
      const result = await execute({ hsCode: '85', first: 10 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_HSCODEs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.HS_Code?.startsWith('85'));
        assert(allMatch, '所有結果的 HS_Code 都以 85 開頭');
        console.log(`\n  [DATA] 85 群組:`);
        data.items.slice(0, 5).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_Code} | ${r.HS_Code_ZH?.substring(0, 40)}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST D: 品名關鍵字查詢 — "半導體"');
  {
    try {
      const result = await execute({ productKeyword: '半導體', first: 10 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_HSCODEs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.HS_Code_ZH?.includes('半導體'));
        assert(allMatch, '所有結果的品名都包含「半導體」');
        console.log(`\n  [DATA] 半導體相關:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_Code} | ${r.HS_Code_ZH?.substring(0, 40)}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST E: 精確 HS Code 查詢');
  {
    try {
      const result = await execute({ hsCode: '847130', first: 5 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_HSCODEs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.HS_Code === '847130');
        assert(allMatch, '所有結果的 HS_Code 都是 847130');
        console.log(`\n  [DATA] 847130 資料:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.HS_Code} | ${r.Industry} | ${r.HS_Code_ZH} | ${r.Unit_Name}`)
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
  console.log('   node src/test/test-hscode-reference.js --live\n');
}

process.exit(failed > 0 ? 1 : 0);
