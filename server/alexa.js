// Simulated Alexa+ host for the demo web app.
//
// The browser plays the part of an Alexa+ device. For every browser session this module
// runs a REAL MCP client that connects to Kavach's own /mcp endpoint over Streamable HTTP,
// exactly as Alexa+ would connect to a self-hosted MCP server. Everything the UI shows
// (tool calls, elicitation prompts, raw JSON-RPC) comes from that live protocol session.
//
// Agent brain:
//   - KAVACH_LLM=bedrock -> Amazon Bedrock Converse with the MCP tools as tool specs (agentic loop)
//   - otherwise          -> a small deterministic intent router (free, offline)
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { alertBus } from './notify.js';
import { household, resetEvents } from './store.js';
import { llmConfigured } from './assess.js';
import { canSpend, record } from './spend.js';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
const ELICIT_TIMEOUT_MS = 90_000;
const sessions = new Map(); // sid -> session
const streams = new Set(); // all SSE responses (for broadcast)

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function emit(s, event, data) {
  // Keep protocol messages sent before the browser connected (initialize, tools/list) to replay.
  if (!s.streams.size && event === 'rpc') (s.backlog ??= []).push(data);
  for (const res of s.streams) send(res, event, data);
}
alertBus.on('alert', (a) => {
  for (const res of streams) send(res, 'alert', a);
});

async function getSession(sid, mcpUrl) {
  let s = sessions.get(sid);
  if (s?.client) return s;
  s ??= { sid, streams: new Set(), pending: new Map(), history: [] };
  sessions.set(sid, s);

  const client = new Client(
    { name: 'alexa-plus-simulator', title: 'Alexa+ (simulated)', version: '1.0.0' },
    { capabilities: { elicitation: { form: {} } } },
  );
  // Consent requests from the Kavach server are shown on the device and answered by voice or tap.
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    const id = randomUUID();
    const props = req.params.requestedSchema?.properties || {};
    const field = Object.keys(props)[0] || 'confirm';
    emit(s, 'elicit', { id, message: req.params.message, title: props[field]?.title || 'Confirm' });
    const answer = await new Promise((resolve) => {
      s.pending.set(id, resolve);
      setTimeout(() => s.pending.has(id) && (s.pending.delete(id), resolve(null)), ELICIT_TIMEOUT_MS);
    });
    emit(s, 'elicit_done', { id, answer });
    if (answer === null) return { action: 'cancel' };
    return answer ? { action: 'accept', content: { [field]: true } } : { action: 'decline' };
  });

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  const rawSend = transport.send.bind(transport);
  transport.send = (msg, opts) => {
    emit(s, 'rpc', { dir: 'out', msg });
    return rawSend(msg, opts);
  };
  await client.connect(transport);
  const rawOnMessage = transport.onmessage;
  transport.onmessage = (msg, extra) => {
    emit(s, 'rpc', { dir: 'in', msg });
    rawOnMessage?.(msg, extra);
  };

  s.client = client;
  s.transport = transport;
  s.tools = (await client.listTools()).tools;
  s.info = {
    protocol: transport.protocolVersion,
    sessionId: transport.sessionId,
    server: client.getServerVersion(),
    tools: s.tools.map((t) => t.name),
    brain: llmConfigured() ? `Amazon Bedrock (${MODEL_ID})` : 'intent router (offline)',
  };
  return s;
}

// ------------------------------------------------------------------ tool execution
async function callTool(s, name, args) {
  emit(s, 'tool_call', { name, args });
  const t0 = Date.now();
  const res = await s.client.callTool({ name, arguments: args });
  const result = { name, ms: Date.now() - t0, text: res.content?.map((c) => c.text).join(' '), structured: res.structuredContent ?? null, isError: !!res.isError };
  emit(s, 'tool_result', result);
  return result;
}

// ------------------------------------------------------------------ offline intent router
const FEELING = [
  [/\b(not (feeling )?(well|good|great)|unwell|sick|dizzy|pain|fever|tired|weak|bp (is )?high|lonely|sad)\b/i, 'not_good'],
  [/\b(okay|ok|alright|so so|not bad)\b/i, 'okay'],
  [/\b(fine|good|great|well|happy|wonderful)\b/i, 'good'],
];
const SCAMMY = /\b(call(ed)?|message|sms|text|whatsapp|email|said|says|told|asked|someone|man|lady|officer|link|otp|pay|money|transfer|police|bank|parcel|prize|won|arrest)\b/i;

async function routeOffline(s, utterance, persona) {
  const stripped = utterance.replace(/^\s*(hey\s+)?alexa[,\s]*/i, '').trim();
  const u = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  if (persona === 'family' || /\bhow('?s| is| has)\b.*\b(mom|mum|aai|aaji|amma|dad|nani|dadi|grandma|she|her)\b|\bweekly update\b|\banything suspicious\b/i.test(u)) {
    const m = u.match(/\b(\d+)\s*days?\b/);
    const r = await callTool(s, 'family_digest', { days: m ? Number(m[1]) : /month/i.test(u) ? 30 : 7 });
    return r.text;
  }
  const alertMatch = u.match(/\b(tell|call|message|inform|alert|let)\b.*\b(rohan|my son|son|family|my daughter)\b/i);
  if (alertMatch && u.split(/\s+/).length < 16 && !SCAMMY.test(u.replace(alertMatch[0], ''))) {
    const r = await callTool(s, 'alert_family', { reason: `Aaji asked Kavach to reach you: "${u}"`, urgency: 'normal' });
    return r.text;
  }
  const isGreetingOrFeeling = /\b(good morning|good evening|i('m| am)\b.*\b(feel|feeling|fine|well|okay|good|tired|sick|unwell)|feeling)\b/i.test(u);
  if (isGreetingOrFeeling && !SCAMMY.test(u)) {
    const feeling = FEELING.find(([re]) => re.test(u))?.[1] || 'okay';
    const r = await callTool(s, 'daily_checkin', { feeling, note: u });
    return r.text;
  }
  const r = await callTool(s, 'check_message', { text: u });
  return r.structured?.spoken || r.text;
}

// ------------------------------------------------------------------ Bedrock agent
let bedrock;
const SYSTEM = `You are Alexa+, a warm voice assistant in the home of an older adult called Aaji. The Kavach skill is connected and gives you tools.
Rules:
- If she describes ANY call, message, visitor or request involving money, codes, threats, prizes, police, banks or personal details, call check_message with her words. Then repeat the tool's "spoken" text calmly; do not add new facts.
- If she says how she feels or greets you, call daily_checkin.
- If a family member asks how she is doing, call family_digest.
- If she asks you to tell or call family, call alert_family.
- Answer in at most three short spoken sentences. No lists, no markdown.`;

function toolSpecs(tools) {
  return tools.map((t) => ({
    toolSpec: { name: t.name, description: t.description, inputSchema: { json: (({ $schema, ...rest }) => rest)(t.inputSchema) } },
  }));
}

async function routeBedrock(s, utterance, persona) {
  bedrock ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const who = persona === 'family' ? 'Rohan (her son) asks' : 'Aaji says';
  const messages = [...s.history.slice(-6), { role: 'user', content: [{ text: `${who}: ${utterance}` }] }];
  for (let step = 0; step < 4; step++) {
    const budget = canSpend(MODEL_ID);
    if (!budget.ok) {
      emit(s, 'note', { text: `${budget.reason}. Switching to the offline router.` });
      return routeOffline(s, utterance, persona);
    }
    const out = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM }],
        messages,
        toolConfig: { tools: toolSpecs(s.tools) },
        inferenceConfig: { maxTokens: 400, temperature: 0.2 },
      }),
    );
    record(MODEL_ID, out.usage);
    const msg = out.output.message;
    messages.push(msg);
    const uses = msg.content.filter((c) => c.toolUse);
    if (out.stopReason !== 'tool_use' || !uses.length) {
      const text = msg.content.map((c) => c.text || '').join(' ').trim();
      s.history = messages.filter((m) => m.content.every((c) => c.text)).slice(-6);
      return text;
    }
    const results = [];
    for (const { toolUse } of uses) {
      const r = await callTool(s, toolUse.name, toolUse.input || {});
      results.push({
        toolResult: {
          toolUseId: toolUse.toolUseId,
          content: [{ json: r.structured ?? { text: r.text } }],
          status: r.isError ? 'error' : 'success',
        },
      });
    }
    messages.push({ role: 'user', content: results });
  }
  return "Sorry, I couldn't finish that. Please try again.";
}

// ------------------------------------------------------------------ HTTP routes
export function mountAlexa(app, { mcpUrl }) {
  app.get('/api/events', async (req, res) => {
    const sid = String(req.query.sid || '');
    if (!/^[\w-]{8,64}$/.test(sid)) return res.status(400).end();
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const s = await getSession(sid, mcpUrl).catch((err) => {
      send(res, 'error', { message: `Could not connect to the Kavach MCP server: ${err.message}` });
      return null;
    });
    if (!s) return res.end();
    s.streams.add(res);
    streams.add(res);
    send(res, 'ready', { ...s.info, person: household().person, family: household().family.map((f) => ({ name: f.name, relation: f.relation })) });
    for (const m of s.backlog?.splice(0) ?? []) send(res, 'rpc', m);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      s.streams.delete(res);
      streams.delete(res);
    });
  });

  app.post('/api/turn', async (req, res) => {
    const { sid, utterance, persona = 'aaji' } = req.body || {};
    const s = sessions.get(sid);
    if (!s?.client) return res.status(409).json({ error: 'Open the event stream first' });
    if (!utterance || typeof utterance !== 'string') return res.status(400).json({ error: 'Say something first' });
    res.status(202).json({ ok: true });
    const t0 = Date.now();
    emit(s, 'heard', { utterance, persona });
    try {
      const reply = llmConfigured() ? await routeBedrock(s, utterance, persona) : await routeOffline(s, utterance, persona);
      emit(s, 'say', { text: reply, persona, ms: Date.now() - t0 });
    } catch (err) {
      console.error(err);
      emit(s, 'say', { text: "Sorry, something went wrong on my side. If someone is pressuring you, it's always okay to hang up.", persona, error: String(err.message || err) });
    }
  });

  app.post('/api/elicit', (req, res) => {
    const { sid, id, accept } = req.body || {};
    const resolve = sessions.get(sid)?.pending.get(id);
    if (!resolve) return res.status(404).json({ error: 'That question has expired' });
    sessions.get(sid).pending.delete(id);
    resolve(Boolean(accept));
    res.json({ ok: true });
  });

  app.post('/api/reset', (_req, res) => {
    resetEvents();
    res.json({ ok: true });
  });
}
