// End-to-end protocol test: a real MCP client talks to the running Kavach server.
// Usage: node eval/e2e.js [url]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const url = new URL(process.argv[2] || 'http://127.0.0.1:8787/mcp');
let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};

// Client 1: supports elicitation and says "yes"
const elicited = [];
const c1 = new Client({ name: 'kavach-e2e', version: '1.0.0' }, { capabilities: { elicitation: { form: {} } } });
c1.setRequestHandler(ElicitRequestSchema, async (req) => {
  elicited.push(req.params.message);
  return { action: 'accept', content: { confirm: true } };
});
const t1 = new StreamableHTTPClientTransport(url);
await c1.connect(t1);
check('negotiated protocol 2025-11-25', t1.protocolVersion === '2025-11-25', t1.protocolVersion);

const { tools } = await c1.listTools();
check('4 tools listed', tools.length === 4, tools.map((t) => t.name).join(', '));
check('check_message has outputSchema', Boolean(tools.find((t) => t.name === 'check_message')?.outputSchema));

const scam = await c1.callTool({
  name: 'check_message',
  arguments: { text: 'A man from CBI said a parcel with drugs in my name was seized and I am under digital arrest. Stay on video call and do not tell your son.', channel: 'video_call' },
});
check('digital arrest -> scam', scam.structuredContent?.verdict === 'scam', scam.structuredContent?.scamType);
check('elicitation asked before alerting', elicited.length === 1, JSON.stringify(elicited[0]?.slice(0, 60)));
check('family alerted after consent', scam.structuredContent?.familyAlerted?.includes('Rohan'));
console.log('      spoken:', scam.content[0].text);

const safe = await c1.callTool({ name: 'check_message', arguments: { text: 'My son called from his usual number and said he will be home by 8 tonight.' } });
check('genuine call -> likely_safe', safe.structuredContent?.verdict === 'likely_safe');
check('no elicitation for safe message', elicited.length === 1);

await c1.callTool({ name: 'daily_checkin', arguments: { feeling: 'good', note: 'went for my morning walk' } });
const digest = await c1.callTool({ name: 'family_digest', arguments: { days: 7 } });
check('digest counts scam', digest.structuredContent?.scamsCaught >= 1, digest.structuredContent?.summary);

const res = await c1.readResource({ uri: 'kavach://scam-patterns/digital_arrest' });
check('resource template read', JSON.parse(res.contents[0].text).id === 'digital_arrest');
const prompts = await c1.listPrompts();
check('2 prompts listed', prompts.prompts.length === 2);

// Client 2: no elicitation support -> server must not alert without explicit confirmation
const c2 = new Client({ name: 'kavach-e2e-noelicit', version: '1.0.0' });
await c2.connect(new StreamableHTTPClientTransport(url));
const noConsent = await c2.callTool({ name: 'alert_family', arguments: { reason: 'test', urgency: 'normal' } });
check('no alert without consent', /confirmed=true/.test(noConsent.content[0].text));
const scam2 = await c2.callTool({ name: 'check_message', arguments: { text: 'IRS says I owe back taxes and must pay with gift cards today or be arrested.' } });
check('no-elicit client gets verbal offer', /Would you like me to let/.test(scam2.content[0].text) && scam2.structuredContent.familyAlerted.length === 0);

await c1.close();
await c2.close();
console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
