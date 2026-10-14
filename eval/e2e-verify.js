// End-to-end test for "Is this really Rohan?" through the demo host (real MCP session underneath).
// Usage: node eval/e2e-verify.js [baseUrl]
const base = process.argv[2] || 'http://127.0.0.1:8787';
let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};

function openStream(sid) {
  const events = [];
  const waiters = [];
  const ctrl = new AbortController();
  (async () => {
    const res = await fetch(`${base}/api/events?sid=${sid}`, { signal: ctrl.signal });
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = block.match(/^event: (.+)$/m)?.[1];
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (!ev || !data) continue;
        const e = { ev, data: JSON.parse(data) };
        events.push(e);
        for (const w of [...waiters]) if (w.test(e)) (waiters.splice(waiters.indexOf(w), 1), w.resolve(e));
      }
    }
  })().catch(() => {});
  const waitFor = (ev, pred = () => true, ms = 20000) =>
    new Promise((resolve, reject) => {
      const found = events.find((e) => e.ev === ev && pred(e.data));
      if (found) return resolve(found);
      waiters.push({ test: (e) => e.ev === ev && pred(e.data), resolve });
      setTimeout(() => reject(new Error(`timeout waiting for ${ev}`)), ms);
    });
  return { events, waitFor, close: () => ctrl.abort() };
}

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function scenario(answer) {
  const sid = `e2e-verify-${answer}-${Date.now()}`;
  const st = openStream(sid);
  await st.waitFor('ready');
  const n0 = st.events.length;
  await post('/api/turn', { sid, utterance: 'Alexa, someone on the phone says he is Rohan. He had an accident and needs 50,000 rupees on GPay right now. Is this really Rohan?' });
  const v = await st.waitFor('verify');
  check(`[${answer}] verification sent to Rohan`, v.data.to === 'Rohan', v.data.message.slice(0, 80));
  if (answer !== 'timeout') {
    await new Promise((r) => setTimeout(r, 3500)); // let at least one progress notification through
    const r = await post('/api/verify-answer', { id: v.data.id, answer });
    check(`[${answer}] answer accepted`, r.ok);
  }
  const say = await st.waitFor('say', (d) => d.persona === 'aaji', answer === 'timeout' ? 30000 : 15000);
  const result = st.events.slice(n0).find((e) => e.ev === 'tool_result' && e.data.name === 'verify_caller');
  const progress = st.events.slice(n0).filter((e) => e.ev === 'progress');
  const expected = { no: 'denied', yes: 'confirmed', timeout: 'no_answer' }[answer];
  check(`[${answer}] verified = ${expected}`, result?.data.structured?.verified === expected);
  check(`[${answer}] MCP progress notifications received`, progress.length > 0, `${progress.length}`);
  if (answer === 'no') check('[no] impersonation alert sent', st.events.slice(n0).some((e) => e.ev === 'alert'));
  console.log(`      spoken: ${say.data.text}`);
  st.close();
}

await scenario('no');
await scenario('yes');
await scenario('timeout');
console.log(failures ? `\n${failures} FAILED` : '\nAll verification checks passed');
process.exit(failures ? 1 : 0);
