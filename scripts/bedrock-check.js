// One Bedrock call to confirm your AWS setup works. Costs a tiny fraction of a rupee.
// Usage: npm run bedrock:check
import '../server/env.js';
import { askLlm, llmConfigured } from '../server/assess.js';
import { analyze } from 'kavach-scam-patterns';
import { ledger, canSpend } from '../server/spend.js';

const model = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
const region = process.env.AWS_REGION || 'us-east-1';
console.log(`Model: ${model}   Region: ${region}`);

if (!llmConfigured()) {
  console.log('Bedrock is OFF. In .env, add: KAVACH_LLM=bedrock (plus AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY).');
  process.exit(1);
}
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env.');
  process.exit(1);
}
const budget = canSpend(model);
if (!budget.ok) {
  console.log(budget.reason);
  process.exit(1);
}

const text = 'Someone called saying they are from the electricity board and my power will be cut tonight unless I pay on a link they will send.';
try {
  const t0 = Date.now();
  const r = await askLlm(text, analyze(text));
  console.log(`\nWorks. Bedrock answered in ${Date.now() - t0} ms:`);
  console.log(`  verdict: ${r.verdict}  (confidence ${r.confidence})`);
  console.log(`  reason:  ${r.reason}`);
  const l = ledger();
  console.log(`\nSpent so far: ₹${l.spentInr.toFixed(4)} of ₹${l.capInr} cap (${l.calls} calls)`);
} catch (err) {
  const msg = String(err.message || err);
  console.log(`\nBedrock call failed: ${err.name || 'Error'}: ${msg}`);
  if (/AccessDenied|not authorized/i.test(msg)) console.log('Fix: the IAM user needs the bedrock:InvokeModel permission for this model (see the policy in the instructions).');
  else if (/model access|don't have access|not available|ValidationException/i.test(msg)) console.log('Fix: in the Bedrock console (us-east-1), make sure Amazon Nova Lite is enabled for your account. New accounts can take a few hours to activate.');
  else if (/credential|signature|InvalidClientTokenId|UnrecognizedClient/i.test(msg)) console.log('Fix: the access key in .env is wrong or has a typo. Copy it again, with no spaces or quotes.');
  process.exit(1);
}
