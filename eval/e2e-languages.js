// Spanish + Hindi through the real MCP server. Usage: node eval/e2e-languages.js [url]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const url = new URL(process.argv[2] || 'http://127.0.0.1:8787/mcp');
let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};
const c = new Client({ name: 'kavach-e2e-lang', version: '1.0.0' }, { capabilities: { elicitation: { form: {} } } });
const asked = [];
c.setRequestHandler(ElicitRequestSchema, async (r) => (asked.push(r.params.message), { action: 'decline' }));
await c.connect(new StreamableHTTPClientTransport(url));

const es = await c.callTool({ name: 'check_message', arguments: { text: 'Abuela, soy tu nieto, estoy en la cárcel y necesito dinero para la fianza hoy mismo, no le digas a mamá.' } });
check('Spanish scam detected', es.structuredContent.language === 'es' && es.structuredContent.verdict === 'scam', es.structuredContent.scamType);
check('Spanish answer spoken in Spanish', /^Esto parece una estafa/.test(es.content[0].text), es.content[0].text.slice(0, 70));
check('Spanish consent question', /¿Quiere que le avise a Rohan/.test(asked.at(-1) || ''));

const hi = await c.callTool({ name: 'check_message', arguments: { text: 'सीबीआई से फ़ोन आया, कहा डिजिटल अरेस्ट है, किसी को मत बताना और पैसे ट्रांसफर करो।' } });
check('Hindi scam detected', hi.structuredContent.language === 'hi' && hi.structuredContent.verdict === 'scam', hi.structuredContent.scamType);
check('Hindi answer spoken in Hindi', /^यह धोखाधड़ी लगती है/.test(hi.content[0].text));
check('Hindi consent question', /क्या मैं Rohan को बता दूँ/.test(asked.at(-1) || ''));

const forced = await c.callTool({ name: 'check_message', arguments: { text: 'My grandson is in jail and needs bail money in gift cards today, do not tell his parents.', language: 'es' } });
check('language parameter overrides detection', forced.structuredContent.language === 'es' && /^Esto parece/.test(forced.content[0].text));

const safe = await c.callTool({ name: 'check_message', arguments: { text: 'Mi hijo me llamó desde su número de siempre, llega a las ocho a cenar.' } });
check('Spanish genuine call stays safe', safe.structuredContent.verdict === 'likely_safe');

const call = await c.callTool({ name: 'call_guardian', arguments: { callId: 'es-call-1', segment: 'Le habla el agente del IRS. Usted debe impuestos y hay una orden de arresto. No cuelgue y no le diga a su familia. Pague hoy con tarjetas de regalo.' } });
check('Spanish call interrupted in Spanish', call.structuredContent.stage === 'interrupt' && /Esta llamada es una estafa/.test(call.structuredContent.spoken || ''), (call.structuredContent.spoken || '').slice(0, 70));

await c.close();
console.log(failures ? `\n${failures} FAILED` : '\nAll language checks passed');
process.exit(failures ? 1 : 0);
