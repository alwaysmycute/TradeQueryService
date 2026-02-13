/**
 * Schema Cache Manager
 *
 * 提供 GraphQL schema 的快取機制，支援：
 * 1. 記憶體快取 (Memory Cache) - 行程內快取，最快速
 * 2. 本地檔案快取 (File Cache) - 持久化到磁碟，跨行程可用
 * 3. TTL 過期機制 - 預設 24 小時自動過期，可設定
 *
 * Schema introspection 資料量大(~110KB)，快取機制可大幅減少網路請求。
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 預設快取目錄
const DEFAULT_CACHE_DIR = join(__dirname, '..', 'cache');
// 預設 schema 快取檔案
const DEFAULT_CACHE_FILE = join(DEFAULT_CACHE_DIR, 'schema_cache.json');
// 預設 TTL: 24 小時 (毫秒)
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// 記憶體快取
let memoryCache = null;
let memoryCacheTimestamp = null;

/**
 * 取得快取的 schema
 *
 * 優先順序：記憶體快取 > 本地檔案快取 > null
 *
 * @param {Object} [options]
 * @param {number} [options.ttlMs] - 快取 TTL (毫秒)，預設 24 小時
 * @param {string} [options.cacheFile] - 自訂快取檔案路徑
 * @returns {Promise<Object|null>} 快取的 schema 資料，若過期或不存在則回傳 null
 */
export async function getCachedSchema(options = {}) {
  const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  const cacheFile = options.cacheFile || DEFAULT_CACHE_FILE;

  // 1. 優先使用記憶體快取
  if (memoryCache && memoryCacheTimestamp) {
    if (Date.now() - memoryCacheTimestamp < ttlMs) {
      return memoryCache;
    }
    // 過期，清除記憶體快取
    memoryCache = null;
    memoryCacheTimestamp = null;
  }

  // 2. 嘗試從本地檔案讀取
  try {
    if (existsSync(cacheFile)) {
      const raw = await readFile(cacheFile, 'utf-8');
      const cached = JSON.parse(raw);

      if (cached._cachedAt && (Date.now() - cached._cachedAt < ttlMs)) {
        // 檔案快取有效，同時更新記憶體快取
        memoryCache = cached.schema;
        memoryCacheTimestamp = cached._cachedAt;
        return cached.schema;
      }
    }
  } catch {
    // 檔案讀取失敗，忽略
  }

  return null;
}

/**
 * 儲存 schema 到快取
 *
 * 同時更新記憶體快取與本地檔案快取
 *
 * @param {Object} schema - GraphQL introspection schema 資料
 * @param {Object} [options]
 * @param {string} [options.cacheFile] - 自訂快取檔案路徑
 * @returns {Promise<void>}
 */
export async function setCachedSchema(schema, options = {}) {
  const cacheFile = options.cacheFile || DEFAULT_CACHE_FILE;
  const now = Date.now();

  // 更新記憶體快取
  memoryCache = schema;
  memoryCacheTimestamp = now;

  // 寫入本地檔案
  try {
    const cacheDir = dirname(cacheFile);
    if (!existsSync(cacheDir)) {
      await mkdir(cacheDir, { recursive: true });
    }
    await writeFile(
      cacheFile,
      JSON.stringify({ _cachedAt: now, schema }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Warning: Failed to write schema cache file:', err.message);
  }
}

/**
 * 清除所有快取
 *
 * @returns {void}
 */
export function clearCache() {
  memoryCache = null;
  memoryCacheTimestamp = null;
}

/**
 * 取得快取狀態資訊
 *
 * @returns {Object} 快取狀態
 */
export function getCacheStatus() {
  return {
    hasMemoryCache: !!memoryCache,
    memoryCacheAge: memoryCacheTimestamp ? Date.now() - memoryCacheTimestamp : null,
    memoryCacheTimestamp: memoryCacheTimestamp ? new Date(memoryCacheTimestamp).toISOString() : null,
  };
}
