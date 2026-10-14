// "Is this really Rohan?" — out-of-band family verification.
//
// When a caller claims to be a family member (the classic AI voice-clone / grandparent scam),
// Kavach asks the REAL family member on their own phone: "Is that you?" with Yes/No buttons.
//
// Two ways an answer can arrive, whichever comes first:
//   1. ntfy push with action buttons on the family member's real phone. Tapping a button makes
//      the phone POST to a reply topic on ntfy.sh, which this server polls. No public URL or
//      deployment is needed: the laptop only makes outgoing requests.
//   2. The on-screen phone in the demo app (/api/verify-answer).
import { randomUUID } from 'node:crypto';
import { alertBus } from './notify.js';

const NTFY_BASE = process.env.KAVACH_NTFY_BASE || 'https://ntfy.sh';
const POLL_MS = 2000;
const pending = new Map(); // id -> { resolve, member }

const topicFor = (member) => member.ntfyTopic || process.env.KAVACH_NTFY_TOPIC || '';
const replyTopicFor = (member) => (topicFor(member) ? `${topicFor(member)}-reply` : '');

async function pushQuestion(member, id, { title, message }) {
  const topic = topicFor(member);
  if (!topic) return { ok: false, reason: 'no push topic configured' };
  const reply = `${NTFY_BASE}/${replyTopicFor(member)}`;
  try {
    const res = await fetch(NTFY_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        title,
        message,
        priority: 5,
        tags: ['question', 'rotating_light'],
        actions: [
          { action: 'http', label: "Yes, it's me", url: reply, method: 'POST', body: `yes:${id}`, clear: true },
          { action: 'http', label: 'No, not me', url: reply, method: 'POST', body: `no:${id}`, clear: true },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, reason: String(err.message || err) };
  }
}

async function pollReplies(member, since, isDone) {
  const topic = replyTopicFor(member);
  if (!topic) return;
  while (!isDone()) {
    try {
      const res = await fetch(`${NTFY_BASE}/${topic}/json?poll=1&since=${since}`, { signal: AbortSignal.timeout(5000) });
      const text = res.ok ? await res.text() : '';
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        const m = msg.event === 'message' && String(msg.message).match(/^(yes|no):([\w-]+)$/);
        if (m) answerVerification(m[2], m[1], 'phone');
      }
    } catch {
      /* network hiccup: keep polling */
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/** Resolve a pending verification. Returns false if it already finished or doesn't exist. */
export function answerVerification(id, answer, via = 'app') {
  const p = pending.get(id);
  if (!p) return false;
  pending.delete(id);
  p.resolve({ answer: answer === 'yes' ? 'yes' : 'no', via });
  return true;
}

/**
 * Ask a family member whether they are really the one calling.
 * @returns {Promise<{answer: 'yes'|'no'|'timeout', via: string, pushed: boolean, waitedMs: number}>}
 */
export async function requestVerification(member, { claim, request, personName, timeoutMs = 45000, onWait }) {
  const id = randomUUID();
  const started = Date.now();
  const since = Math.floor(started / 1000) - 1;
  const title = `Is that you calling ${personName}?`;
  const message = `Someone who says they are ${member.name} is on the phone with ${personName} right now${request ? `, asking: "${request}"` : ''}. Tap below to tell ${personName} if it's really you.`;

  let done = false;
  const result = new Promise((resolve) => pending.set(id, { resolve, member }));
  alertBus.emit('verify', { id, to: member.name, title, message, claim, at: new Date().toISOString() });
  const push = await pushQuestion(member, id, { title, message });
  pollReplies(member, since, () => done);

  const ticker = setInterval(() => onWait?.(Date.now() - started, timeoutMs), 3000);
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ answer: 'timeout', via: 'none' }), timeoutMs));
  const outcome = await Promise.race([result, timeout]);
  done = true;
  clearInterval(ticker);
  pending.delete(id);
  alertBus.emit('verify_done', { id, answer: outcome.answer, via: outcome.via });
  return { ...outcome, pushed: push.ok, waitedMs: Date.now() - started };
}
