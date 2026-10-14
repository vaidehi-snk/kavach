// Kavach MCP server definition (spec 2025-11-25).
// Tools:      check_message, verify_caller, alert_family, daily_checkin, family_digest
// Resources:  kavach://scam-patterns, kavach://scam-patterns/{id}, kavach://activity
// Prompts:    scam_safety_check, weekly_family_update
// Elicitation is used to get the person's explicit consent before anyone is contacted.
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PATTERNS } from 'kavach-scam-patterns';
import { assess } from './assess.js';
import { household, addEvent, eventsSince, findFamily } from './store.js';
import { notify } from './notify.js';
import { requestVerification } from './verify.js';

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
  const title = customTitle || urgency === 'urgent' ? `Kavach: ${person.preferredName} may be talking to a scammer` : `Kavach update about ${person.preferredName}`;
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
        offerAlert: z.boolean().optional().default(true).describe('Offer to alert family if this is a scam'),
      },
      outputSchema: {
        verdict: z.enum(['scam', 'suspicious', 'likely_safe']),
        score: z.number(),
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
    async ({ text, channel, region, offerAlert }) => {
      const hh = household();
      const r = await assess(text, { region: region || hh.person.region });
      addEvent('check', { verdict: r.verdict, scamType: r.pattern?.id || null, channel: channel || 'other', excerpt: excerpt(text) });

      let familyAlerted = [];
      let spoken = r.spoken;
      const impersonation = ['grandparent_emergency', 'voice_clone_family'].includes(r.pattern?.id) && r.verdict !== 'likely_safe';
      if (r.verdict === 'scam' && offerAlert !== false) {
        const family = findFamily();
        const names = family.map((f) => f.name).join(' and ');
        const ask = await confirmWithPerson(
          server,
          `${r.spoken}\n\nShall I let ${names} know, so they can call you?`,
          `Tell ${names}`,
        );
        if (ask.confirmed) {
          const delivered = await sendAlert(family, {
            reason: `${hh.person.preferredName} reported a likely ${r.pattern?.name || 'scam'}: "${excerpt(text, 200)}"`,
            urgency: 'urgent',
          });
          familyAlerted = delivered.map((d) => d.to);
          spoken += ` I've let ${familyAlerted.join(' and ')} know.`;
        } else if (!ask.supported) {
          spoken += ` Would you like me to let ${names} know?`;
        }
      }

      if (impersonation && !familyAlerted.length) {
        spoken += ` If you're not sure, say "check with ${findFamily()[0]?.name || 'my family'}" and I'll ask them directly on their phone.`;
      }
      const structured = {
        verdict: r.verdict,
        score: r.score,
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
    async ({ claimedName, request: rawRequest, timeoutSeconds }, extra) => {
      const request = rawRequest?.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '') || undefined;
      const hh = household();
      const member = findFamily(claimedName)[0] || (claimedName ? null : hh.family[0]);
      if (!member) {
        const known = hh.family.map((f) => f.name).join(', ');
        const text = `${claimedName} isn't someone I know in your family (I know ${known}). Please be very careful: hang up and call your family on numbers you already have.`;
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
        spoken = `${hh.person.preferredName}, that is not ${n}. ${n} just told me he is not calling you. This is a scam, and the voice may be copied by a computer. Hang up now and do not send any money.`;
        await sendAlert([member], { title: `Kavach: someone is pretending to be you`, reason: `You told Kavach it's not you calling ${hh.person.preferredName}. Kavach told her to hang up${request ? `. The caller wanted: "${excerpt(request, 160)}"` : ''}.`, urgency: 'urgent' });
      } else if (r.answer === 'yes') {
        verified = 'confirmed';
        spoken = `Good news, ${hh.person.preferredName}. ${n} confirmed on his own phone that it really is him calling.`;
      } else {
        verified = 'no_answer';
        spoken = `${n} hasn't answered yet. Until he does, please don't send any money or share any codes. Hang up and call ${n} on the number saved in your phone.`;
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
        note: z.string().optional().describe('Anything they mentioned, in their words'),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ feeling, note }) => {
      const hh = household();
      addEvent('checkin', { feeling, note: note ? excerpt(note, 200) : undefined });
      let text =
        feeling === 'good'
          ? `Lovely to hear, ${hh.person.preferredName}. I've noted it for the family.`
          : feeling === 'okay'
            ? `Thanks for telling me, ${hh.person.preferredName}. I've noted it.`
            : `I'm sorry you're not feeling well, ${hh.person.preferredName}.`;
      if (feeling === 'not_good') {
        const family = findFamily();
        const names = family.map((f) => f.name).join(' and ');
        const ask = await confirmWithPerson(server, `${text} Shall I ask ${names} to give you a call?`, `Ask ${names} to call`);
        if (ask.confirmed) {
          await sendAlert(family, { reason: `${hh.person.preferredName} said she isn't feeling well today.${note ? ` She said: "${note}"` : ''}`, urgency: 'normal' });
          text += ` I've asked ${names} to call you.`;
        } else if (!ask.supported) text += ` Would you like me to ask ${names} to call you?`;
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
