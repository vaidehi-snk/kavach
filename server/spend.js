// Hard spending cap for Bedrock. AWS budget alerts only email you (and lag by hours),
// so Kavach keeps its own ledger and refuses to call Bedrock once the cap is reached.
// After that it keeps working on the free rules engine.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = process.env.KAVACH_DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = join(DATA_DIR, 'spend.json');

export const CAP_INR = Number(process.env.KAVACH_SPEND_CAP_INR ?? 50);
const USD_INR = Number(process.env.KAVACH_USD_INR ?? 90); // rounded up on purpose

// USD per 1M tokens. Slightly above list price so the cap trips early, never late.
// Any other model must have its prices set explicitly, or Bedrock stays off.
const KNOWN_PRICES = {
  'nova-lite': { input: 0.08, output: 0.3 },
  'nova-micro': { input: 0.05, output: 0.2 },
};

export function priceFor(modelId) {
  if (process.env.KAVACH_PRICE_IN_PER_M_USD && process.env.KAVACH_PRICE_OUT_PER_M_USD) {
    return { input: Number(process.env.KAVACH_PRICE_IN_PER_M_USD), output: Number(process.env.KAVACH_PRICE_OUT_PER_M_USD) };
  }
  const key = Object.keys(KNOWN_PRICES).find((k) => modelId.includes(k));
  return key ? KNOWN_PRICES[key] : null;
}

function read() {
  if (!existsSync(FILE)) return { spentInr: 0, calls: 0, inputTokens: 0, outputTokens: 0 };
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

export function ledger() {
  const l = read();
  return { ...l, capInr: CAP_INR, remainingInr: Math.max(0, CAP_INR - l.spentInr) };
}

// Worst case for one call: ~2,000 input + 300 output tokens.
export function canSpend(modelId) {
  const p = priceFor(modelId);
  if (!p) return { ok: false, reason: `No price known for ${modelId}; set KAVACH_PRICE_IN_PER_M_USD and KAVACH_PRICE_OUT_PER_M_USD` };
  const worst = ((2000 * p.input + 300 * p.output) / 1e6) * USD_INR;
  const l = read();
  if (l.spentInr + worst > CAP_INR) return { ok: false, reason: `Spending cap of ₹${CAP_INR} reached (spent ₹${l.spentInr.toFixed(2)})` };
  return { ok: true };
}

export function record(modelId, usage = {}) {
  const p = priceFor(modelId);
  const inT = usage.inputTokens || 0;
  const outT = usage.outputTokens || 0;
  const inr = ((inT * p.input + outT * p.output) / 1e6) * USD_INR;
  const l = read();
  l.spentInr = Number((l.spentInr + inr).toFixed(6));
  l.calls += 1;
  l.inputTokens += inT;
  l.outputTokens += outT;
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(l, null, 2));
  return l;
}
