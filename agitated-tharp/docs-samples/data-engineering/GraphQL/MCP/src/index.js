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

// 驗證設定
validateConfig();

const app = express();
app.use(express.json());

// Session 管理
const sessions = new Map();
let sessionCounter = 0;

function generateSessionId() {
  return `session-${++sessionCounter}`;
}

// MCP 端點
app.post('/mcp', async (req, res) => {
  try {
    const server = createMcpServer();

    const sessionManager = {
      sessionIdGenerator: generateSessionId,
      getSession: (sessionId) => sessions.get(sessionId),
      createSession: (sessionId) => {
        const session = { id: sessionId, created: Date.now() };
        sessions.set(sessionId, session);
        return session;
      },
      deleteSession: (sessionId) => {
        sessions.delete(sessionId);
      },
    };

    const transport = new StreamableHTTPServerTransport({ sessionManager });

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

// 健康檢查端點
app.get('/health', (req, res) => {
  const cacheStatus = getCacheStatus();
  res.json({
    status: 'healthy',
    server: 'Taiwan Trade Analytics MCP Server',
    version: '2.0.0',
    tools: getToolNames(),
    schemaCache: cacheStatus,
    endpoint: config.graphqlEndpoint ? 'configured' : 'missing',
  });
});

// 啟動伺服器
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Taiwan Trade Analytics MCP Server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`APIM endpoint: ${config.graphqlEndpoint ? 'configured' : '⚠️ NOT CONFIGURED'}`);
  console.log(`Tools: ${getToolNames().join(', ')}`);
});
