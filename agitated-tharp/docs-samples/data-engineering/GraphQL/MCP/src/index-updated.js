/**
 * Standalone Express Server Entry Point
 *
 * 本地開發與獨立部署用的啟動入口。
 * 提供 MCP over Streamable HTTP 傳輸 + Health Check 端點。
 *
 * 啟動方式：
 *   node src/index.js
 *
 * 端點：
 *   POST /mcp - MCP 協議端點（Streamable HTTP）
 *   GET  /health - 健康檢查端點
 */

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';
import { config, validateConfig } from './utils/config.js';
import { getCacheStatus } from './utils/schema-cache.js';
import { getToolNames } from './tools/index.js';

// 驗證配置
validateConfig();

const app = express();
app.use(express.json());

// ═════════════════════════════════════════════════════════════════════════
// Session 管理配置
// ═════════════════════════════════════════════════════════════════════════

const SESSION_CONFIG = {
  // Session TTL（過期時間），預設 1 小時
  ttlMs: parseInt(process.env.SESSION_TTL_MS) || 60 * 60 * 1000,
  
  // 清理頻率，預設每 10 分鐘清理一次
  cleanupIntervalMs: parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS) || 10 * 60 * 1000,
  
  // 最大 session 數量（LRU 策略），預設 1000
  maxSessions: parseInt(process.env.SESSION_MAX_SESSIONS) || 1000,
};

// Session 數據結構
interface SessionData {
  id: string;
  created: number;
  lastAccessed: number;
}

// Session 管理類
class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private sessionCounter: number = 0;
  private accessOrder: string[] = new Array(); // LRU access order
  
  /**
   * 生成唯一的 session ID
   */
  generateSessionId(): string {
    return `session-${++this.sessionCounter}`;
  }

  /**
   * 創建新的 session
   */
  createSession(sessionId?: string): SessionData {
    const id = sessionId || this.generateSessionId();
    const now = Date.now();
    const session: SessionData = {
      id,
      created: now,
      lastAccessed: now,
    };
    
    this.sessions.set(id, session);
    this.updateAccessOrder(id);
    
    // 檢查是否超過最大 session 數量
    this.enforceMaxSessions();
    
    return session;
  }

  /**
   * 獲取 session
   */
  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // 檢查是否過期
      if (this.isSessionExpired(session)) {
        this.deleteSession(sessionId);
        return undefined;
      }
      
      // 更新最後訪問時間
      session.lastAccessed = Date.now();
      this.updateAccessOrder(sessionId);
      
      return session;
    }
    
    return undefined;
  }

  /**
   * 刪除 session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.removeFromAccessOrder(sessionId);
  }

  /**
   * 檢查 session 是否過期
   */
  private isSessionExpired(session: SessionData): boolean {
    const now = Date.now();
    return (now - session.lastAccessed) > SESSION_CONFIG.ttlMs;
  }

  /**
   * 清理所有過期的 session
   */
  cleanupExpiredSessions(): number {
    let cleanedCount = 0;
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [id, session] of this.sessions.entries()) {
      if ((now - session.lastAccessed) > SESSION_CONFIG.ttlMs) {
        expiredSessions.push(id);
      }
    }
    
    // 刪除過期的 session
    for (const id of expiredSessions) {
      this.sessions.delete(id);
      this.removeFromAccessOrder(id);
      cleanedCount++;
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
    
    return cleanedCount;
  }

  /**
   * 強制執行最大 session 數量限制（LRU 策略）
   */
  private enforceMaxSessions(): void {
    while (this.sessions.size > SESSION_CONFIG.maxSessions) {
      // 移除最久未訪問的 session
      if (this.accessOrder.length > 0) {
        const oldestSessionId = this.accessOrder.shift();
        if (oldestSessionId) {
          this.sessions.delete(oldestSessionId);
          console.log(`🔄 Evicted oldest session: ${oldestSessionId} (LRU)`);
        }
      } else {
        break;
      }
    }
  }

  /**
   * 更新訪問順序（移到末尾，表示最近訪問）
   */
  private updateAccessOrder(sessionId: string): void {
    // 從現有位置移除
    const index = this.accessOrder.indexOf(sessionId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // 添加到末尾
    this.accessOrder.push(sessionId);
  }

  /**
   * 從訪問順序中移除
   */
  private removeFromAccessOrder(sessionId: string): void {
    const index = this.accessOrder.indexOf(sessionId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * 獲取 session 統計資訊
   */
  getStats(): { totalSessions: number; activeSessions: number; maxSessions: number; ttlMs: number } {
    const now = Date.now();
    let activeCount = 0;
    
    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session)) {
        activeCount++;
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeCount,
      maxSessions: SESSION_CONFIG.maxSessions,
      ttlMs: SESSION_CONFIG.ttlMs,
    };
  }

  /**
   * 清除所有 session
   */
  clearAll(): void {
    this.sessions.clear();
    this.accessOrder.length = 0;
    console.log('🧹 Cleared all sessions');
  }
}

// 創建 session manager 實例
const sessionManager = new SessionManager();

// 啟動定時清理任務
const cleanupTask = setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, SESSION_CONFIG.cleanupIntervalMs);

console.log(`✅ Session cleanup task scheduled (every ${SESSION_CONFIG.cleanupIntervalMs / 1000 / 60} minutes)`);

// ═════════════════════════════════════════════════════════════════════════
// MCP 端點
// ═════════════════════════════════════════════════════════════════════════

app.post('/mcp', async (req, res) => {
  try {
    const server = createMcpServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionManager.generateSessionId(),
      getSession: (sessionId) => sessionManager.getSession(sessionId),
      createSession: (sessionId) => sessionManager.createSession(sessionId),
      deleteSession: (sessionId) => sessionManager.deleteSession(sessionId),
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on('close', () => {
      transport.close();
    });
  } catch (err) {
    console.error('Error handling MCP request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        details: err.message,
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 健康檢查端點（增強版）
// ═════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  const cacheStatus = getCacheStatus();
  const sessionStats = sessionManager.getStats();
  
  res.json({
    status: 'healthy',
    server: 'Taiwan Trade Analytics MCP Server',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    
    // Session 統計
    session: {
      total: sessionStats.totalSessions,
      active: sessionStats.activeSessions,
      max: sessionStats.maxSessions,
      ttl: `${SESSION_CONFIG.ttlMs / 1000}s`,
      cleanup: `${SESSION_CONFIG.cleanupIntervalMs / 1000 / 60}min`,
    },
    
    // 工具列表
    tools: {
      count: getToolNames().length,
      names: getToolNames(),
    },
    
    // 快取狀態
    cache: {
      hasMemoryCache: cacheStatus.hasMemoryCache,
      memoryCacheAge: cacheStatus.memoryCacheAge ? `${cacheStatus.memoryCacheAge / 1000}s` : null,
    },
    
    // APIM 配置
    apim: {
      endpoint: config.graphqlEndpoint ? 'configured' : 'missing',
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 管理端點（新增）
// ═════════════════════════════════════════════════════════════════════════

// 手動清理過期 session
app.post('/admin/sessions/cleanup', (req, res) => {
  try {
    const cleanedCount = sessionManager.cleanupExpiredSessions();
    res.json({
      success: true,
      cleaned: cleanedCount,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 清除所有 session（謹慎使用）
app.post('/admin/sessions/clear', (req, res) => {
  try {
    sessionManager.clearAll();
    res.json({
      success: true,
      message: 'All sessions cleared',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// 優雅關閉
// ═════════════════════════════════════════════════════════════════════════

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  clearInterval(cleanupTask);
  console.log('🧹 Cleanup task stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  clearInterval(cleanupTask);
  console.log('🧹 Cleanup task stopped');
  process.exit(0);
});

// ═════════════════════════════════════════════════════════════════════════
// 啟動伺服器
// ═════════════════════════════════════════════════════════════════════════

const PORT = config.port;
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Taiwan Trade Analytics MCP Server                 ║');
  console.log('║     v2.1.0 - Session Management Enhanced              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🔗 MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`💚 Health Check:  http://localhost:${PORT}/health`);
  console.log(`🧹 Admin:         http://localhost:${PORT}/admin/sessions/...`);
  console.log('');
  console.log(`📊 Session Config:`);
  console.log(`   - TTL: ${SESSION_CONFIG.ttlMs / 1000}s`);
  console.log(`   - Cleanup: ${SESSION_CONFIG.cleanupIntervalMs / 1000 / 60}min`);
  console.log(`   - Max Sessions: ${SESSION_CONFIG.maxSessions} (LRU)`);
  console.log('');
  console.log(`📦 Tools: ${getToolNames().length}`);
  console.log(`   ${getToolNames().slice(0, 5).join(', ')}${getToolNames().length > 5 ? `... (${getToolNames().length - 5} more)` : ''}`);
  console.log('');
  console.log(`🔌 APIM Endpoint: ${config.graphqlEndpoint || '⚠️ NOT CONFIGURED'}`);
  console.log('');
});
