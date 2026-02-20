/**
 * 測試日誌記錄功能
 *
 * 測試 P3-7 和 P3-8 改進：
 * - P3-7: 請求日誌記錄
 * - P3-8: 錯誤訊息完整化
 */

import { logger } from './src/utils/logger.js';
import { executeGraphQL } from './src/utils/graphql-client.js';
import { config } from './src/utils/config.js';

console.log('='.repeat(60));
console.log('測試 P3-7: 請求日誌記錄 & P3-8: 錯誤訊息完整化');
console.log('='.repeat(60));

// 測試 1: 檢查日誌級別
console.log('\n[測試 1] 檢查日誌級別...');
console.log('環境變數 LOG_LEVEL:', process.env.LOG_LEVEL || '未設定 (預設 info)');
console.log('預期: info');

// 測試 2: 測試不同的日誌級別
console.log('\n[測試 2] 測試不同日誌級別...');
logger.debug('這是 DEBUG 訊息（只在 LOG_LEVEL=debug 時顯示）');
logger.info('這是 INFO 訊息');
logger.warn('這是 WARN 訊息');
logger.error('這是 ERROR 訊息');

// 測試 3: 測試結構化日誌
console.log('\n[測試 3] 測試結構化日誌...');
logger.info({
  type: 'test',
  userId: 'user-123',
  action: 'login',
  duration: 45,
}, '用戶登入成功');

// 測試 4: 測試 GraphQL 請求日誌（如果配置存在）
if (config.graphqlEndpoint && config.subscriptionKey) {
  console.log('\n[測試 4] 測試 GraphQL 請求日誌...');

  // 測試 4.1: 成功請求
  try {
    console.log('  4.1. 測試成功請求...');
    const result = await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query: `{
        __schema {
          types {
            name
          }
        }
      }`,
    });
    console.log('  ✅ 成功請求測試完成（請檢查日誌輸出）');
  } catch (err) {
    console.log('  ❌ 成功請求測試失敗:', err.message);
  }

  // 測試 4.2: 測試 HTTP 錯誤（無效的端點）
  try {
    console.log('  4.2. 測試 HTTP 錯誤處理...');
    await executeGraphQL({
      endpoint: 'https://invalid-endpoint.example.com/graphql',
      subscriptionKey: config.subscriptionKey,
      query: `{ test }`,
    });
  } catch (err) {
    console.log('  ✅ HTTP 錯誤測試完成');
    console.log('  錯誤類型:', err.name);
    console.log('  錯誤訊息:', err.message);
    if (err.status) console.log('  HTTP 狀態:', err.status);
    if (err.details) console.log('  錯誤詳情:', err.details);
  }

  // 測試 4.3: 測試 GraphQL 語法錯誤
  try {
    console.log('  4.3. 測試 GraphQL 語法錯誤處理...');
    await executeGraphQL({
      endpoint: config.graphqlEndpoint,
      subscriptionKey: config.subscriptionKey,
      query: `{ invalidQuerySyntax }`,
    });
  } catch (err) {
    console.log('  ✅ GraphQL 錯誤測試完成');
    console.log('  錯誤類型:', err.name);
    console.log('  錯誤訊息:', err.message);
    if (err.graphqlErrors) {
      console.log('  GraphQL 錯誤數量:', err.graphqlErrors.length);
      console.log('  GraphQL 錯誤詳情:', JSON.stringify(err.graphqlErrors, null, 2));
    }
  }
} else {
  console.log('\n[測試 4] 跳過 GraphQL 請求測試（缺少 APIM 設定）');
  console.log('  請設定 .env 中的 APIM_GRAPHQL_ENDPOINT 和 APIM_SUBSCRIPTION_KEY');
}

console.log('\n' + '='.repeat(60));
console.log('測試完成！');
console.log('='.repeat(60));
