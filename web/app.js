import { SAMPLE_CALLS } from './calls.js';

// Simulated Alexa+ device + family phone. All real work happens server-side through a live
// MCP session; this page only renders events and handles voice in and out.
const $ = (id) => document.getElementById(id);
const sid = (() => {
  try {
    return sessionStorage.getItem('kavach-sid') || (sessionStorage.setItem('kavach-sid', crypto.randomUUID()), sessionStorage.getItem('kavach-sid'));
  } catch {
    return crypto.randomUUID();
  }
})();

const SCENARIOS = [
  { label: '"Digital arrest" video call', text: 'Alexa, a man from CBI called on video. He says a parcel in my name had drugs, I am under digital arrest, and I must not tell anyone.' },
  { label: 'Grandson needs bail', text: 'Alexa, someone who sounded like my grandson called. He is in jail after an accident and needs bail money in gift cards today. He said do not tell his parents.' },
  { label: 'Electricity cut-off SMS', text: 'Alexa, I got a message: your electricity power will be disconnected tonight at 9.30 pm because your previous month bill was not updated. Immediately contact our electricity officer.' },
  { label: 'Bank asks for OTP', text: 'Alexa, a man from the bank says my KYC has expired and my account will be frozen. He says I will get an OTP and I should read it to him.' },
  { label: 'Is this really Rohan?', text: "Alexa, someone on the phone says he is Rohan. His voice sounds just like him. He says he had an accident and needs 50,000 rupees on GPay right now. Is this really Rohan?" },
  { label: 'Rohan calls about dinner', text: 'Alexa, Rohan called from his usual number. He will be home by eight and wants dal for dinner.', kind: 'safe' },
  { label: 'Good morning check-in', text: 'Good morning Alexa, I am feeling fine today. I went for my walk.', kind: 'safe' },
  { label: 'Not feeling well', text: 'Alexa, I am not feeling well today, a little dizzy.', kind: 'safe' },
];

// ---------------------------------------------------------------- clock
function tick() {
  const d = new Date();
  $('clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('phone-time').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  $('phone-date').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}
tick();
setInterval(tick, 10_000);

// ---------------------------------------------------------------- voice out
let voice;
let callerVoice;
// Prefer neural ("Natural" / "Online") voices: Edge ships very natural Indian English ones.
function pickVoice() {
  const vs = speechSynthesis?.getVoices?.() || [];
  const natural = (v) => /natural|online|neural/i.test(v.name);
  const indian = (v) => /en-IN/i.test(v.lang);
  const female = (v) => /female|neerja|heera|veena|swara|kajal|aditi|aria|jenny|libby|sonia/i.test(v.name);
  const male = (v) => /\bmale\b|prabhat|ravi|hemant|guy|davis|ryan|christopher|eric|david|mark|george/i.test(v.name) && !/female/i.test(v.name);
  voice =
    vs.find((v) => indian(v) && natural(v) && female(v)) ||
    vs.find((v) => indian(v) && natural(v)) ||
    vs.find((v) => /^en-/i.test(v.lang) && natural(v) && female(v)) ||
    vs.find((v) => indian(v) && female(v)) ||
    vs.find((v) => indian(v)) ||
    vs.find((v) => /google uk english female/i.test(v.name)) ||
    vs.find((v) => /^en-(GB|US)/i.test(v.lang));
  // The scammer on speakerphone gets a clearly different (male) voice.
  callerVoice =
    vs.find((v) => indian(v) && natural(v) && male(v)) ||
    vs.find((v) => /^en-/i.test(v.lang) && natural(v) && male(v)) ||
    vs.find((v) => /^en-/i.test(v.lang) && male(v)) ||
    vs.find((v) => /google uk english male/i.test(v.name)) ||
    vs.find((v) => /^en-/i.test(v.lang) && v !== voice);
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
let spokenPrefix = '';
let speechGen = 0;
function stopSpeaking() {
  speechGen++;
  speechSynthesis?.cancel();
}
// Speak sentence by sentence with short pauses, and slow down slightly for warnings,
// so it sounds like someone talking rather than reading a paragraph.
async function speak(text, { as = voice, rate, pitch } = {}) {
  if (!('speechSynthesis' in window) || !text) return;
  stopSpeaking();
  const gen = speechGen;
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*["']?/g) || [text];
  for (const [i, s] of sentences.entries()) {
    const line = s.trim();
    if (!line) continue;
    if (gen !== speechGen) return;
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(line);
      if (as) u.voice = as;
      const warning = /scam|hang up|do not|never|stop/i.test(line);
      u.rate = rate ?? (warning ? 0.9 : 0.97);
      u.pitch = pitch ?? (i === 0 ? 1.05 : 1);
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
    if (gen !== speechGen) return;
    await new Promise((r) => setTimeout(r, 180));
  }
}

// ---------------------------------------------------------------- voice in
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec;
let listeningFor = null; // 'turn' | 'consent'
function listen(purpose) {
  if (!Recognition) return;
  rec?.abort();
  rec = new Recognition();
  rec.lang = 'en-IN';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  listeningFor = purpose;
  // While waiting for consent the ring keeps showing the verdict colour.
  if (purpose === 'consent') $('consent').classList.add('consent-listening');
  else setRing('listening', 'Listening…');
  $('mic').setAttribute('aria-pressed', 'true');
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    const text = r[0].transcript.trim();
    if (purpose === 'turn') $('say').value = text;
    if (!r.isFinal) return;
    if (purpose === 'consent') {
      if (/\b(yes|yeah|haan|ha|ho|please|ok|okay|sure|tell him)\b/i.test(text)) answerConsent(true);
      else if (/\b(no|nahi|nako|don'?t|not now)\b/i.test(text)) answerConsent(false);
    } else {
      ask(text);
    }
  };
  rec.onend = () => {
    $('mic').setAttribute('aria-pressed', 'false');
    $('consent').classList.remove('consent-listening');
    if (listeningFor === purpose && $('ring').dataset.state === 'listening') setRing('idle');
    listeningFor = null;
  };
  rec.onerror = () => {};
  rec.start();
}
if (!Recognition) {
  $('mic').disabled = true;
  $('mic').title = 'Voice input needs Chrome or Edge. You can type instead.';
}
$('mic').addEventListener('click', () => {
  if (listeningFor) return rec?.stop();
  stopSpeaking();
  listen('turn');
});

// ---------------------------------------------------------------- device state
const RING_TEXT = {
  call: 'Listening to the call',
  idle: 'Say "Alexa" and tell me what happened',
  thinking: 'Checking with Kavach…',
  scam: 'Scam warning',
  suspicious: 'Be careful',
  safe: 'Looks fine',
};
function setReply(text) {
  $('reply').textContent = text;
  $('reply').classList.toggle('long', text.length > 180);
}
function setRing(state, label) {
  $('ring').dataset.state = state;
  $('ring-label').textContent = label ?? RING_TEXT[state] ?? '';
}
const VERDICT = { scam: 'Scam', suspicious: 'Worth a second look', likely_safe: 'Looks safe' };

function showVerdict(r) {
  const v = $('verdict');
  v.hidden = false;
  v.dataset.v = r.verdict;
  $('verdict-chip').textContent = VERDICT[r.verdict];
  $('verdict-type').textContent = r.verdict === 'likely_safe' ? '' : r.scamType || '';
  $('flags').replaceChildren(...(r.verdict === 'likely_safe' ? [] : r.redFlags).map((f) => Object.assign(document.createElement('li'), { textContent: f })));
  setRing(r.verdict === 'likely_safe' ? 'safe' : r.verdict);
}

// ---------------------------------------------------------------- turns
let busy = false;
async function ask(text, persona = 'aaji') {
  text = text.trim();
  if (!text || busy) return;
  if (persona === 'aaji' && /\blisten (to|in on|in to) (this|the|my) (phone )?call\b/i.test(text)) {
    $('say').value = '';
    return listenToRealCall();
  }
  busy = true;
  $('say').value = '';
  spokenPrefix = '';
  if (persona === 'aaji') {
    $('verdict').hidden = true;
    setRing('thinking');
  }
  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sid, utterance: text, persona }),
  }).catch(() => null);
  if (!res?.ok) {
    busy = false;
    setRing('idle');
    $('reply').textContent = 'The Kavach server is not reachable. Check that "npm start" is running, then try again.';
  }
}
$('ask').addEventListener('submit', (e) => {
  e.preventDefault();
  ask($('say').value);
});
$('chips').replaceChildren(
  ...SCENARIOS.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.label;
    if (s.kind) b.dataset.kind = s.kind;
    b.addEventListener('click', () => ask(s.text));
    return b;
  }),
);
$('digest-close').addEventListener('click', () => ($('digest').hidden = true));
$('ask-digest').addEventListener('click', () => ask('How is Aai doing this week? Anything suspicious?', 'family'));


// ---------------------------------------------------------------- live call guardian
const call = { active: false, id: null, started: 0, timer: null, interrupted: false, source: null, rec: null, endedSent: false };
const STAGE_TEXT = { listening: 'Kavach is listening', caution: 'Be careful', interrupt: 'Scam: stepping in' };

function enterCallMode(who) {
  Object.assign(call, { active: true, id: `call-${crypto.randomUUID().slice(0, 12)}`, started: Date.now(), interrupted: false, endedSent: false });
  document.querySelector('.device').dataset.mode = 'call';
  $('call').hidden = false;
  $('consent').hidden = true;
  $('captions').replaceChildren();
  $('call-flags').replaceChildren();
  $('call-who').textContent = who;
  updateMeter({ risk: 0, stage: 'listening' });
  setRing('call');
  clearInterval(call.timer);
  call.timer = setInterval(() => {
    const s = Math.floor((Date.now() - call.started) / 1000);
    $('call-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
}
function exitCallMode() {
  call.active = false;
  clearInterval(call.timer);
  try { call.rec?.abort(); } catch {}
  call.rec = null;
  document.querySelector('.device').dataset.mode = '';
  $('call').hidden = true;
}
function addCaption(text, cls) {
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  const list = $('captions');
  list.append(li);
  while (list.children.length > 5) list.firstChild.remove();
  return li;
}
function updateMeter({ risk, stage }) {
  $('meter').dataset.stage = stage;
  $('meter-fill').style.width = `${Math.max(3, Math.min(100, risk))}%`;
  $('meter-stage').textContent = STAGE_TEXT[stage] || '';
  if (stage === 'caution') setRing('suspicious', 'Be careful');
}
async function sendSegment(text) {
  if (!call.active) return null;
  const res = await fetch('/api/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sid, callId: call.id, segment: text }),
  }).catch(() => null);
  const r = res?.ok ? await res.json() : null;
  if (!r || !call.active) return r;
  updateMeter(r);
  for (const f of r.newRedFlags) $('call-flags').append(Object.assign(document.createElement('li'), { textContent: f }));
  if (r.stage === 'interrupt' && !call.interrupted) await interruptCall(r);
  return r;
}
async function interruptCall(r) {
  call.interrupted = true;
  try { call.rec?.abort(); } catch {}
  stopSpeaking(); // cut the caller off mid-sentence
  $('captions').lastElementChild?.classList.add('cut');
  addCaption(r.spoken, 'kavach');
  setRing('scam', 'Scam: hang up');
  await speak(r.spoken);
  await endCall();
}
async function endCall() {
  if (!call.active || call.endedSent) return;
  call.endedSent = true;
  try { call.rec?.abort(); } catch {}
  stopSpeaking();
  clearInterval(call.timer);
  $('call-who').textContent = 'Call ended';
  await fetch('/api/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, callId: call.id, ended: true }) }).catch(() => {});
}
$('call-end').addEventListener('click', endCall);

async function playSampleCall(sc) {
  if (call.active || busy) return;
  enterCallMode(sc.caller);
  for (const line of sc.lines) {
    if (!call.active || call.interrupted) return;
    addCaption(line);
    const speaking = speak(line, { as: callerVoice, rate: 1.02, pitch: 0.92 });
    // Send the words partway through the sentence, like a live transcript would.
    await new Promise((r) => setTimeout(r, Math.min(1800, 300 + line.length * 22)));
    if (!call.active || call.interrupted) return;
    await sendSegment(line);
    if (!call.active || call.interrupted) return;
    await speaking;
    await new Promise((r) => setTimeout(r, 350));
  }
  if (call.active && !call.interrupted) await endCall();
}

function listenToRealCall() {
  if (call.active) return;
  if (!Recognition) {
    setReply('Listening to calls needs Chrome or Edge. Try one of the sample calls instead.');
    return;
  }
  stopSpeaking();
  enterCallMode('Call on speaker');
  const r = new Recognition();
  r.lang = 'en-IN';
  r.continuous = true;
  r.interimResults = true;
  let live = null;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const t = res[0].transcript.trim();
      if (!t) continue;
      live ??= addCaption('');
      live.textContent = t;
      if (res.isFinal) {
        live = null;
        sendSegment(t);
      }
    }
  };
  r.onend = () => {
    if (call.active && call.rec === r && !call.interrupted && !call.endedSent) {
      try { r.start(); } catch {}
    }
  };
  call.rec = r;
  r.start();
}

$('call-chips').replaceChildren(
  ...SAMPLE_CALLS.map((sc) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.kind = 'call';
    b.textContent = `Play a call: ${sc.label}`;
    b.addEventListener('click', () => playSampleCall(sc));
    return b;
  }),
  (() => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.kind = 'mic';
    b.textContent = 'Listen with the microphone';
    b.addEventListener('click', listenToRealCall);
    return b;
  })(),
);

// ---------------------------------------------------------------- consent (MCP elicitation)
let consentId = null;
async function answerConsent(accept) {
  if (!consentId) return;
  const id = consentId;
  consentId = null;
  rec?.abort();
  $('consent').hidden = true;
  setRing('thinking', accept ? 'Letting the family know…' : RING_TEXT.thinking);
  await fetch('/api/elicit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, id, accept }) });
}
$('consent-yes').addEventListener('click', () => answerConsent(true));
$('consent-no').addEventListener('click', () => answerConsent(false));

// ---------------------------------------------------------------- phone
// ---------------------------------------------------------------- verification ("Is this really Rohan?")
function showVerifyCard(v) {
  $('notes-empty')?.remove();
  const li = document.createElement('li');
  li.className = 'note note-verify';
  li.dataset.urgent = '1';
  li.dataset.id = v.id;
  li.innerHTML = `<div class="note-head"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 4 7v8c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V7z"/></svg><span>Kavach</span><span>now</span></div><p class="note-title"></p><p class="note-body"></p><div class="note-actions"><button type="button" data-a="yes">Yes, it's me</button><button type="button" data-a="no">No, not me</button></div>`;
  li.querySelector('.note-title').textContent = v.title;
  li.querySelector('.note-body').textContent = v.message.replace(/ Tap below.*$/, '');
  li.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', async () => {
      li.querySelectorAll('button').forEach((x) => (x.disabled = true));
      await fetch('/api/verify-answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, answer: b.dataset.a }) });
    }),
  );
  $('notes').prepend(li);
  buzz();
}
function finishVerifyCard({ id, answer, via }) {
  const li = document.querySelector(`.note-verify[data-id="${id}"]`);
  if (!li) return;
  const actions = li.querySelector('.note-actions');
  const label = answer === 'yes' ? 'You confirmed it was you' : answer === 'no' ? 'You said it was not you' : 'No answer in time';
  actions.replaceChildren(Object.assign(document.createElement('p'), { className: 'note-answered', textContent: `${label}${via === 'phone' ? ' (from your phone)' : ''}` }));
  li.dataset.urgent = answer === 'yes' ? '0' : '1';
}
function buzz() {
  const phone = document.querySelector('.phone');
  phone.classList.remove('buzz');
  void phone.offsetWidth;
  phone.classList.add('buzz');
  navigator.vibrate?.(200);
}

function addNote(a) {
  $('notes-empty')?.remove();
  const li = document.createElement('li');
  li.className = 'note';
  li.dataset.urgent = a.priority === 'urgent' ? '1' : '0';
  li.innerHTML = `<div class="note-head"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 4 7v8c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V7z"/></svg><span>Kavach</span><span>now</span></div><p class="note-title"></p><p class="note-body"></p>`;
  li.querySelector('.note-title').textContent = a.title.replace(/^Kavach:\s*/, '');
  li.querySelector('.note-body').textContent = a.message.split('\n')[0];
  $('notes').prepend(li);
  buzz();
}
function showDigest(d, text) {
  $('digest').hidden = false;
  $('digest-text').textContent = text || d.summary;
  const stat = (label, n) => {
    const div = document.createElement('div');
    div.innerHTML = '<dt></dt><dd></dd>';
    div.querySelector('dt').textContent = label;
    div.querySelector('dd').textContent = n;
    return div;
  };
  $('digest-stats').replaceChildren(stat('Scams stopped', d.scamsCaught), stat('Check-ins', d.checkins), stat('Alerts', d.alertsSent));
}

// ---------------------------------------------------------------- trace
function gist(msg) {
  if (msg.method === 'tools/call') return `${msg.params.name}(${JSON.stringify(msg.params.arguments).slice(0, 140)})`;
  if (msg.method === 'elicitation/create') return msg.params.message.replace(/\s+/g, ' ').slice(0, 160);
  if (msg.result?.structuredContent) return JSON.stringify(msg.result.structuredContent).slice(0, 180);
  if (msg.result?.action) return `action: ${msg.result.action}`;
  if (msg.result?.tools) return `${msg.result.tools.length} tools`;
  if (msg.result?.content) return msg.result.content.map((c) => c.text).join(' ').slice(0, 160);
  if (msg.error) return `error ${msg.error.code}: ${msg.error.message}`;
  return JSON.stringify(msg.params ?? msg.result ?? {}).slice(0, 140);
}
const pendingMethods = new Map();
function addTrace({ dir, msg }) {
  let method = msg.method;
  if (method && msg.id !== undefined) pendingMethods.set(`${dir}:${msg.id}`, method);
  if (!method && msg.id !== undefined) method = `${pendingMethods.get(`${dir === 'in' ? 'out' : 'in'}:${msg.id}`) || 'response'} → result`;
  const li = document.createElement('li');
  li.dataset.dir = dir;
  if (/elicitation/.test(method || '')) li.dataset.kind = 'elicit';
  li.innerHTML = `<details><summary><span class="dir"></span><span class="method"></span><span class="gist"></span></summary><pre></pre></details>`;
  li.querySelector('.dir').textContent = dir === 'out' ? '→' : '←';
  li.querySelector('.method').textContent = method || 'message';
  li.querySelector('.gist').textContent = gist(msg);
  li.querySelector('pre').textContent = JSON.stringify(msg, null, 2);
  const t = $('trace');
  t.append(li);
  while (t.children.length > 200) t.firstChild.remove();
  t.scrollTop = t.scrollHeight;
}

// ---------------------------------------------------------------- event stream
let lastVerdict = null;
function connect() {
  const es = new EventSource(`/api/events?sid=${encodeURIComponent(sid)}`);
  es.addEventListener('ready', (e) => {
    const info = JSON.parse(e.data);
    $('conn').dataset.ok = '1';
    $('conn-text').textContent = `Connected to Kavach over MCP ${info.protocol}`;
    const meta = [
      ['Protocol', info.protocol],
      ['Session', String(info.sessionId).slice(0, 8)],
      ['Tools', info.tools.join(', ')],
      ['Agent', info.brain],
    ];
    $('hood-meta').replaceChildren(
      ...meta.map(([k, v]) => {
        const span = document.createElement('span');
        span.append(`${k} `);
        const b = document.createElement('b');
        b.textContent = v;
        span.append(b);
        return span;
      }),
    );
  });
  es.addEventListener('error', (e) => {
    if (e.data) {
      $('conn').dataset.ok = '0';
      $('conn-text').textContent = JSON.parse(e.data).message;
    } else if (es.readyState === EventSource.CLOSED) {
      $('conn').dataset.ok = '0';
      $('conn-text').textContent = 'Disconnected. Reconnecting…';
      setTimeout(connect, 2000);
    }
  });
  es.addEventListener('heard', (e) => {
    const { utterance, persona } = JSON.parse(e.data);
    if (persona === 'aaji') {
      $('heard').hidden = false;
      const said = utterance.replace(/^\s*(hey\s+)?alexa[,\s]*/i, '');
      $('heard').textContent = said.charAt(0).toUpperCase() + said.slice(1);
      $('reply').textContent = '…';
    }
  });
  es.addEventListener('rpc', (e) => addTrace(JSON.parse(e.data)));
  es.addEventListener('tool_result', (e) => {
    const r = JSON.parse(e.data);
    if (r.name === 'check_message' && r.structured) {
      lastVerdict = r.structured;
      showVerdict(r.structured);
    }
    if (r.name === 'family_digest' && r.structured) showDigest(r.structured);
    if (r.name === 'verify_caller' && r.structured) lastVerdict = r.structured;
    if (r.name === 'daily_checkin') setRing(/sorry/i.test(r.text) ? 'idle' : 'safe', /asked/i.test(r.text) ? 'Rohan will call you' : 'Noted for the family');
  });
  es.addEventListener('elicit', async (e) => {
    const { id, message, title } = JSON.parse(e.data);
    consentId = id;
    if (/looks like a scam/i.test(message) || call.interrupted) setRing('scam');
    else setRing('idle', 'Waiting for your answer');
    const [said, question] = message.includes('\n\n') ? message.split('\n\n') : ['', message];
    if (said) {
      setReply(said);
      spokenPrefix = said.trim();
    }
    $('consent-q').textContent = question;
    $('consent-yes').textContent = title.replace(/^Tell /, 'Yes, tell ').replace(/^Ask /, 'Yes, ask ').replace(/^Send /, 'Yes, send ');
    $('consent').hidden = false;
    $('consent-yes').focus({ preventScroll: true });
    await speak(`${said} ${question}`.trim());
    if (consentId === id) listen('consent');
  });
  es.addEventListener('say', async (e) => {
    const { text, persona, call: fromCall } = JSON.parse(e.data);
    busy = false;
    if (fromCall) {
      exitCallMode();
      $('heard').hidden = true;
      $('verdict').hidden = true;
      if (!text) return setRing('idle');
      setRing('safe', 'Call over');
      setReply(text);
      return speak(text);
    }
    if (persona === 'family') {
      if (!$('digest').hidden) $('digest-text').textContent = text;
      else showDigest({ scamsCaught: '–', checkins: '–', alertsSent: '–' }, text);
      return speak(text);
    }
    setReply(text);
    if (!lastVerdict && $('ring').dataset.state === 'thinking') setRing('idle');
    const rest = spokenPrefix && text.startsWith(spokenPrefix) ? text.slice(spokenPrefix.length).trim() : text;
    spokenPrefix = '';
    lastVerdict = null;
    await speak(rest);
  });
  es.addEventListener('alert', (e) => addNote(JSON.parse(e.data)));
  es.addEventListener('verify', (e) => {
    const v = JSON.parse(e.data);
    showVerifyCard(v);
    setRing('thinking', `Asking ${v.to} on his phone…`);
    const line = `I'm asking ${v.to} on his own phone right now. Please stay with me, and don't send anything yet.`;
    setReply(line);
    speak(line);
  });
  es.addEventListener('progress', (e) => {
    const p = JSON.parse(e.data);
    if (p.name === 'verify_caller' && p.total) setRing('thinking', `Waiting for an answer · ${Math.max(0, p.total - p.progress)}s`);
  });
  es.addEventListener('verify_done', (e) => {
    const d = JSON.parse(e.data);
    finishVerifyCard(d);
    setRing(d.answer === 'yes' ? 'safe' : d.answer === 'no' ? 'scam' : 'suspicious', d.answer === 'yes' ? 'Confirmed by family' : d.answer === 'no' ? 'Impersonation caught' : 'No answer yet');
  });
  es.addEventListener('note', (e) => addTrace({ dir: 'in', msg: { method: 'note', params: JSON.parse(e.data) } }));
}
connect();

$('reset').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' });
  $('trace').replaceChildren();
  $('notes').replaceChildren(Object.assign(document.createElement('li'), { className: 'notes-empty', id: 'notes-empty', textContent: 'No alerts. Kavach will tell you here if Aai needs you.' }));
  $('digest').hidden = true;
  $('verdict').hidden = true;
  $('heard').hidden = true;
  $('reply').textContent = 'Hello Aaji. If anyone calls or messages asking for money, codes or secrets, tell me about it first.';
  setRing('idle');
});
