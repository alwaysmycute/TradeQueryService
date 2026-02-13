/**
 * Azure Function: MCP Endpoint
 *
 * 將 MCP Server 部署為 Azure Function App 的 HTTP Trigger。
 * 支援 Streamable HTTP 傳輸協議，可作為 Remote MCP Server 使用。
 *
 * Azure Function App 部署步驟：
 * 1. 建立 Azure Function App (Node.js 20 LTS, Linux)
 * 2. 在 Application Settings 中設定環境變數：
 *    - APIM_GRAPHQL_ENDPOINT: APIM GraphQL API URL
 *    - APIM_SUBSCRIPTION_KEY: APIM Subscription Key
 * 3. 部署此函數
 *
 * 端點：
 *   POST /api/mcp - MCP 協議端點
 *   GET  /api/health - 健康檢查
 */

import { app } from '@azure/functions';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../../src/server.js';
import { getCacheStatus } from '../../src/utils/schema-cache.js';
import { getToolNames } from '../../src/tools/index.js';

// MCP 端點 - HTTP Trigger
app.http('mcp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mcp',
  handler: async (request, context) => {
    context.log('MCP request received');

    try {
      const server = createMcpServer();
      const body = await request.json();

      // 建立一次性 transport 處理請求
      const transport = new StreamableHTTPServerTransport({
        sessionManager: {
          sessionIdGenerator: () => `az-session-${Date.now()}`,
          getSession: () => null,
          createSession: (id) => ({ id, created: Date.now() }),
          deleteSession: () => {},
        },
      });

      await server.connect(transport);

      // 將 Azure Function 請求轉換為 Express-like 格式
      const result = await new Promise((resolve, reject) => {
        const mockRes = {
          _statusCode: 200,
          _headers: {},
          _body: null,
          _chunks: [],

          status(code) {
            this._statusCode = code;
            return this;
          },
          setHeader(key, value) {
            this._headers[key] = value;
            return this;
          },
          writeHead(code, headers) {
            this._statusCode = code;
            if (headers) Object.assign(this._headers, headers);
            return this;
          },
          write(chunk) {
            this._chunks.push(chunk);
            return true;
          },
          end(data) {
            if (data) this._chunks.push(data);
            this._body = this._chunks.join('');
            resolve(this);
          },
          json(data) {
            this._headers['Content-Type'] = 'application/json';
            this._body = JSON.stringify(data);
            resolve(this);
          },
          on() { return this; },
          once() { return this; },
          emit() { return this; },
          get headersSent() { return false; },
        };

        const mockReq = {
          method: 'POST',
          headers: Object.fromEntries(request.headers.entries()),
          body,
        };

        transport.handleRequest(mockReq, mockRes, body)
          .catch(reject);
      });

      transport.close();

      return {
        status: result._statusCode,
        headers: {
          'Content-Type': result._headers['Content-Type'] || 'application/json',
        },
        body: result._body,
      };
    } catch (err) {
      context.log.error('MCP request error:', err);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal server error',
          details: err.message,
        }),
      };
    }
  },
});

// 健康檢查端點
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (request, context) => {
    const cacheStatus = getCacheStatus();
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'healthy',
        server: 'Taiwan Trade Analytics MCP Server (Azure Function)',
        version: '2.0.0',
        tools: getToolNames(),
        schemaCache: cacheStatus,
        runtime: 'Azure Functions',
      }),
    };
  },
});
