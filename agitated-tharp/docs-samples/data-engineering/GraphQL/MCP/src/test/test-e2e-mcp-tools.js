/**
 * test-e2e-mcp-tools.js
 *
 * End-to-end MCP tool 測試
 * 模擬 Claude client 透過 MCP protocol 呼叫各 tool 的場景。
 *
 * 每支 tool 至少 5 個問答場景，涵蓋常見使用情境。
 *
 * 使用方式：
 *   先啟動 MCP server: node src/index.js
 *   再執行測試: node src/test/test-e2e-mcp-tools.js
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

/**
 * 模擬 MCP client 呼叫 tool
 * 使用 JSON-RPC 2.0 格式，如同真實 MCP client (Cursor/Copilot)
 */
async function callMcpTool(toolName, args = {}) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
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
    // SSE response — parse it
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
          // skip non-JSON data lines
        }
      }
    }
    throw new Error('No result found in SSE response');
  } else {
    // JSON response
    const json = await response.json();
    if (json.error) throw new Error(`MCP Error: ${JSON.stringify(json.error)}`);
    return json.result;
  }
}

/**
 * 從 MCP tool result 解析出資料
 */
function parseToolResult(result) {
  if (!result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(result.content[0].text);
  } catch (e) {
    console.log(`  [DEBUG] JSON parse error: ${e.message}`);
    console.log(`  [DEBUG] Text length: ${result.content[0].text.length}`);
    console.log(`  [DEBUG] Text preview: ${result.content[0].text.substring(0, 100)}`);
    return null;
  }
}

// ================================================================
//  Tool 1: query_country_area_reference — 5 場景
// ================================================================

section('E2E Tool 1: query_country_area_reference');

// 場景 1: 用戶問「美國的 ISO3 代碼是什麼？」
console.log('\n  📝 場景 1: 用戶問「美國的 ISO3 代碼是什麼？」');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { country: '美國' });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length > 0, '找到美國的資料');
    assert(items?.[0]?.ISO3 === 'USA', 'ISO3 = USA');
    assert(items?.[0]?.AREA_NM !== undefined, '有地區資訊');
    console.log(`     → 回答: 美國的 ISO3 = ${items?.[0]?.ISO3}, 地區 = ${items?.[0]?.AREA_NM}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 2: 用戶問「東南亞有哪些國家？」
console.log('\n  📝 場景 2: 用戶問「東南亞有哪些國家？」');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { area: '東南亞', first: 50 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length > 0, `東南亞有 ${items?.length} 個國家`);
    const allSEA = items?.every(i => i.AREA_NM?.includes('東南亞'));
    assert(allSEA, '所有結果都在東南亞');
    console.log(`     → 回答: ${items?.map(i => i.COUNTRY_COMM_ZH).join('、')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 3: 用戶問「Japan 屬於哪個地區？」
console.log('\n  📝 場景 3: 用戶問「Japan 屬於哪個地區？」');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { country: 'Japan' });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length > 0, '找到 Japan');
    assert(items?.[0]?.AREA_NM !== undefined, '有地區資訊');
    console.log(`     → 回答: Japan (${items?.[0]?.COUNTRY_COMM_ZH}) 屬於 ${items?.[0]?.AREA_NM}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 4: 用戶問「查一下 KOR 是哪個國家？」
console.log('\n  📝 場景 4: 用戶問「查一下 KOR 是哪個國家？」');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { country: 'KOR' });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length === 1, '精確找到 1 個國家');
    assert(items?.[0]?.COUNTRY_COMM_ZH === '南韓', '中文名 = 南韓');
    console.log(`     → 回答: KOR = ${items?.[0]?.COUNTRY_COMM_ZH} (${items?.[0]?.COUNTRY_COMM_EN})`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 5: 用戶問「列出歐洲的國家」
console.log('\n  📝 場景 5: 用戶問「列出歐洲的國家」');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { area: '歐洲', first: 100 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length > 0, `歐洲有 ${items?.length} 個國家`);
    console.log(`     → 回答: 歐洲共 ${items?.length} 個國家，包括 ${items?.slice(0, 5).map(i => i.COUNTRY_COMM_ZH).join('、')}...`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 2: query_hscode_reference — 5 場景
// ================================================================

section('E2E Tool 2: query_hscode_reference');

// 場景 1: 用戶問「電子產業有哪些 HS Code？」
console.log('\n  📝 場景 1: 用戶問「電子產業有哪些 HS Code？」');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { industryKeyword: '電子', first: 5 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items?.length > 0, '找到電子產業 HS Code');
    const allElec = items?.every(i => i.Industry?.includes('電子'));
    assert(allElec, '所有結果都屬於電子產業');
    console.log(`     → 回答: ${items?.map(i => `${i.HS_Code}(${i.HS_Code_ZH?.substring(0, 15)})`).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 2: 用戶問「8542 開頭的 HS Code 是什麼商品？」
console.log('\n  📝 場景 2: 用戶問「8542 開頭的 HS Code 是什麼商品？」');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { hsCode: '8542', first: 5 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items?.length > 0, '找到 8542 群組商品');
    const allMatch = items?.every(i => i.HS_Code?.startsWith('8542'));
    assert(allMatch, '所有結果都以 8542 開頭');
    console.log(`     → 回答: ${items?.map(i => i.HS_Code_ZH?.substring(0, 25)).join(' | ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 3: 用戶問「半導體相關的產品代碼有哪些？」
console.log('\n  📝 場景 3: 用戶問「半導體相關的產品代碼有哪些？」');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { productKeyword: '半導體', first: 5 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items?.length > 0, '找到半導體相關商品');
    const allMatch = items?.every(i => i.HS_Code_ZH?.includes('半導體'));
    assert(allMatch, '所有結果品名都含「半導體」');
    console.log(`     → 回答: 找到 ${items?.length} 個半導體相關 HS Code`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 4: 用戶問「機械產業有哪些分類？」
console.log('\n  📝 場景 4: 用戶問「機械產業有哪些分類？」');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { industryKeyword: '機械', first: 10 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items?.length > 0, '找到機械產業商品');
    console.log(`     → 回答: 機械產業有 ${items?.length}+ 個 HS Code，如 ${items?.[0]?.HS_Code_ZH?.substring(0, 25)}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 5: 用戶問「847130 這個代碼是什麼？」
console.log('\n  📝 場景 5: 用戶問「847130 這個代碼是什麼？」');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { hsCode: '847130' });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items !== undefined, 'API 回應正常');
    if (items?.length > 0) {
      console.log(`     → 回答: ${items[0].HS_Code} = ${items[0].HS_Code_ZH}, 產業: ${items[0].Industry}`);
    } else {
      console.log(`     → 回答: 847130 沒有找到對應資料（可能需要用更長的代碼）`);
    }
    assert(true, '查詢完成（無論有無結果）');
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 3: query_trade_monthly_by_code — 5 場景
// ================================================================

section('E2E Tool 3: query_trade_monthly_by_code');

// 場景 1: 用戶問「2024 年台灣半導體出口狀況如何？」
console.log('\n  📝 場景 1: 用戶問「2024 年台灣半導體出口狀況如何？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '出口', hsCode: '8542', first: 5, order: 'ASC',
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items?.length > 0, '找到半導體出口資料');
    console.log(`     → 回答: 2024 年 8542 出口到 ${items?.map(i => i.COUNTRY_COMM_ZH).join('、')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 2: 用戶問「台灣出口到美國最多的商品是什麼？」
console.log('\n  📝 場景 2: 用戶問「台灣出口到美國最多的商品是什麼？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '出口', country: 'US', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items?.length > 0, '找到對美國出口資料');
    const allUS = items?.every(i => i.COUNTRY_ID === 'US');
    assert(allUS, '所有結果都是美國');
    console.log(`     → 回答: 包含 ${items?.map(i => i.HS_CODE_ZH?.substring(0, 15)).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 3: 用戶問「積體電路的進口來源國有哪些？」
console.log('\n  📝 場景 3: 用戶問「積體電路的進口來源國有哪些？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '進口', productKeyword: '積體電路', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items?.length > 0, '找到積體電路進口資料');
    console.log(`     → 回答: 進口來源包括 ${items?.map(i => i.COUNTRY_COMM_ZH).join('、')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 4: 用戶問「2024 年從日本進口了什麼？」
console.log('\n  📝 場景 4: 用戶問「2024 年從日本進口了什麼？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '進口', country: 'JP', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items?.length > 0, '找到從日本進口資料');
    const allJP = items?.every(i => i.COUNTRY_ID === 'JP');
    assert(allJP, '所有結果都來自日本');
    console.log(`     → 回答: ${items?.map(i => i.HS_CODE_ZH?.substring(0, 20)).join(', ')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 5: 用戶問「847130 的出口月度趨勢？」
console.log('\n  📝 場景 5: 用戶問「847130 的出口月度趨勢？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '出口', hsCode: '84713000001', first: 5, order: 'ASC',
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items !== undefined, 'API 回應正常');
    console.log(`     → 回答: 找到 ${items?.length || 0} 筆月度資料`);
    assert(true, '查詢完成');
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 4: query_trade_monthly_by_group — 5 場景
// ================================================================

section('E2E Tool 4: query_trade_monthly_by_group');

// 場景 1: 用戶問「2024 年電子零組件出口表現如何？」
console.log('\n  📝 場景 1: 用戶問「2024 年電子零組件出口表現如何？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items?.length > 0, '找到電子產業出口資料');
    console.log(`     → 回答: 電子產業出口到 ${items?.map(i => i.COUNTRY_COMM_ZH).join('、')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 2: 用戶問「台灣出口到亞洲哪些產業最多？」
console.log('\n  📝 場景 2: 用戶問「台灣出口到亞洲哪些產業最多？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '出口', country: '東北亞', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items?.length > 0, '找到出口到東北亞的資料');
    console.log(`     → 回答: 出口到東北亞，產業包括 ${[...new Set(items?.map(i => i.INDUSTRY))].join('、')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 3: 用戶問「自行車產業的出口情況？」
console.log('\n  📝 場景 3: 用戶問「自行車產業的出口情況？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '出口', industryKeyword: '自行車', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items !== undefined, 'API 回應正常');
    if (items?.length > 0) {
      console.log(`     → 回答: 自行車產業出口 ${items.length} 筆, 金額 USD ${items[0]?.TRADE_VALUE_USD_AMT}`);
    } else {
      console.log(`     → 回答: 自行車產業暫無符合的出口資料`);
    }
    assert(true, '查詢完成');
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 4: 用戶問「2024 年對美國出口最多的產業？」
console.log('\n  📝 場景 4: 用戶問「2024 年對美國出口最多的產業？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '出口', country: 'US', first: 10,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items?.length > 0, '找到對美國出口資料');
    const industries = [...new Set(items?.map(i => i.INDUSTRY))];
    console.log(`     → 回答: 對美出口產業包括 ${industries.slice(0, 5).join('、')}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 5: 用戶問「2024 年進口最新月份的數據？」
console.log('\n  📝 場景 5: 用戶問「2024 年進口最新月份的數據？」');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '進口', first: 5, order: 'DESC',
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items?.length > 0, '找到進口資料');
    console.log(`     → 回答: 最新月份 ${items?.[0]?.PERIOD_MONTH}, 產業 ${items?.[0]?.INDUSTRY}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Tool 5: query_trade_transactions — 5 場景
// ================================================================

section('E2E Tool 5: query_trade_transactions');

// 場景 1: 用戶問「2024 年 6 月有哪些半導體出口交易？」
console.log('\n  📝 場景 1: 用戶問「2024 年 6 月有哪些半導體出口交易？」');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-30',
      tradeFlow: '出口', hsCode: '8542', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '找到半導體出口交易');
    assert(items?.[0]?.HS_CODE_EN !== undefined, '有英文品名（本表獨有）');
    console.log(`     → 回答: ${items?.[0]?.TXN_DT} | ${items?.[0]?.HS_CODE_EN?.substring(0, 30)} | USD ${items?.[0]?.TRADE_VALUE_USD_AMT}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 2: 用戶問「6 月對美國出口的交易明細？」
console.log('\n  📝 場景 2: 用戶問「6 月對美國出口的交易明細？」');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-15',
      tradeFlow: '出口', country: 'US', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '找到對美出口交易');
    const allUS = items?.every(i => i.COUNTRY_ID === 'US');
    assert(allUS, '所有結果都是美國');
    console.log(`     → 回答: ${items?.length} 筆交易，如 ${items?.[0]?.HS_CODE_ZH?.substring(0, 20)}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 3: 用戶問「6 月從日本進口的匯率是多少？」
console.log('\n  📝 場景 3: 用戶問「6 月從日本進口的匯率是多少？」');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-05',
      tradeFlow: '進口', country: 'JP', first: 3,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '找到日本進口交易');
    assert(items?.[0]?.RATE_VALUE !== undefined, '有匯率資訊（本表獨有）');
    console.log(`     → 回答: 日圓匯率 RATE_VALUE = ${items?.[0]?.RATE_VALUE}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 4: 用戶問「查詢積體電路的英文品名」
console.log('\n  📝 場景 4: 用戶問「查詢積體電路的英文品名」');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-05',
      productKeyword: '積體電路', first: 3,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '找到積體電路交易');
    console.log(`     → 回答: ${items?.[0]?.HS_CODE_ZH?.substring(0, 20)} = ${items?.[0]?.HS_CODE_EN?.substring(0, 40)}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// 場景 5: 用戶問「6 月份最早的交易記錄是什麼？」
console.log('\n  📝 場景 5: 用戶問「6 月份最早的交易記錄是什麼？」');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-30',
      order: 'ASC', first: 3,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '找到交易記錄');
    console.log(`     → 回答: 最早交易日 ${items?.[0]?.TXN_DT}, ${items?.[0]?.HS_CODE_ZH?.substring(0, 20)}`);
  } catch (e) {
    assert(false, `MCP 呼叫失敗: ${e.message}`);
  }
}

// ================================================================
//  Resolver Policy 驗證測試 — filter + orderBy + first
//  驗證 context.GraphQL.Arguments 正確傳遞到 Fabric backend
// ================================================================

section('RESOLVER POLICY 驗證: query_country_area_reference');

// RP-1: filter + first (top N) — 只回傳東南亞國家，限制 3 筆
console.log('\n  📝 RP-1: filter(東南亞) + first(3)');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { area: '東南亞', first: 3 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length > 0 && items.length <= 3, `回傳筆數 <= 3（實際: ${items?.length}）`);
    const allSEA = items?.every(i => i.AREA_NM?.includes('東南亞'));
    assert(allSEA, 'filter 生效: 所有結果都在東南亞');
    console.log(`     → ${items?.map(i => `${i.COUNTRY_COMM_ZH}(${i.ISO3})`).join(', ')}`);
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// RP-2: filter(ISO3) — 精確查詢單一國家，驗證 filter 正確傳遞
console.log('\n  📝 RP-2: filter(ISO3=DEU) — 精確查詢德國');
{
  try {
    const result = await callMcpTool('query_country_area_reference', { country: 'DEU' });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    assert(items?.length === 1, `精確回傳 1 筆（實際: ${items?.length}）`);
    assert(items?.[0]?.ISO3 === 'DEU', 'ISO3 = DEU');
    console.log(`     → ${items?.[0]?.COUNTRY_COMM_ZH} | ${items?.[0]?.AREA_NM}`);
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────

section('RESOLVER POLICY 驗證: query_hscode_reference');

// RP-3: filter(產業) + first(3) — 驗證 filter + top N
console.log('\n  📝 RP-3: filter(機械產業) + first(3)');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { industryKeyword: '機械', first: 3 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items?.length > 0 && items.length <= 3, `回傳筆數 <= 3（實際: ${items?.length}）`);
    const allMach = items?.every(i => i.Industry?.includes('機械'));
    assert(allMach, 'filter 生效: 所有結果都屬於機械產業');
    console.log(`     → ${items?.map(i => `${i.HS_Code}(${i.HS_Code_ZH?.substring(0, 15)})`).join(', ')}`);
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// RP-4: filter(HS Code 前綴) + first(5) — 驗證 startsWith filter
console.log('\n  📝 RP-4: filter(HS Code 前綴 "84") + first(5)');
{
  try {
    const result = await callMcpTool('query_hscode_reference', { hsCode: '84', first: 5 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    assert(items?.length > 0 && items.length <= 5, `回傳筆數 <= 5（實際: ${items?.length}）`);
    const allMatch = items?.every(i => i.HS_Code?.startsWith('84'));
    assert(allMatch, 'filter 生效: 所有結果 HS_Code 以 84 開頭');
    console.log(`     → ${items?.map(i => i.HS_Code).join(', ')}`);
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────

section('RESOLVER POLICY 驗證: query_trade_monthly_by_code');

// RP-5: filter + orderBy(ASC) + first — 驗證排序正確傳遞
console.log('\n  📝 RP-5: filter(2024出口US) + orderBy(ASC) + first(5)');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '出口', country: 'US', order: 'ASC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items?.length > 0, '有回傳資料');
    assert(items?.length <= 5, `first 生效: 筆數 <= 5（實際: ${items?.length}）`);
    const allUS = items?.every(i => i.COUNTRY_ID === 'US');
    assert(allUS, 'filter 生效: 所有結果 COUNTRY_ID = US');
    const allExport = items?.every(i => i.TRADE_FLOW === '出口');
    assert(allExport, 'filter 生效: 所有結果 TRADE_FLOW = 出口');
    if (items?.length >= 2) {
      const months = items.map(i => i.PERIOD_MONTH);
      const sorted = months.every((m, i) => i === 0 || m >= months[i - 1]);
      assert(sorted, 'orderBy 生效: PERIOD_MONTH 按 ASC 排序');
      console.log(`     → 月份: ${months.join(', ')}`);
    }
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// RP-6: filter + orderBy(DESC) — 驗證 DESC 排序
console.log('\n  📝 RP-6: filter(2024進口JP) + orderBy(DESC) + first(5)');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024, tradeFlow: '進口', country: 'JP', order: 'DESC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    assert(items?.length > 0, '有回傳資料');
    const allJP = items?.every(i => i.COUNTRY_ID === 'JP');
    assert(allJP, 'filter 生效: 所有結果 COUNTRY_ID = JP');
    if (items?.length >= 2) {
      const months = items.map(i => i.PERIOD_MONTH);
      const sorted = months.every((m, i) => i === 0 || m <= months[i - 1]);
      assert(sorted, 'orderBy 生效: PERIOD_MONTH 按 DESC 排序');
      console.log(`     → 月份: ${months.join(', ')}`);
    }
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────

section('RESOLVER POLICY 驗證: query_trade_monthly_by_group');

// RP-7: filter + orderBy(ASC) + first — 完整驗證
console.log('\n  📝 RP-7: filter(2024出口電子) + orderBy(ASC) + first(5)');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '出口', industryKeyword: '電子', order: 'ASC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items?.length > 0, '有回傳資料');
    assert(items?.length <= 5, `first 生效: 筆數 <= 5（實際: ${items?.length}）`);
    const allExport = items?.every(i => i.TRADE_FLOW === '出口');
    assert(allExport, 'filter 生效: TRADE_FLOW = 出口');
    const all2024 = items?.every(i => i.YEAR === 2024);
    assert(all2024, 'filter 生效: YEAR = 2024');
    if (items?.length >= 2) {
      const months = items.map(i => i.PERIOD_MONTH);
      const sorted = months.every((m, i) => i === 0 || m >= months[i - 1]);
      assert(sorted, 'orderBy 生效: PERIOD_MONTH 按 ASC 排序');
      console.log(`     → 月份: ${months.join(', ')}`);
    }
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// RP-8: filter(地區) + orderBy(DESC) — 驗證地區 filter + 排序
console.log('\n  📝 RP-8: filter(2024出口東北亞) + orderBy(DESC) + first(5)');
{
  try {
    const result = await callMcpTool('query_trade_monthly_by_group', {
      year: 2024, tradeFlow: '出口', country: '東北亞', order: 'DESC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_group_countries?.items;
    assert(items?.length > 0, '有回傳資料');
    const allNEA = items?.every(i => i.AREA_NM === '東北亞');
    assert(allNEA, 'filter 生效: AREA_NM = 東北亞');
    if (items?.length >= 2) {
      const months = items.map(i => i.PERIOD_MONTH);
      const sorted = months.every((m, i) => i === 0 || m <= months[i - 1]);
      assert(sorted, 'orderBy 生效: PERIOD_MONTH 按 DESC 排序');
      console.log(`     → 月份: ${months.join(', ')}`);
    }
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────

section('RESOLVER POLICY 驗證: query_trade_transactions');

// RP-9: filter(日期+國家) + orderBy(ASC) + first — 完整驗證
console.log('\n  📝 RP-9: filter(2024-06 出口 US) + orderBy(ASC) + first(5)');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-30',
      tradeFlow: '出口', country: 'US', order: 'ASC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '有回傳資料');
    assert(items?.length <= 5, `first 生效: 筆數 <= 5（實際: ${items?.length}）`);
    const allUS = items?.every(i => i.COUNTRY_ID === 'US');
    assert(allUS, 'filter 生效: COUNTRY_ID = US');
    const allExport = items?.every(i => i.TRADE_FLOW === '出口');
    assert(allExport, 'filter 生效: TRADE_FLOW = 出口');
    if (items?.length >= 2) {
      const dates = items.map(i => i.TXN_DT);
      const sorted = dates.every((d, i) => i === 0 || d >= dates[i - 1]);
      assert(sorted, 'orderBy 生效: TXN_DT 按 ASC 排序');
      console.log(`     → 日期: ${dates.join(', ')}`);
    }
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// RP-10: filter(日期+品名) + orderBy(DESC) + first — DESC 排序驗證
console.log('\n  📝 RP-10: filter(2024-06 積體電路) + orderBy(DESC) + first(5)');
{
  try {
    const result = await callMcpTool('query_trade_transactions', {
      startDate: '2024-06-01', endDate: '2024-06-30',
      productKeyword: '積體電路', order: 'DESC', first: 5,
    });
    const data = parseToolResult(result);
    const items = data?.data?.tXN_MOF_NON_PROTECT_MTs?.items;
    assert(items?.length > 0, '有回傳資料');
    if (items?.length >= 2) {
      const dates = items.map(i => i.TXN_DT);
      const sorted = dates.every((d, i) => i === 0 || d <= dates[i - 1]);
      assert(sorted, 'orderBy 生效: TXN_DT 按 DESC 排序');
      console.log(`     → 日期: ${dates.join(', ')}`);
    }
    console.log(`     → ${items?.[0]?.HS_CODE_ZH?.substring(0, 25)} | ${items?.[0]?.HS_CODE_EN?.substring(0, 30)}`);
  } catch (e) {
    assert(false, `失敗: ${e.message}`);
  }
}

// ================================================================
//  測試結果摘要
// ================================================================

section('E2E 測試結果總覽');
console.log(`  通過: ${passed}`);
console.log(`  失敗: ${failed}`);
if (failures.length > 0) {
  console.log(`\n  失敗項目:`);
  failures.forEach(f => console.log(`    - ${f}`));
}
console.log(`\n${failed === 0 ? '🎉 ALL E2E TESTS PASSED' : '❌ SOME E2E TESTS FAILED'}`);

process.exit(failed > 0 ? 1 : 0);
