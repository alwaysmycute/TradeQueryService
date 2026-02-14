/**
 * test-new-4-tools.js
 *
 * E2E tests for the 4 new tools:
 * - query_trade_yearly_totals
 * - query_trade_monthly_totals
 * - query_trade_monthly_by_countries
 * - query_trade_yearly_by_countries
 */

const MCP_ENDPOINT = 'http://localhost:3000/mcp';

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
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

async function callMcpTool(toolName, args = {}) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };

  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result) return data.result;
          if (data.error) throw new Error(`MCP Error: ${JSON.stringify(data.error)}`);
        } catch (e) {
          if (e.message.startsWith('MCP Error')) throw e;
        }
      }
    }
    throw new Error('No result found in SSE response');
  } else {
    const json = await response.json();
    if (json.error) throw new Error(`MCP Error: ${JSON.stringify(json.error)}`);
    return json.result;
  }
}

function parseToolResult(result) {
  if (!result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(result.content[0].text);
  } catch (e) {
    console.log(`  [DEBUG] Parse error: ${e.message}`);
    return null;
  }
}

// ================================================================
//  Tool 1: query_trade_yearly_totals
// ================================================================

section('Tool 1: query_trade_yearly_totals');

// 1-1: 查詢 2024 年出口
console.log('\n  1-1: 2024 年出口年度總計');
{
  try {
    const result = await callMcpTool('query_trade_yearly_totals', {
      year: 2024, tradeFlow: '出口', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_totals?.items;
    assert(items?.length > 0, '找到 2024 年出口資料');
    assert(items?.every(i => i.YEAR === 2024), 'YEAR filter 生效');
    assert(items?.every(i => i.TRADE_FLOW === '出口'), 'TRADE_FLOW filter 生效');
    assert(items?.[0]?.TRADE_VALUE_USD_AMT !== undefined, '有美元金額欄位');
    assert(items?.[0]?.INDUSTRY !== undefined, '有產業欄位');
    console.log(`     → 產業: ${items?.slice(0, 3).map(i => i.INDUSTRY).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 1-2: 查詢電子產業多年趨勢
console.log('\n  1-2: 電子產業多年趨勢');
{
  try {
    const result = await callMcpTool('query_trade_yearly_totals', {
      tradeFlow: '出口', industryKeyword: '電子', order: 'ASC', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_totals?.items;
    assert(items?.length > 0, '找到電子產業資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    if (items?.length >= 2) {
      const years = items.map(i => i.YEAR);
      const sorted = years.every((y, i) => i === 0 || y >= years[i - 1]);
      assert(sorted, 'orderBy YEAR ASC 生效');
    }
    console.log(`     → 年份: ${items?.map(i => i.YEAR).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 1-3: 無 filter 查詢
console.log('\n  1-3: 無 filter 查詢（預設）');
{
  try {
    const result = await callMcpTool('query_trade_yearly_totals', { first: 5 });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_totals?.items;
    assert(items?.length > 0 && items.length <= 5, `first 生效: ${items?.length} 筆`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 2: query_trade_monthly_totals
// ================================================================

section('Tool 2: query_trade_monthly_totals');

// 2-1: 2024 年出口月度趨勢
console.log('\n  2-1: 2024 年出口月度趨勢');
{
  try {
    const result = await callMcpTool('query_trade_monthly_totals', {
      year: 2024, tradeFlow: '出口', order: 'ASC', first: 12,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_totals?.items;
    assert(items?.length > 0, '找到月度資料');
    assert(items?.every(i => i.YEAR === 2024), 'YEAR filter 生效');
    assert(items?.[0]?.PERIOD_MONTH !== undefined, '有 PERIOD_MONTH 欄位');
    assert(items?.[0]?.MONTH !== undefined, '有 MONTH 欄位');
    if (items?.length >= 2) {
      const months = items.map(i => i.PERIOD_MONTH);
      const sorted = months.every((m, i) => i === 0 || m >= months[i - 1]);
      assert(sorted, 'orderBy PERIOD_MONTH ASC 生效');
    }
    console.log(`     → 月份: ${items?.slice(0, 5).map(i => i.MONTH).join(', ')}...`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 2-2: 電子產業月度
console.log('\n  2-2: 電子產業月度數據');
{
  try {
    const result = await callMcpTool('query_trade_monthly_totals', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_totals?.items;
    assert(items?.length > 0, '找到電子產業月度資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    console.log(`     → ${items?.[0]?.INDUSTRY} USD ${items?.[0]?.TRADE_VALUE_USD_AMT}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 2-3: DESC 排序
console.log('\n  2-3: DESC 排序測試');
{
  try {
    const result = await callMcpTool('query_trade_monthly_totals', {
      year: 2024, tradeFlow: '進口', order: 'DESC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_totals?.items;
    assert(items?.length > 0, '找到進口資料');
    if (items?.length >= 2) {
      const months = items.map(i => i.PERIOD_MONTH);
      const sorted = months.every((m, i) => i === 0 || m <= months[i - 1]);
      assert(sorted, 'orderBy PERIOD_MONTH DESC 生效');
    }
    console.log(`     → 最新月份: ${items?.[0]?.PERIOD_MONTH}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 3: query_trade_monthly_by_countries
// ================================================================

section('Tool 3: query_trade_monthly_by_countries');

// 3-1: 2024 年對美國出口
console.log('\n  3-1: 2024 年對美國月度出口');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_countries', {
      year: 2024, tradeFlow: '出口', country: 'US', order: 'ASC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_countries?.items;
    assert(items?.length > 0, '找到對美出口資料');
    assert(items?.every(i => i.COUNTRY_ID === 'US'), 'COUNTRY_ID filter 生效');
    assert(items?.every(i => i.TRADE_FLOW === '出口'), 'TRADE_FLOW filter 生效');
    assert(items?.[0]?.AREA_NM !== undefined, '有地區欄位');
    console.log(`     → 地區: ${items?.[0]?.AREA_NM}, 產業: ${items?.[0]?.INDUSTRY}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 3-2: 東南亞進口
console.log('\n  3-2: 東南亞月度進口');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_countries', {
      year: 2024, tradeFlow: '進口', country: '東南亞', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_countries?.items;
    assert(items?.length > 0, '找到東南亞進口資料');
    assert(items?.every(i => i.AREA_NM === '東南亞'), 'AREA_NM filter 生效');
    console.log(`     → 國家: ${[...new Set(items?.map(i => i.COUNTRY_COMM_ZH))].join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 3-3: 電子產業對日本
console.log('\n  3-3: 電子產業對日本月度出口');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_countries', {
      year: 2024, tradeFlow: '出口', country: 'JP', industryKeyword: '電子', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_countries?.items;
    assert(items?.length > 0, '找到資料');
    assert(items?.every(i => i.COUNTRY_ID === 'JP'), 'JP filter 生效');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    console.log(`     → ${items?.[0]?.PERIOD_MONTH} USD ${items?.[0]?.TRADE_VALUE_USD_AMT}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 4: query_trade_yearly_by_countries
// ================================================================

section('Tool 4: query_trade_yearly_by_countries');

// 4-1: 2024 年對各國出口
console.log('\n  4-1: 2024 年對各國出口');
{
  try {
    const result = await callMcpTool('query_trade_yearly_by_countries', {
      year: 2024, tradeFlow: '出口', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_by_countries?.items;
    assert(items?.length > 0, '找到年度國別資料');
    assert(items?.every(i => i.YEAR === 2024), 'YEAR filter 生效');
    assert(items?.[0]?.COUNTRY_ID !== undefined, '有 COUNTRY_ID 欄位');
    assert(items?.[0]?.AREA_NM !== undefined, '有 AREA_NM 欄位');
    console.log(`     → 國家: ${items?.slice(0, 5).map(i => i.COUNTRY_COMM_ZH).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 4-2: 對美國歷年出口
console.log('\n  4-2: 對美國歷年出口趨勢');
{
  try {
    const result = await callMcpTool('query_trade_yearly_by_countries', {
      tradeFlow: '出口', country: 'US', order: 'ASC', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_by_countries?.items;
    assert(items?.length > 0, '找到歷年對美出口');
    assert(items?.every(i => i.COUNTRY_ID === 'US'), 'COUNTRY_ID filter 生效');
    if (items?.length >= 2) {
      const years = items.map(i => i.YEAR);
      const sorted = years.every((y, i) => i === 0 || y >= years[i - 1]);
      assert(sorted, 'orderBy YEAR ASC 生效');
    }
    console.log(`     → 年份: ${items?.map(i => i.YEAR).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 4-3: 東北亞年度進口
console.log('\n  4-3: 東北亞年度進口');
{
  try {
    const result = await callMcpTool('query_trade_yearly_by_countries', {
      year: 2024, tradeFlow: '進口', country: '東北亞', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_by_countries?.items;
    assert(items?.length > 0, '找到東北亞進口資料');
    assert(items?.every(i => i.AREA_NM === '東北亞'), 'AREA_NM filter 生效');
    console.log(`     → 國家: ${[...new Set(items?.map(i => i.COUNTRY_COMM_ZH))].join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 4-4: 電子產業年度國別
console.log('\n  4-4: 電子產業年度國別出口');
{
  try {
    const result = await callMcpTool('query_trade_yearly_by_countries', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_by_countries?.items;
    assert(items?.length > 0, '找到電子產業資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    console.log(`     → ${items?.map(i => `${i.COUNTRY_COMM_ZH}(USD ${i.TRADE_VALUE_USD_AMT})`).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  測試結果摘要
// ================================================================

section('新 4 支 Tools 測試結果總覽');
console.log(`  通過: ${passed}`);
console.log(`  失敗: ${failed}`);
if (failures.length > 0) {
  console.log(`\n  失敗項目:`);
  failures.forEach(f => console.log(`    - ${f}`));
}
console.log(`\n${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

process.exit(failed > 0 ? 1 : 0);
