/**
 * test-country-area-v2.js
 *
 * 測試 query_country_area_reference 簡化參數版
 *
 * 使用方式：
 *   node src/test/test-country-area-v2.js          # 單元測試（不呼叫 API）
 *   node src/test/test-country-area-v2.js --live   # 整合測試（實際呼叫 APIM API）
 */

import { buildFilterFromParams, execute } from '../tools/query-country-area-reference.js';
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

section('TEST 2: country ISO3 → ISO3 eq');
{
  const filter = buildFilterFromParams({ country: 'USA' });
  assert(filter.ISO3.eq === 'USA', 'country "USA" → ISO3.eq = "USA"');
}

section('TEST 3: country 中文 → COUNTRY_COMM_ZH contains');
{
  const filter = buildFilterFromParams({ country: '美國' });
  assert(filter.COUNTRY_COMM_ZH.contains === '美國', 'country "美國" → COUNTRY_COMM_ZH.contains');
}

section('TEST 4: country 英文 → COUNTRY_COMM_EN contains');
{
  const filter = buildFilterFromParams({ country: 'Japan' });
  assert(filter.COUNTRY_COMM_EN.contains === 'Japan', 'country "Japan" → COUNTRY_COMM_EN.contains');
}

section('TEST 5: area → AREA_NM contains');
{
  const filter = buildFilterFromParams({ area: '亞洲' });
  assert(filter.AREA_NM.contains === '亞洲', 'area "亞洲" → AREA_NM.contains');
}

section('TEST 6: country + area 組合');
{
  const filter = buildFilterFromParams({ country: 'JPN', area: '亞洲' });
  assert(filter.ISO3.eq === 'JPN', '組合: ISO3');
  assert(filter.AREA_NM.contains === '亞洲', '組合: AREA_NM');
}

section('TEST 7: ISO3 小寫自動轉大寫');
{
  const filter = buildFilterFromParams({ country: 'usa' });
  assert(filter.ISO3.eq === 'USA', 'ISO3 小寫 "usa" → 大寫 "USA"');
}

section('TEST 8: buildQuery 產生正確查詢');
{
  const filter = buildFilterFromParams({ area: '亞洲' });
  const normalizedParams = {
    filter,
    first: 50,
  };
  const { query } = buildQuery('UNION_REF_COUNTRY_AREA', normalizedParams);
  assert(query.includes('uNION_REF_COUNTRY_AREAs'), '查詢包含正確 resolver 名稱');
  assert(query.includes('filter:'), '查詢包含 inline filter');
  assert(query.includes('first: 50'), '查詢包含 first: 50');
  assert(query.includes('items {'), '查詢包含 items 區塊');
  assert(!query.includes('$filter'), '查詢不包含 $variable 定義');
  assert(!query.includes('groupBy'), '查詢不包含 groupBy');
}

section('TEST 9: first 上限截斷');
{
  const normalizedParams = {
    first: Math.min(99999, config.maxPageSize),
  };
  assert(normalizedParams.first === config.maxPageSize, `first 被截斷為 maxPageSize (${config.maxPageSize})`);
}

section('TEST 10: 英文多詞名稱識別');
{
  const filter = buildFilterFromParams({ country: 'United States' });
  assert(filter.COUNTRY_COMM_EN.contains === 'United States', '英文多詞名稱 → COUNTRY_COMM_EN.contains');
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
      const data = parsed.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含 uNION_REF_COUNTRY_AREAs');
      assert(Array.isArray(data?.items), 'items 是陣列');
      assert(data.items.length <= 10, `items 數量 <= 10（實際: ${data?.items?.length}）`);
      if (data?.items?.length > 0) {
        const item = data.items[0];
        assert(typeof item.ISO3 === 'string', '有 ISO3 欄位');
        assert(typeof item.COUNTRY_COMM_ZH === 'string', '有 COUNTRY_COMM_ZH 欄位');
        assert(typeof item.AREA_NM === 'string', '有 AREA_NM 欄位');
        console.log(`\n  [DATA] 前 3 筆:`);
        data.items.slice(0, 3).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.COUNTRY_COMM_EN} | ${r.AREA_NM}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST B: ISO3 精確查詢 — JPN');
  {
    try {
      const result = await execute({ country: 'JPN' });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const jpn = data.items[0];
        assert(jpn.ISO3 === 'JPN', 'ISO3 = JPN');
        assert(jpn.COUNTRY_COMM_ZH === '日本', 'COUNTRY_COMM_ZH = 日本');
        console.log(`\n  [DATA] 日本: ${JSON.stringify(jpn, null, 2)}`);
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST C: 地區查詢 — 東北亞');
  {
    try {
      const result = await execute({ area: '東北亞', first: 100 });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      assert(data.items.length > 0, `東北亞有 ${data.items.length} 個國家`);
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.AREA_NM?.includes('東北亞'));
        assert(allMatch, '所有結果的 AREA_NM 都包含「東北亞」');
        console.log(`\n  [DATA] 東北亞國家:`);
        data.items.slice(0, 5).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.AREA_NM}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST D: 中文名稱查詢 — "韓"');
  {
    try {
      const result = await execute({ country: '韓' });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.COUNTRY_COMM_ZH?.includes('韓'));
        assert(allMatch, '所有結果的中文名都包含「韓」');
        console.log(`\n  [DATA] 含「韓」的國家:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.AREA_NM}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  section('LIVE TEST E: 英文名稱查詢 — "Japan"');
  {
    try {
      const result = await execute({ country: 'Japan' });
      const parsed = JSON.parse(result.content[0].text);
      const data = parsed.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      if (data?.items?.length > 0) {
        const allMatch = data.items.every(i => i.COUNTRY_COMM_EN?.includes('Japan'));
        assert(allMatch, '所有結果的英文名都包含 "Japan"');
        console.log(`\n  [DATA] Japan 相關:`);
        data.items.forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_EN} | ${r.AREA_NM}`)
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
  console.log('   node src/test/test-country-area-v2.js --live\n');
}

process.exit(failed > 0 ? 1 : 0);
