// Kavach MCP server definition (spec 2025-11-25).
// Tools:      check_message, call_guardian, verify_caller, alert_family, daily_checkin, family_digest
// Resources:  kavach://scam-patterns, kavach://scam-patterns/{id}, kavach://activity
// Prompts:    scam_safety_check, weekly_family_update
// Elicitation is used to get the person's explicit consent before anyone is contacted.
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PATTERNS, analyze, localizePattern, PHRASES, detectLanguage } from 'kavach-scam-patterns';

const LANG = z.enum(['en', 'es', 'hi']);
const langOf = (explicit, text) => explicit || (text ? detectLanguage(text) : null) || household().person.lang || 'en';
import { assess } from './assess.js';
import { household, addEvent, eventsSince, findFamily } from './store.js';
import { notify } from './notify.js';
import { requestVerification } from './verify.js';
import { t } from './i18n.js';

const DAY = 24 * 60 * 60 * 1000;
const excerpt = (s, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const canElicit = (server) => Boolean(server.server.getClientCapabilities()?.elicitation);

async function confirmWithPerson(server, message, title) {
  if (!canElicit(server)) return { supported: false };
  const res = await server.server.elicitInput({
    mode: 'form',
    message,
    requestedSchema: {
      type: 'object',
      properties: { confirm: { type: 'boolean', title, default: true } },
      required: ['confirm'],
    },
  });
  return { supported: true, confirmed: res.action === 'accept' && res.content?.confirm === true, action: res.action };
}

async function sendAlert(members, { reason, urgency, title: customTitle }) {
  const person = household().person;
  const title = customTitle || (urgency === 'urgent' ? `Kavach: ${person.preferredName} may be talking to a scammer` : `Kavach update about ${person.preferredName}`);
  const delivered = [];
  for (const m of members) {
    const results = await notify(m, {
      title,
      message: `${reason}\n\nPlease call ${person.preferredName} on her usual number.`,
      priority: urgency === 'urgent' ? 'urgent' : 'default',
    });
    delivered.push({ to: m.name, relation: m.relation, channels: results.filter((r) => r.ok).map((r) => r.channel) });
  }
  addEvent('alert', { reason: excerpt(reason, 300), urgency, to: delivered.map((d) => d.to) });
  return delivered;
}

export function createKavachServer() {
  const server = new McpServer(
    { name: 'kavach', title: 'Kavach: scam shield for older adults', version: '0.1.0' },
    {
      capabilities: { logging: {} },
      instructions:
        'Kavach protects an older adult from phone, text and email scams and keeps their family in the loop. ' +
        'Whenever the person describes a call, message, or request for money, codes, or personal details, call check_message first. ' +
        'Speak the "spoken" field back in a calm, short way. Never ask the person to read out codes or account numbers. ' +
        'Use daily_checkin when they say how they are feeling; use family_digest when a family member asks how they are doing.',
    },
  );

  // ---------------------------------------------------------------- check_message
  server.registerTool(
    'check_message',
    {
      title: 'Check a call, text or email for scams',
      description:
        'Assess whether a phone call, text, WhatsApp message, email, or in-person request is a scam. ' +
        'Pass what the person heard or read in their own words. Returns a verdict, the scam type, red flags, ' +
        'the fact that breaks the scam, and a short sentence to speak aloud. If it is a scam and the client ' +
        'supports elicitation, offers to alert the family.',
      inputSchema: {
        text: z.string().min(3).describe('What the caller or message said, as described by the person'),
        channel: z.enum(['call', 'sms', 'whatsapp', 'email', 'video_call', 'in_person', 'other']).optional(),
        region: z.enum(['IN', 'US']).optional().describe('Defaults to the household region'),
        language: z.enum(['en', 'es', 'hi']).optional().describe('Language to answer in. Detected from the text if omitted (English, Spanish, Hindi).'),
        offerAlert: z.boolean().optional().default(true).describe('Offer to alert family if this is a scam'),
      },
      outputSchema: {
        verdict: z.enum(['scam', 'suspicious', 'likely_safe']),
        score: z.number(),
        language: z.enum(['en', 'es', 'hi']),
        scamType: z.string().nullable(),
        redFlags: z.array(z.string()),
        truth: z.string().nullable(),
        advice: z.string().nullable(),
        spoken: z.string(),
        engine: z.string(),
        familyAlerted: z.array(z.string()),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, idempotentHint: false },
    },
    async ({ text, channel, region, language, offerAlert }) => {
      const hh = household();
      const r = await assess(text, { region: region || hh.person.region, lang: language });
      const P = PHRASES[r.lang] || PHRASES.en;
      addEvent('check', { verdict: r.verdict, scamType: r.pattern?.id || null, channel: channel || 'other', excerpt: excerpt(text) });

      let familyAlerted = [];
      let spoken = r.spoken;
      const impersonation = ['grandparent_emergency', 'voice_clone_family'].includes(r.pattern?.id) && r.verdict !== 'likely_safe';
      if (r.verdict === 'scam' && offerAlert !== false) {
        const family = findFamily();
        const names = family.map((f) => f.name).join(P.and);
        const ask = await confirmWithPerson(
          server,
          `${r.spoken}\n\n${P.askFamily(names)}`,
          `Tell ${names}`,
        );
        if (ask.confirmed) {
          const delivered = await sendAlert(family, {
            reason: `${hh.person.preferredName} reported a likely ${r.pattern?.name || 'scam'}: "${excerpt(text, 200)}"`,
            urgency: 'urgent',
          });
          familyAlerted = delivered.map((d) => d.to);
          spoken += P.alerted(familyAlerted.join(P.and));
        } else if (!ask.supported) {
          spoken += P.offerFamily(names);
        }
      }

      if (impersonation && !familyAlerted.length && r.lang === 'en') {
        spoken += ` If you're not sure, say "check with ${findFamily()[0]?.name || 'my family'}" and I'll ask them directly on their phone.`;
      }
      const structured = {
        verdict: r.verdict,
        score: r.score,
        language: r.lang,
        scamType: r.pattern?.name ?? null,
        redFlags: r.redFlags.map((f) => f.label),
        truth: r.pattern?.truth ?? null,
        advice: r.pattern?.advice ?? null,
        spoken,
        engine: r.engine,
        familyAlerted,
      };
      return { content: [{ type: 'text', text: spoken }], structuredContent: structured };
    },
  );

  // ---------------------------------------------------------------- alert_family
  server.registerTool(
    'alert_family',
    {
      title: 'Alert family members',
      description:
        'Send a push/email alert to the person\'s family. Always asks the person for consent first ' +
        '(via elicitation). If the client cannot show a confirmation, call again with confirmed=true ' +
        'only after the person has clearly said yes out loud.',
      inputSchema: {
        reason: z.string().min(3).describe('What happened, in one or two sentences'),
        to: z.string().optional().describe('A family member name or relation, e.g. "Rohan" or "son". Omit for everyone.'),
        urgency: z.enum(['urgent', 'normal']).default('normal'),
        confirmed: z.boolean().optional().describe('Set only after the person verbally agreed, when elicitation is unavailable'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
    },
    async ({ reason, to, urgency, confirmed }) => {
      const members = findFamily(to);
      if (!members.length) {
        return { isError: true, content: [{ type: 'text', text: `I don't have anyone called "${to}" in the family list.` }] };
      }
      const names = members.map((m) => m.name).join(' and ');
      const ask = await confirmWithPerson(server, `Send this message to ${names}?\n\n"${reason}"`, `Send to ${names}`);
      if (ask.supported && !ask.confirmed) {
        return { content: [{ type: 'text', text: `Okay, I won't message ${names}.` }] };
      }
      if (!ask.supported && confirmed !== true) {
        return {
          content: [{ type: 'text', text: `Ask the person: "Shall I send a message to ${names}?" Then call alert_family again with confirmed=true if they say yes.` }],
        };
      }
      const delivered = await sendAlert(members, { reason, urgency });
      return {
        content: [{ type: 'text', text: `Done. I've let ${names} know.` }],
        structuredContent: { delivered },
      };
    },
  );

  // ---------------------------------------------------------------- call_guardian
  // Live call protection: the host streams what the caller says, segment by segment.
  // Kavach keeps a running risk score for the whole call and tells the host when to interrupt.
  const calls = new Map(); // callId -> { text, stage, flags:Set, started }
  server.registerTool(
    'call_guardian',
    {
      title: 'Listen to a call and step in if it is a scam',
      description:
        'Live call protection. While the person is on a call (on speaker), send each new piece of what the caller says ' +
        'as `segment` with the same `callId`. Kavach scores the whole conversation so far and returns stage ' +
        '"listening", "caution" or "interrupt". When stage becomes "interrupt", speak the `spoken` text immediately, ' +
        'over the caller. Send ended=true when the call is over to get a summary and, if it was a scam, offer to alert family.',
      inputSchema: {
        callId: z.string().min(4).max(64),
        segment: z.string().max(2000).optional().describe('New words from the caller since the last update'),
        ended: z.boolean().optional().default(false),
      },
      outputSchema: {
        stage: z.enum(['listening', 'caution', 'interrupt', 'ended']),
        risk: z.number().describe('0-100 risk for the whole call so far'),
        newRedFlags: z.array(z.string()),
        redFlags: z.array(z.string()),
        scamType: z.string().nullable(),
        spoken: z.string().nullable().describe('Say this right away, if present'),
        seconds: z.number(),
        familyAlerted: z.array(z.string()),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, idempotentHint: false },
    },
    async ({ callId, segment, ended }) => {
      const hh = household();
      const c = calls.get(callId) ?? { text: '', stage: 'listening', flags: new Set(), started: Date.now() };
      calls.set(callId, c);
      if (segment) c.text = `${c.text} ${segment}`.trim();
      const r = analyze(c.text, { region: hh.person.region });
      const before = new Set(c.flags);
      for (const f of r.redFlags) c.flags.add(f.label);
      const newRedFlags = [...c.flags].filter((f) => !before.has(f));
      const risk = Math.round(r.score * 100);
      const seconds = Math.round((Date.now() - c.started) / 1000);
      const n = hh.person.preferredName;
      let spoken = null;
      let familyAlerted = [];

      if (!ended) {
        const next = r.verdict === 'scam' ? 'interrupt' : r.verdict === 'suspicious' ? 'caution' : 'listening';
        const rank = { listening: 0, caution: 1, interrupt: 2 };
        if (rank[next] > rank[c.stage]) {
          c.stage = next;
          if (next === 'interrupt') {
            const P = PHRASES[r.lang] || PHRASES.en;
            spoken = P.interrupt(n, localizePattern(r.pattern, r.lang)?.truth ?? '').replace(/\s+/g, ' ');
            addEvent('check', { verdict: 'scam', scamType: r.pattern?.id || null, channel: 'live_call' }); // no transcript stored
          }
        }
      } else {
        c.stage = 'ended';
        calls.delete(callId);
        const wasScam = r.verdict === 'scam';
        addEvent('call', { verdict: r.verdict, scamType: r.pattern?.id || null, seconds, flags: [...c.flags] });
        if (wasScam) {
          const family = findFamily();
          const L = t(r.lang).call;
          const names = family.map((f) => f.name).join((PHRASES[r.lang] || PHRASES.en).and);
          const ask = await confirmWithPerson(server, L.endAsk(n, names), `Tell ${names}`);
          if (ask.confirmed) {
            const delivered = await sendAlert(family, {
              title: `Kavach stopped a scam call to ${n}`,
              reason: `Kavach listened to a ${seconds}-second call and stepped in: likely ${r.pattern?.name || 'scam'}. Warning signs: ${[...c.flags].slice(0, 4).join('; ').toLowerCase()}.`,
              urgency: 'urgent',
            });
            familyAlerted = delivered.map((d) => d.to);
            spoken = L.alerted(familyAlerted.join((PHRASES[r.lang] || PHRASES.en).and));
          } else spoken = ask.supported ? L.safe : L.offer(names);
        } else {
          spoken = r.verdict === 'suspicious' ? t(r.lang).call.wary(n) : null;
        }
      }

      const structured = { stage: c.stage, risk, newRedFlags, redFlags: [...c.flags], scamType: r.pattern?.name ?? null, spoken, seconds, familyAlerted };
      return { content: [{ type: 'text', text: spoken || `${c.stage} (risk ${risk})` }], structuredContent: structured };
    },
  );

  // ---------------------------------------------------------------- verify_caller
  server.registerTool(
    'verify_caller',
    {
      title: 'Is this really them? Ask the family member directly',
      description:
        'Use when a caller claims to be a family member (son, daughter, grandchild) and the person is unsure, ' +
        'especially if money or secrecy is involved. Sends the REAL family member a Yes/No question on their own ' +
        'phone and waits for the answer. This defeats AI voice-cloning scams. Reports progress while waiting.',
      inputSchema: {
        claimedName: z.string().optional().describe('Who the caller says they are, e.g. "Rohan" or "my son"'),
        request: z.string().optional().describe('What the caller is asking for, in the person\'s words'),
        timeoutSeconds: z.number().int().min(10).max(120).default(45),
        language: LANG.optional().describe('Language to answer in; detected from the request if omitted'),
      },
      outputSchema: {
        verified: z.enum(['confirmed', 'denied', 'no_answer']),
        familyMember: z.string(),
        answeredVia: z.string(),
        waitedSeconds: z.number(),
        scamVerdict: z.enum(['scam', 'suspicious', 'likely_safe']).nullable(),
        spoken: z.string(),
      },
      annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
    },
    async ({ claimedName, request: rawRequest, timeoutSeconds, language }, extra) => {
      const V = t(langOf(language, rawRequest)).verify;
      const request = rawRequest?.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '') || undefined;
      const hh = household();
      const member = findFamily(claimedName)[0] || (claimedName ? null : hh.family[0]);
      if (!member) {
        const known = hh.family.map((f) => f.name).join(', ');
        const text = V.unknown(claimedName, known);
        return { content: [{ type: 'text', text }], structuredContent: { verified: 'no_answer', familyMember: claimedName || '', answeredVia: 'none', waitedSeconds: 0, scamVerdict: null, spoken: text } };
      }

      const scam = request ? await assess(request, { region: hh.person.region, mode: 'rules' }) : null;
      const token = extra?._meta?.progressToken;
      const progress = (elapsed, total) =>
        token !== undefined &&
        extra
          .sendNotification({
            method: 'notifications/progress',
            params: { progressToken: token, progress: Math.round(elapsed / 1000), total: Math.round(total / 1000), message: `Waiting for ${member.name} to answer on his phone` },
          })
          .catch(() => {});
      progress(0, timeoutSeconds * 1000);

      const r = await requestVerification(member, {
        claim: claimedName || member.name,
        request,
        personName: hh.person.preferredName,
        timeoutMs: timeoutSeconds * 1000,
        onWait: progress,
      });

      const n = member.name;
      let verified, spoken;
      if (r.answer === 'no') {
        verified = 'denied';
        spoken = V.denied(hh.person.preferredName, n);
        await sendAlert([member], { title: `Kavach: someone is pretending to be you`, reason: `You told Kavach it's not you calling ${hh.person.preferredName}. Kavach told her to hang up${request ? `. The caller wanted: "${excerpt(request, 160)}"` : ''}.`, urgency: 'urgent' });
      } else if (r.answer === 'yes') {
        verified = 'confirmed';
        spoken = V.confirmed(hh.person.preferredName, n);
      } else {
        verified = 'no_answer';
        spoken = V.no_answer(hh.person.preferredName, n);
      }
      addEvent('verify', { familyMember: n, verified, via: r.via, request: request ? excerpt(request) : undefined });
      const structured = { verified, familyMember: n, answeredVia: r.via, waitedSeconds: Math.round(r.waitedMs / 1000), scamVerdict: scam?.verdict ?? null, spoken };
      return { content: [{ type: 'text', text: spoken }], structuredContent: structured };
    },
  );

  // ---------------------------------------------------------------- daily_checkin
  server.registerTool(
    'daily_checkin',
    {
      title: 'Daily check-in',
      description:
        'Record how the person is feeling today (e.g. when they say good morning or "I\'m fine"). ' +
        'If they are not feeling well, offers to tell the family.',
      inputSchema: {
        feeling: z.enum(['good', 'okay', 'not_good']),
        language: LANG.optional().describe('Language to answer in; detected from the note if omitted'),
        note: z.string().optional().describe('Anything they mentioned, in their words'),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ feeling, note, language }) => {
      const C = t(langOf(language, note)).checkin;
      const hh = household();
      addEvent('checkin', { feeling, note: note ? excerpt(note, 200) : undefined });
      let text =
        feeling === 'good'
          ? C.good(hh.person.preferredName)
          : feeling === 'okay'
            ? C.okay(hh.person.preferredName)
            : C.not_good(hh.person.preferredName);
      if (feeling === 'not_good') {
        const family = findFamily();
        const names = family.map((f) => f.name).join(' and ');
        const ask = await confirmWithPerson(server, `${text} ${C.ask(names)}`, `Ask ${names} to call`);
        if (ask.confirmed) {
          await sendAlert(family, { reason: `${hh.person.preferredName} said she isn't feeling well today.${note ? ` She said: "${note}"` : ''}`, urgency: 'normal' });
          text += C.asked(names);
        } else if (!ask.supported) text += C.offer(names);
      }
      return { content: [{ type: 'text', text }] };
    },
  );

  // ---------------------------------------------------------------- family_digest
  server.registerTool(
    'family_digest',
    {
      title: 'Family digest',
      description:
        'Summary for a family member: scams caught, alerts sent, and daily check-ins over the last N days. ' +
        'Use when someone asks "how is Mom doing?" or "anything suspicious this week?".',
      inputSchema: { days: z.number().int().min(1).max(30).default(7) },
      outputSchema: {
        days: z.number(),
        checksTotal: z.number(),
        scamsCaught: z.number(),
        suspicious: z.number(),
        alertsSent: z.number(),
        checkins: z.number(),
        lastCheckin: z.string().nullable(),
        lastFeeling: z.string().nullable(),
        topScamTypes: z.array(z.string()),
        summary: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ days }) => {
      const hh = household();
      const ev = eventsSince(days * DAY);
      const checks = ev.filter((e) => e.type === 'check');
      const scams = checks.filter((e) => e.verdict === 'scam');
      const sus = checks.filter((e) => e.verdict === 'suspicious');
      const alerts = ev.filter((e) => e.type === 'alert');
      const checkins = ev.filter((e) => e.type === 'checkin');
      const callsStopped = ev.filter((e) => e.type === 'call' && e.verdict === 'scam');
      const impersonations = ev.filter((e) => e.type === 'verify' && e.verified === 'denied');
      const last = checkins.at(-1);
      const counts = {};
      for (const s of scams) if (s.scamType) counts[s.scamType] = (counts[s.scamType] || 0) + 1;
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => PATTERNS.find((p) => p.id === id)?.name || id)
        .slice(0, 3);
      const n = hh.person.preferredName;
      const parts = [
        scams.length
          ? `${n} was targeted by ${scams.length} scam${scams.length > 1 ? 's' : ''} in the last ${days} day${days > 1 ? 's' : ''}${top.length ? `, mostly ${top[0]}` : ''}, and Kavach stopped ${scams.length > 1 ? 'them' : 'it'}.`
          : `No scams reported in the last ${days} day${days > 1 ? 's' : ''}.`,
        callsStopped.length ? `Kavach listened in and stopped ${callsStopped.length} scam call${callsStopped.length > 1 ? 's' : ''} live.` : '',
        impersonations.length ? `Someone pretended to be ${impersonations[0].familyMember} ${impersonations.length > 1 ? `${impersonations.length} times` : 'once'}; Kavach checked with the real ${impersonations[0].familyMember} and caught it.` : '',
        sus.length ? `${sus.length} other message${sus.length > 1 ? 's were' : ' was'} worth a second look.` : '',
        checkins.length
          ? `${n} checked in ${checkins.length} time${checkins.length > 1 ? 's' : ''}; most recently she said she felt ${last.feeling.replace('_', ' ')}${last.note ? ` ("${last.note}")` : ''}.`
          : `${n} hasn't checked in during this period. It might be worth a call.`,
      ].filter(Boolean);
      const structured = {
        days,
        checksTotal: checks.length,
        scamsCaught: scams.length,
        suspicious: sus.length,
        alertsSent: alerts.length,
        checkins: checkins.length,
        lastCheckin: last?.at ?? null,
        lastFeeling: last?.feeling ?? null,
        topScamTypes: top,
        summary: parts.join(' '),
      };
      return { content: [{ type: 'text', text: structured.summary }], structuredContent: structured };
    },
  );

  // ---------------------------------------------------------------- resources
  const publicPattern = ({ id, name, region, truth, advice }) => ({ id, name, region, truth, advice });

  server.registerResource(
    'scam-patterns',
    'kavach://scam-patterns',
    { title: 'Known scam families', description: 'Scam families Kavach recognises, with the fact that breaks each one', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(PATTERNS.map(publicPattern), null, 2) }] }),
  );

  server.registerResource(
    'scam-pattern',
    new ResourceTemplate('kavach://scam-patterns/{id}', {
      list: async () => ({ resources: PATTERNS.map((p) => ({ uri: `kavach://scam-patterns/${p.id}`, name: p.id, title: p.name, mimeType: 'application/json' })) }),
      complete: { id: (v) => PATTERNS.map((p) => p.id).filter((id) => id.startsWith(v)) },
    }),
    { title: 'Scam family', description: 'One scam family: how it works and what to say', mimeType: 'application/json' },
    async (uri, { id }) => {
      const p = PATTERNS.find((x) => x.id === id);
      if (!p) throw new Error(`Unknown scam family: ${id}`);
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(publicPattern(p), null, 2) }] };
    },
  );

  server.registerResource(
    'activity',
    'kavach://activity',
    { title: 'Recent activity', description: 'Checks, alerts and check-ins from the last 7 days', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(eventsSince(7 * DAY), null, 2) }] }),
  );

  // ---------------------------------------------------------------- prompts
  server.registerPrompt(
    'scam_safety_check',
    {
      title: 'Is this a scam?',
      description: 'Walk the person through checking a suspicious call or message',
      argsSchema: { message: z.string().describe('What the caller or message said') },
    },
    ({ message }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Someone contacted me and I'm not sure if it's real. Here's what they said: "${message}". Please use check_message, then tell me in two or three short sentences what to do. Speak simply and kindly.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'weekly_family_update',
    { title: 'Weekly update for family', description: 'A warm weekly summary for family members' },
    () => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: 'Use family_digest with days=7 and write me a short, warm update about how my parent is doing, including any scams that were stopped.' },
        },
      ],
    }),
  );

  return server;
}
