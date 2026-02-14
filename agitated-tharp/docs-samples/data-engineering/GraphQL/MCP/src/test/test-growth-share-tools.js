/**
 * test-growth-share-tools.js
 *
 * E2E tests for the 5 growth/share tools:
 * - query_trade_monthly_growth
 * - query_trade_yearly_growth
 * - query_trade_monthly_growth_by_countries
 * - query_trade_monthly_share_by_countries
 * - query_trade_yearly_share_by_countries
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
//  Tool 1: query_trade_monthly_growth
// ================================================================

section('Tool 1: query_trade_monthly_growth');

// 1-1: 2024 年出口月度成長率
console.log('\n  1-1: 2024 年出口月度成長率');
{
  try {
    const result = await callMcpTool('query_trade_monthly_growth', {
      year: 2024, tradeFlow: '出口', order: 'ASC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_growth_totals?.items;
    assert(items?.length > 0, '找到月度成長率資料');
    assert(items?.every(i => i.YEAR === 2024), 'YEAR filter 生效');
    assert(items?.every(i => i.TRADE_FLOW === '出口'), 'TRADE_FLOW filter 生效');
    assert(items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD !== undefined, '有 YoY 成長率欄位');
    assert(items?.[0]?.MOM_GROWTH_RATE_TRADE_VALUE_USD !== undefined, '有 MoM 成長率欄位');
    assert(items?.[0]?.PREV_YEAR_TRADE_VALUE_USD_AMT !== undefined, '有前年金額欄位');
    console.log(`     → 月份: ${items?.map(i => i.MONTH).join(', ')}, YoY: ${items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 1-2: 電子產業成長率
console.log('\n  1-2: 電子產業月度成長率');
{
  try {
    const result = await callMcpTool('query_trade_monthly_growth', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', first: 3,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_growth_totals?.items;
    assert(items?.length > 0, '找到電子產業成長率資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    console.log(`     → ${items?.[0]?.INDUSTRY}, YoY: ${items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 1-3: 無 filter
console.log('\n  1-3: 無 filter 查詢');
{
  try {
    const result = await callMcpTool('query_trade_monthly_growth', { first: 3 });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_growth_totals?.items;
    assert(items?.length > 0 && items.length <= 3, `first 生效: ${items?.length} 筆`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 2: query_trade_yearly_growth
// ================================================================

section('Tool 2: query_trade_yearly_growth');

// 2-1: 2024 年出口成長率
console.log('\n  2-1: 2024 年出口年度成長率');
{
  try {
    const result = await callMcpTool('query_trade_yearly_growth', {
      year: 2024, tradeFlow: '出口', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_growth_totals?.items;
    assert(items?.length > 0, '找到年度成長率資料');
    assert(items?.every(i => i.YEAR === 2024), 'YEAR filter 生效');
    assert(items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD !== undefined, '有金額 YoY 成長率');
    assert(items?.[0]?.YOY_GROWTH_RATE_TRADE_WEIGHT !== undefined, '有重量 YoY 成長率');
    assert(items?.[0]?.YOY_GROWTH_RATE_UNIT_PRICE_USD_PER_KG !== undefined, '有單價 YoY 成長率');
    console.log(`     → ${items?.[0]?.INDUSTRY}: 金額YoY=${items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 2-2: 電子產業歷年成長
console.log('\n  2-2: 電子產業歷年成長趨勢');
{
  try {
    const result = await callMcpTool('query_trade_yearly_growth', {
      tradeFlow: '出口', industryKeyword: '電子', order: 'ASC', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_growth_totals?.items;
    assert(items?.length > 0, '找到電子產業年度成長資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    if (items?.length >= 2) {
      const years = items.map(i => i.YEAR);
      const sorted = years.every((y, i) => i === 0 || y >= years[i - 1]);
      assert(sorted, 'orderBy YEAR ASC 生效');
    }
    console.log(`     → 年份: ${items?.map(i => `${i.YEAR}(${i.YOY_GROWTH_RATE_TRADE_VALUE_USD})`).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 3: query_trade_monthly_growth_by_countries
// ================================================================

section('Tool 3: query_trade_monthly_growth_by_countries');

// 3-1: 對美國出口月度成長率
console.log('\n  3-1: 對美國出口月度成長率');
{
  try {
    const result = await callMcpTool('query_trade_monthly_growth_by_countries', {
      year: 2024, tradeFlow: '出口', country: 'US', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_growth_by_countries?.items;
    assert(items?.length > 0, '找到對美出口成長率資料');
    assert(items?.every(i => i.COUNTRY_ID === 'US'), 'COUNTRY_ID filter 生效');
    assert(items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD !== undefined, '有金額 YoY');
    assert(items?.[0]?.MOM_GROWTH_RATE_TRADE_VALUE_USD !== undefined, '有金額 MoM');
    assert(items?.[0]?.YOY_GROWTH_RATE_TRADE_WEIGHT !== undefined, '有重量 YoY');
    assert(items?.[0]?.MOM_GROWTH_RATE_UNIT_PRICE_USD_PER_KG !== undefined, '有單價 MoM');
    console.log(`     → ${items?.[0]?.COUNTRY_COMM_ZH} ${items?.[0]?.PERIOD_MONTH}: YoY=${items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 3-2: 東南亞進口成長
console.log('\n  3-2: 東南亞進口月度成長');
{
  try {
    const result = await callMcpTool('query_trade_monthly_growth_by_countries', {
      year: 2024, tradeFlow: '進口', country: '東南亞', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_growth_by_countries?.items;
    assert(items?.length > 0, '找到東南亞進口成長資料');
    assert(items?.every(i => i.AREA_NM === '東南亞'), 'AREA_NM filter 生效');
    console.log(`     → 國家: ${[...new Set(items?.map(i => i.COUNTRY_COMM_ZH))].join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 3-3: 電子產業各國成長
console.log('\n  3-3: 電子產業各國出口成長');
{
  try {
    const result = await callMcpTool('query_trade_monthly_growth_by_countries', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_growth_by_countries?.items;
    assert(items?.length > 0, '找到電子產業成長資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    assert(items?.[0]?.AREA_NM !== undefined, '有 AREA_NM 欄位');
    console.log(`     → ${items?.[0]?.COUNTRY_COMM_ZH}(${items?.[0]?.AREA_NM}): YoY=${items?.[0]?.YOY_GROWTH_RATE_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 4: query_trade_monthly_share_by_countries
// ================================================================

section('Tool 4: query_trade_monthly_share_by_countries');

// 4-1: 美國月度市佔率
console.log('\n  4-1: 美國出口月度市佔率');
{
  try {
    const result = await callMcpTool('query_trade_monthly_share_by_countries', {
      year: 2024, tradeFlow: '出口', country: 'US', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_share_by_countries?.items;
    assert(items?.length > 0, '找到美國市佔率資料');
    assert(items?.every(i => i.COUNTRY_ID === 'US'), 'COUNTRY_ID filter 生效');
    assert(items?.[0]?.SHARE_RATIO_TRADE_VALUE_USD !== undefined, '有金額市佔率欄位');
    assert(items?.[0]?.TOTAL_TRADE_VALUE_USD_AMT !== undefined, '有台灣總額欄位');
    assert(items?.[0]?.TRADE_VALUE_USD_AMT !== undefined, '有該國金額欄位');
    console.log(`     → 市佔率: ${items?.[0]?.SHARE_RATIO_TRADE_VALUE_USD}, 金額: ${items?.[0]?.TRADE_VALUE_USD_AMT} / 總額: ${items?.[0]?.TOTAL_TRADE_VALUE_USD_AMT}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 4-2: 東南亞月度進口佔比
console.log('\n  4-2: 東南亞月度進口佔比');
{
  try {
    const result = await callMcpTool('query_trade_monthly_share_by_countries', {
      year: 2024, tradeFlow: '進口', country: '東南亞', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_share_by_countries?.items;
    assert(items?.length > 0, '找到東南亞進口佔比資料');
    assert(items?.every(i => i.AREA_NM === '東南亞'), 'AREA_NM filter 生效');
    assert(items?.[0]?.SHARE_RATIO_TRADE_WEIGHT !== undefined, '有重量市佔率欄位');
    console.log(`     → ${items?.[0]?.COUNTRY_COMM_ZH}: 金額佔比=${items?.[0]?.SHARE_RATIO_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 4-3: 電子產業各國市佔
console.log('\n  4-3: 電子產業各國出口市佔');
{
  try {
    const result = await callMcpTool('query_trade_monthly_share_by_countries', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_share_by_countries?.items;
    assert(items?.length > 0, '找到電子產業市佔資料');
    assert(items?.every(i => i.INDUSTRY?.includes('電子')), 'INDUSTRY filter 生效');
    console.log(`     → ${items?.[0]?.COUNTRY_COMM_ZH}: ${items?.[0]?.SHARE_RATIO_TRADE_VALUE_USD}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 5: query_trade_yearly_share_by_countries
// ================================================================

section('Tool 5: query_trade_yearly_share_by_countries');

// 5-1: 2024 年各國出口佔比排名
console.log('\n  5-1: 2024 年各國出口佔比');
{
  try {
    const result = await callMcpTool('query_trade_yearly_share_by_countries', {
      year: 2024, tradeFlow: '出口', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_share_by_countries?.items;
    assert(items?.length > 0, '找到年度佔比資料');
    assert(items?.every(i => i.YEAR === 2024), 'YEAR filter 生效');
    assert(items?.[0]?.SHARE_RATIO_TRADE_VALUE_USD !== undefined, '有金額市佔率');
    assert(items?.[0]?.TOTAL_TRADE_VALUE_USD_AMT !== undefined, '有台灣年度總額');
    assert(items?.[0]?.SHARE_RATIO_TRADE_WEIGHT !== undefined, '有重量市佔率');
    console.log(`     → ${items?.slice(0, 3).map(i => `${i.COUNTRY_COMM_ZH}(${i.SHARE_RATIO_TRADE_VALUE_USD})`).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 5-2: 美國歷年佔比趨勢
console.log('\n  5-2: 美國歷年出口佔比趨勢');
{
  try {
    const result = await callMcpTool('query_trade_yearly_share_by_countries', {
      tradeFlow: '出口', country: 'US', order: 'ASC', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_share_by_countries?.items;
    assert(items?.length > 0, '找到美國歷年佔比');
    assert(items?.every(i => i.COUNTRY_ID === 'US'), 'COUNTRY_ID filter 生效');
    if (items?.length >= 2) {
      const years = items.map(i => i.YEAR);
      const sorted = years.every((y, i) => i === 0 || y >= years[i - 1]);
      assert(sorted, 'orderBy YEAR ASC 生效');
    }
    console.log(`     → ${items?.map(i => `${i.YEAR}(${i.SHARE_RATIO_TRADE_VALUE_USD})`).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 5-3: 東南亞年度佔比
console.log('\n  5-3: 東南亞年度進口佔比');
{
  try {
    const result = await callMcpTool('query_trade_yearly_share_by_countries', {
      year: 2024, tradeFlow: '進口', country: '東南亞', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_yearly_share_by_countries?.items;
    assert(items?.length > 0, '找到東南亞進口佔比');
    assert(items?.every(i => i.AREA_NM === '東南亞'), 'AREA_NM filter 生效');
    console.log(`     → ${items?.map(i => `${i.COUNTRY_COMM_ZH}(${i.SHARE_RATIO_TRADE_VALUE_USD})`).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  測試結果摘要
// ================================================================

section('Growth/Share 5 支 Tools 測試結果總覽');
console.log(`  通過: ${passed}`);
console.log(`  失敗: ${failed}`);
if (failures.length > 0) {
  console.log(`\n  失敗項目:`);
  failures.forEach(f => console.log(`    - ${f}`));
}
console.log(`\n${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

process.exit(failed > 0 ? 1 : 0);
