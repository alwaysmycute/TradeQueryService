#!/usr/bin/env node

/**
 * 验证脚本：检查所有工具文件的 handler 函数状态
 */

const fs = require('fs');
const path = require('path');

const TOOLS_DIR = '/home/node/.openclaw/workspace/TradeQueryService/agitated-tharp/docs-samples/data-engineering/GraphQL/MCP/src/tools';

const TOOL_FILES = [
  'query-country-area-reference.js',
  'query-graphql.js',
  'query-hscode-reference.js',
  'query-trade-monthly-by-code.js',
  'query-trade-monthly-by-countries.js',
  'query-trade-monthly-by-group.js',
  'query-trade-monthly-growth-by-countries.js',
  'query-trade-monthly-growth.js',
  'query-trade-monthly-share-by-countries.js',
  'query-trade-monthly-totals.js',
  'query-trade-transactions.js',
  'query-trade-yearly-by-countries.js',
  'query-trade-yearly-growth.js',
  'query-trade-yearly-share-by-countries.js',
  'query-trade-yearly-totals.js',
];

function checkHandlerFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 检查是否有 handler 函数
  const handlerMatch = content.match(/export async function handler\(params\)\s*\{/);

  if (!handlerMatch) {
    return { status: 'NO_HANDLER', message: 'No handler function found' };
  }

  // 检查 handler 是否调用 execute
  const executeCallMatch = content.match(/export async function handler\(params\)\s*\{[\s\S]*?return execute\(params\);/s);

  if (executeCallMatch) {
    return { status: 'BROKEN', message: 'Handler calls undefined execute()' };
  }

  // 检查 handler 是否有完整实现
  const hasExecuteGraphQL = content.includes('executeGraphQL({');
  const hasBuildQuery = content.includes('buildQuery(');
  const hasTryCatch = content.includes('try {') && content.includes('} catch (err)');

  if (hasExecuteGraphQL && hasBuildQuery && hasTryCatch) {
    return { status: 'FIXED', message: 'Handler has full implementation' };
  }

  return { status: 'UNKNOWN', message: 'Handler status unclear' };
}

async function main() {
  console.log('🔍 Verifying tool files...\n');

  let fixedCount = 0;
  let brokenCount = 0;
  let otherCount = 0;

  for (const toolFile of TOOL_FILES) {
    const filePath = path.join(TOOLS_DIR, toolFile);
    const check = checkHandlerFile(filePath);

    const icon = {
      'FIXED': '✓',
      'BROKEN': '✗',
      'NO_HANDLER': '⚠',
      'UNKNOWN': '?'
    }[check.status];

    console.log(`  ${icon} ${toolFile} - ${check.message}`);

    if (check.status === 'FIXED') fixedCount++;
    else if (check.status === 'BROKEN') brokenCount++;
    else otherCount++;
  }

  console.log('\n📊 Summary:');
  console.log(`  ✓ Fixed: ${fixedCount}`);
  console.log(`  ✗ Broken: ${brokenCount}`);
  console.log(`  ? Other: ${otherCount}`);

  if (brokenCount > 0) {
    console.log('\n❌ Some tools are still broken!');
    process.exit(1);
  } else {
    console.log('\n✅ All tools are fixed!');
  }
}

main().catch(console.error);
