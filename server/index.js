// Kavach MCP server over Streamable HTTP (MCP spec 2025-11-25).
// Stateful sessions so the server can send elicitation requests back to the client.
import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { createKavachServer } from './mcp.js';
import { llmConfigured } from './assess.js';
import { ledger } from './spend.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const allowedHosts = process.env.ALLOWED_HOSTS?.split(',').map((s) => s.trim()).filter(Boolean);

const app = createMcpExpressApp({ host: HOST, ...(allowedHosts ? { allowedHosts } : {}) });
const sessions = new Map(); // sessionId -> transport

app.get('/health', (_req, res) => {
  res.json({ ok: true, protocol: LATEST_PROTOCOL_VERSION, sessions: sessions.size, bedrock: llmConfigured(), spend: ledger() });
});

app.post('/mcp', async (req, res) => {
  const sid = req.headers['mcp-session-id'];
  let transport = sid ? sessions.get(sid) : undefined;

  if (!transport) {
    if (sid || !isInitializeRequest(req.body)) {
      res.status(sid ? 404 : 400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: sid ? 'Session not found' : 'Bad Request: send initialize first' },
        id: null,
      });
      return;
    }
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => sessions.set(id, transport),
    });
    transport.onclose = () => transport.sessionId && sessions.delete(transport.sessionId);
    const server = createKavachServer();
    await server.connect(transport);
  }
  await transport.handleRequest(req, res, req.body);
});

// GET opens the server->client SSE stream; DELETE ends a session.
const bySession = async (req, res) => {
  const transport = sessions.get(req.headers['mcp-session-id']);
  if (!transport) return res.status(404).send('Session not found');
  await transport.handleRequest(req, res);
};
app.get('/mcp', bySession);
app.delete('/mcp', bySession);

app.listen(PORT, HOST, () => {
  console.log(`Kavach MCP server on http://${HOST}:${PORT}/mcp  (protocol ${LATEST_PROTOCOL_VERSION}, bedrock: ${llmConfigured() ? 'on' : 'off'})`);
});
