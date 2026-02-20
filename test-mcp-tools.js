#!/usr/bin/env node

/**
 * 简单测试脚本：测试 MCP 工具功能
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'agitated-tharp/docs-samples/data-engineering/GraphQL/MCP/.env') });

import { executeGraphQL } from './agitated-tharp/docs-samples/data-engineering/GraphQL/MCP/src/utils/graphql-client.js';
import { config } from './agitated-tharp/docs-samples/data-engineering/GraphQL/MCP/src/utils/config.js';

async function testQuery(name, query) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`Query: ${query.substring(0, 100)}...`);

  try {
    const startTime = Date.now();
    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query,
    });
    const duration = Date.now() - startTime;

    console.log(`✅ Success (${duration}ms)`);
    console.log(`Result keys:`, Object.keys(result.data || {}));
    return { success: true, duration };
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🧪 Starting MCP Tool Tests...\n');
  console.log(`APIM Endpoint: ${config.graphqlEndpoint}`);
  console.log(`Subscription Key: ${config.subscriptionKey.substring(0, 10)}...`);

  const tests = [
    {
      name: 'HS Code Reference Query',
      query: `query {
        hscode_reference(first: 5) {
          HS_CODE
          HS_CODE_ZH
          HS_CODE_EN
        }
      }`,
    },
    {
      name: 'Country Reference Query',
      query: `query {
        country_area_reference(first: 3) {
          COUNTRY_ID
          COUNTRY_COMM_ZH
          AREA_NM
        }
      }`,
    },
    {
      name: 'Trade Monthly Totals Query',
      query: `query {
        trade_monthly_totals(filter: { YEAR: { eq: 2024 } }, first: 5) {
          YEAR
          MONTH
          TRADE_FLOW
          TRADE_VALUE_USD_AMT
        }
      }`,
    },
  ];

  const results = [];

  for (const test of tests) {
    const result = await testQuery(test.name, test.query);
    results.push({ name: test.name, ...result });
  }

  console.log('\n📊 Test Summary:');
  console.log('─'.repeat(50));

  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const duration = result.duration ? `${result.duration}ms` : 'N/A';
    console.log(`  ${icon} ${result.name} - ${duration}`);
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log('\n📈 Total Results:');
  console.log(`  ✅ Passed: ${successCount}/${results.length}`);
  console.log(`  ❌ Failed: ${failCount}/${results.length}`);

  if (failCount > 0) {
    console.log('\n⚠️  Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

main().catch(console.error);
