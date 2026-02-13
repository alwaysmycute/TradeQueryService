/**
 * test-country-area.js
 *
 * 測試 query_country_area_reference 改寫版
 *
 * 使用方式：
 *   node test/test-country-area.js          # 單元測試（不呼叫 API）
 *   node test/test-country-area.js --live   # 整合測試（實際呼叫 APIM API）
 */

import {
  buildCountryAreaQuery,
  queryCountryAreaReference,
  getCountryByISO3,
  getCountriesByArea,
  searchCountryByName,
  searchCountriesByAreaKeyword,
  clientGroupBy,
  ALL_FIELD_NAMES,
} from '../tools/query-country-area-reference.js';

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
//  PART 1: 單元測試 — buildCountryAreaQuery 產生正確結構
// ================================================================

section('TEST 1: 基本查詢 — 無 filter、無 orderBy');
{
  const { query, variables } = buildCountryAreaQuery({ first: 10 });

  assert(query.includes('uNION_REF_COUNTRY_AREAs'), '查詢包含正確的 resolver 名稱');
  assert(query.includes('$first: Int'), '查詢定義 $first 變數');
  assert(query.includes('$filter: UNION_REF_COUNTRY_AREAFilterInput'), '查詢定義 $filter 變數');
  assert(query.includes('$orderBy: UNION_REF_COUNTRY_AREAOrderByInput'), '查詢定義 $orderBy 變數');
  assert(query.includes('items {'), '查詢包含 items 區塊');
  assert(query.includes('endCursor'), '查詢包含 endCursor');
  assert(query.includes('hasNextPage'), '查詢包含 hasNextPage');
  assert(variables.first === 10, 'variables.first = 10');
  assert(variables.filter === null, 'variables.filter = null（無篩選）');
  assert(variables.orderBy === null, 'variables.orderBy = null（無排序）');

  for (const field of ALL_FIELD_NAMES) {
    assert(query.includes(field), `查詢包含欄位: ${field}`);
  }
}

// ──────────────────────────────────────────────────────────

section('TEST 2: 篩選 + 排序 — filter ISO3 eq "USA", orderBy ROW ASC');
{
  const { query, variables } = buildCountryAreaQuery({
    first: 5,
    filter: { ISO3: { eq: 'USA' } },
    orderBy: { ROW: 'ASC' },
  });

  assert(variables.first === 5, 'variables.first = 5');
  assert(variables.filter !== null, 'variables.filter 不為 null');
  assert(variables.filter.ISO3.eq === 'USA', 'filter.ISO3.eq = "USA"');
  assert(variables.orderBy !== null, 'variables.orderBy 不為 null');
  assert(variables.orderBy.ROW === 'ASC', 'orderBy.ROW = "ASC"');
  assert(query.includes('filter: $filter'), '查詢使用 $filter 變數');
  assert(query.includes('orderBy: $orderBy'), '查詢使用 $orderBy 變數');
}

// ──────────────────────────────────────────────────────────

section('TEST 3: 複合篩選 — AND 條件');
{
  const { query, variables } = buildCountryAreaQuery({
    first: 50,
    filter: {
      and: [
        { AREA_NM: { contains: '亞' } },
        { COUNTRY_COMM_ZH: { contains: '韓' } },
      ],
    },
    orderBy: { COUNTRY_COMM_ZH: 'ASC' },
  });

  assert(variables.filter.and.length === 2, 'filter.and 有 2 個條件');
  assert(variables.filter.and[0].AREA_NM.contains === '亞', 'AND 條件 1: AREA_NM contains 亞');
  assert(variables.filter.and[1].COUNTRY_COMM_ZH.contains === '韓', 'AND 條件 2: COUNTRY_COMM_ZH contains 韓');
  assert(variables.orderBy.COUNTRY_COMM_ZH === 'ASC', 'orderBy: COUNTRY_COMM_ZH ASC');
}

// ──────────────────────────────────────────────────────────

section('TEST 4: 分頁 — after cursor');
{
  const fakeCursor = 'eyJyb3ciOjEwfQ==';
  const { query, variables } = buildCountryAreaQuery({
    first: 20,
    after: fakeCursor,
  });

  assert(variables.after === fakeCursor, 'variables.after = 指定的 cursor');
  assert(query.includes('after: $after'), '查詢使用 $after 變數');
}

// ──────────────────────────────────────────────────────────

section('TEST 5: 邊界條件 — first 超過上限被截斷');
{
  const { query, variables } = buildCountryAreaQuery({ first: 99999 });
  assert(variables.first === 5000, 'first 被截斷為 maxPageSize (5000)');
}

// ──────────────────────────────────────────────────────────

section('TEST 6: in 篩選 — 多國 ISO3');
{
  const { query, variables } = buildCountryAreaQuery({
    filter: { ISO3: { in: ['USA', 'JPN', 'KOR', 'DEU'] } },
    orderBy: { AREA_NM: 'ASC' },
  });

  assert(Array.isArray(variables.filter.ISO3.in), 'filter.ISO3.in 是陣列');
  assert(variables.filter.ISO3.in.length === 4, 'filter.ISO3.in 有 4 個值');
  assert(variables.orderBy.AREA_NM === 'ASC', 'orderBy 有 AREA_NM');
}

// ──────────────────────────────────────────────────────────

section('TEST 7: 預設值 — 不傳任何參數');
{
  const { query, variables } = buildCountryAreaQuery();
  assert(variables.first === 50, '預設 first = 50');
  assert(variables.after === null, '預設 after = null');
  assert(variables.filter === null, '預設 filter = null');
  assert(variables.orderBy === null, '預設 orderBy = null');
}

// ──────────────────────────────────────────────────────────

section('TEST 8: OR 篩選 — 搜尋多個地區');
{
  const { query, variables } = buildCountryAreaQuery({
    filter: {
      or: [
        { AREA_NM: { eq: '東北亞' } },
        { AREA_NM: { eq: '東南亞' } },
      ],
    },
  });

  assert(Array.isArray(variables.filter.or), 'filter.or 是陣列');
  assert(variables.filter.or.length === 2, 'filter.or 有 2 個條件');
}

// ──────────────────────────────────────────────────────────

section('TEST 9: 數值篩選 — ROW range');
{
  const { query, variables } = buildCountryAreaQuery({
    filter: {
      ROW: { gte: 100, lte: 200 },
    },
    orderBy: { ROW: 'ASC' },
  });

  assert(variables.filter.ROW.gte === 100, 'filter.ROW.gte = 100');
  assert(variables.filter.ROW.lte === 200, 'filter.ROW.lte = 200');
}

// ──────────────────────────────────────────────────────────

section('TEST 10: 空 filter/orderBy 被正規化為 null');
{
  const { query, variables } = buildCountryAreaQuery({
    filter: {},
    orderBy: {},
  });

  assert(variables.filter === null, '空 filter 物件被正規化為 null');
  assert(variables.orderBy === null, '空 orderBy 物件被正規化為 null');
}

// ================================================================
//  PART 2: 整合測試（--live 模式）— 實際呼叫 APIM API
// ================================================================

if (isLive) {

  // ────────────────────────────────────────────────────────
  section('LIVE TEST A: 基本查詢 — 取前 10 筆（無排序）');
  {
    try {
      const result = await queryCountryAreaReference({ first: 10 });
      const data = result.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含 uNION_REF_COUNTRY_AREAs');
      assert(Array.isArray(data?.items), 'items 是陣列');
      assert(data.items.length <= 10, `items 數量 <= 10（實際: ${data?.items?.length}）`);
      assert(typeof data.hasNextPage === 'boolean', 'hasNextPage 是 boolean');
      if (data?.items?.length > 0) {
        const item = data.items[0];
        assert(typeof item.ISO3 === 'string', '第一筆有 ISO3 欄位');
        assert(typeof item.COUNTRY_COMM_ZH === 'string', '第一筆有 COUNTRY_COMM_ZH 欄位');
        assert(typeof item.AREA_NM === 'string', '第一筆有 AREA_NM 欄位');
        assert(typeof item.ROW === 'number', '第一筆有 ROW 欄位（數值）');
        console.log(`\n  [DATA] 前 3 筆:`);
        data.items.slice(0, 3).forEach((r, i) =>
          console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.COUNTRY_COMM_EN} | ${r.AREA_NM}`)
        );
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  // ────────────────────────────────────────────────────────
  section('LIVE TEST B: 單一國家精確查詢 — getCountryByISO3("JPN")');
  {
    try {
      const result = await getCountryByISO3('JPN');
      const data = result.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      assert(data.items.length === 1, `精確查詢回傳 1 筆（實際: ${data.items?.length}）`);
      if (data.items.length > 0) {
        const jpn = data.items[0];
        assert(jpn.ISO3 === 'JPN', 'ISO3 = JPN');
        assert(jpn.COUNTRY_COMM_ZH === '日本', 'COUNTRY_COMM_ZH = 日本');
        assert(jpn.COUNTRY_COMM_EN === 'Japan', 'COUNTRY_COMM_EN = Japan');
        assert(typeof jpn.AREA_NM === 'string' && jpn.AREA_NM.length > 0, `AREA_NM 有值: "${jpn.AREA_NM}"`);
        console.log(`\n  [DATA] 日本: ${JSON.stringify(jpn, null, 2)}`);
      }
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  // ────────────────────────────────────────────────────────
  section('LIVE TEST C: 篩選 + 排序 — AREA_NM contains "亞" + orderBy');
  {
    try {
      const result = await searchCountriesByAreaKeyword('亞');
      const data = result.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      assert(data.items.length > 0, `含「亞」的地區有 ${data.items.length} 個國家`);
      const allContain = data.items.every(i => i.AREA_NM.includes('亞'));
      assert(allContain, '所有結果的 AREA_NM 都包含「亞」');
      console.log(`\n  [DATA] 含「亞」的地區國家 (前 5 筆):`);
      data.items.slice(0, 5).forEach((r, i) =>
        console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.AREA_NM}`)
      );
      const areas = [...new Set(data.items.map(i => i.AREA_NM))];
      console.log(`  [INFO] 不重複地區: ${areas.join(', ')}`);
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  // ────────────────────────────────────────────────────────
  section('LIVE TEST D: 模糊搜尋 — searchCountryByName("韓")');
  {
    try {
      const result = await searchCountryByName('韓');
      const data = result.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      assert(data.items.length > 0, `搜尋「韓」有 ${data.items.length} 筆結果`);
      const allMatch = data.items.every(i => i.COUNTRY_COMM_ZH.includes('韓'));
      assert(allMatch, '所有結果的中文名都包含「韓」');
      console.log(`\n  [DATA] 含「韓」的國家:`);
      data.items.forEach((r, i) =>
        console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.AREA_NM}`)
      );
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  // ────────────────────────────────────────────────────────
  section('LIVE TEST E: in 篩選 — 查詢 5 國並排序');
  {
    try {
      const result = await queryCountryAreaReference({
        filter: { ISO3: { in: ['USA', 'JPN', 'KOR', 'DEU', 'GBR'] } },
        orderBy: { AREA_NM: 'ASC' },
      });
      const data = result.data?.uNION_REF_COUNTRY_AREAs;
      assert(data !== undefined, 'API 回應包含資料');
      assert(data.items.length === 5, `in 篩選回傳 5 筆（實際: ${data.items?.length}）`);
      console.log(`\n  [DATA] 5 國資料:`);
      data.items.forEach((r, i) =>
        console.log(`     ${i + 1}. ${r.ISO3} | ${r.COUNTRY_COMM_ZH} | ${r.AREA_NM}`)
      );
    } catch (e) {
      assert(false, `API 呼叫失敗: ${e.message}`);
    }
  }

  // ────────────────────────────────────────────────────────
  section('LIVE TEST F: 客戶端 groupBy — 依 AREA_NM 分組統計');
  {
    try {
      const groups = await clientGroupBy('AREA_NM');
      assert(groups.length > 0, `分組結果有 ${groups.length} 個地區`);
      console.log(`\n  [DATA] 各地區國家數量（依數量降序）:`);
      groups.forEach(g => {
        console.log(`     ${g.group}: ${g.count} 個國家`);
      });
      const totalCountries = groups.reduce((sum, g) => sum + g.count, 0);
      console.log(`  [INFO] 總計 ${totalCountries} 個國家`);
    } catch (e) {
      assert(false, `clientGroupBy 失敗: ${e.message}`);
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
  console.log('   node test/test-country-area.js --live\n');
}

process.exit(failed > 0 ? 1 : 0);
