// Family alerts. Channels are optional and additive:
//   - ntfy.sh push notification (free, no account: install the ntfy app, subscribe to a topic)
//   - Amazon SNS topic (email/SMS subscribers), set KAVACH_SNS_TOPIC_ARN
//   - always logged to the console and the activity log
import { EventEmitter } from 'node:events';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// In-process bus so the demo UI can show alerts arriving on the family member's phone.
export const alertBus = new EventEmitter();

const NTFY_BASE = process.env.KAVACH_NTFY_BASE || 'https://ntfy.sh';
const SNS_TOPIC = process.env.KAVACH_SNS_TOPIC_ARN;
let sns;

export async function notify(member, { title, message, priority = 'high', tags = ['rotating_light'] }) {
  const results = [];

  const topic = member.ntfyTopic || process.env.KAVACH_NTFY_TOPIC;
  if (topic) {
    try {
      const res = await fetch(`${NTFY_BASE}/${encodeURIComponent(topic)}`, {
        method: 'POST',
        body: message,
        headers: { Title: title, Priority: priority, Tags: tags.join(',') },
        signal: AbortSignal.timeout(5000),
      });
      results.push({ channel: 'push', ok: res.ok, status: res.status });
    } catch (err) {
      results.push({ channel: 'push', ok: false, error: String(err.message || err) });
    }
  }

  if (SNS_TOPIC) {
    try {
      sns ??= new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
      const out = await sns.send(new PublishCommand({ TopicArn: SNS_TOPIC, Subject: title.slice(0, 99), Message: message }));
      results.push({ channel: 'sns', ok: true, id: out.MessageId });
    } catch (err) {
      results.push({ channel: 'sns', ok: false, error: String(err.message || err) });
    }
  }

  console.log(`[kavach alert -> ${member.name}] ${title}: ${message}`);
  alertBus.emit('alert', { to: member.name, relation: member.relation, title, message, priority, at: new Date().toISOString() });
  results.push({ channel: 'log', ok: true });
  return results;
}
