/**
 * Quick test script to verify 3 tools are working correctly
 */

const MCP_ENDPOINT = 'http://localhost:3000/mcp';

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
    return null;
  }
}

async function testTools() {
  console.log('='.repeat(60));
  console.log('Testing 3 tools...');
  console.log('='.repeat(60));

  // Test 1: query_country_area_reference
  console.log('\nTest 1: query_country_area_reference');
  try {
    const result = await callMcpTool('query_country_area_reference', { country: '美國' });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_COUNTRY_AREAs?.items;
    if (items && items.length > 0 && items[0]?.ISO3 === 'USA') {
      console.log('✓ PASS - Found USA: ' + items[0]?.ISO3);
    } else {
      console.log('✗ FAIL - Expected to find USA');
    }
  } catch (e) {
    console.log('✗ FAIL - ' + e.message);
  }

  // Test 2: query_hscode_reference
  console.log('\nTest 2: query_hscode_reference');
  try {
    const result = await callMcpTool('query_hscode_reference', { hsCode: '8542', first: 5 });
    const data = parseToolResult(result);
    const items = data?.data?.uNION_REF_HSCODEs?.items;
    if (items && items.length > 0 && items[0]?.HS_Code?.startsWith('8542')) {
      console.log('✓ PASS - Found HS Codes starting with 8542');
      console.log('  Example: ' + items[0]?.HS_Code_ZH?.substring(0, 40));
    } else {
      console.log('✗ FAIL - Expected to find HS Codes');
    }
  } catch (e) {
    console.log('✗ FAIL - ' + e.message);
  }

  // Test 3: query_trade_monthly_by_code
  console.log('\nTest 3: query_trade_monthly_by_code');
  try {
    const result = await callMcpTool('query_trade_monthly_by_code', {
      year: 2024,
      tradeFlow: '出口',
      hsCode: '8542',
      first: 2
    });
    const data = parseToolResult(result);
    const items = data?.data?.trade_monthly_by_code_countries?.items;
    if (items && items.length > 0 && items[0]?.TRADE_FLOW === '出口') {
      console.log('✓ PASS - Found export data');
      console.log('  Example: ' + items[0]?.COUNTRY_COMM_ZH + ' - ' + items[0]?.HS_CODE_ZH?.substring(0, 30));
    } else {
      console.log('✗ FAIL - Expected to find export data');
    }
  } catch (e) {
    console.log('✗ FAIL - ' + e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Testing complete!');
  console.log('='.repeat(60));
}

testTools().catch(console.error);
