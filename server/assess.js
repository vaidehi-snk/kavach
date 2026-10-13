// Hybrid scam assessment: fast explainable rules + Amazon Bedrock for judgment.
//
//   rules  -> deterministic, offline, ~1 ms. Always runs.
//   llm    -> Bedrock Converse call that also sees what the rules found.
//   hybrid -> rules first; if rules are already very confident it's a scam, skip the LLM
//             (fast + free); otherwise ask Bedrock. Rules act as a floor: the LLM can raise
//             concern but cannot clear a message the rules call a clear scam.
// If Bedrock is not configured or fails, we fall back to rules and say so.
import { analyze, spokenSummary, PATTERNS } from 'kavach-scam-patterns';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { canSpend, record } from './spend.js';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-lite-v1:0';
const REGION = process.env.AWS_REGION || 'us-east-1';
const LLM_TIMEOUT_MS = Number(process.env.KAVACH_LLM_TIMEOUT_MS || 8000);
const RULES_SHORTCUT = 0.75;

let client;
const bedrock = () => (client ??= new BedrockRuntimeClient({ region: REGION }));

// Opt-in so nothing calls (or bills) AWS unless you ask for it.
export const llmConfigured = () => process.env.KAVACH_LLM === 'bedrock';

const SEVERITY = { likely_safe: 0, suspicious: 1, scam: 2 };
const FAMILY_IDS = PATTERNS.map((p) => p.id);

const SYSTEM = `You protect older adults from phone, text and email scams.
You will get a description of something a person heard or read, plus warning signs an automatic rule engine found.
Decide if it is a scam. Be careful with genuine messages: real banks send fraud alerts that tell you to call the number on your card; real family members call about real accidents without asking for money.
Reply with ONLY a JSON object, no prose:
{"verdict":"scam"|"suspicious"|"likely_safe","confidence":0-1,"family":one of ${JSON.stringify([...FAMILY_IDS, 'other', 'none'])},"reason":"one short sentence a 75-year-old would understand","advice":"one short sentence telling them what to do now"}`;

function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in model output');
  const j = JSON.parse(m[0]);
  if (!(j.verdict in SEVERITY)) throw new Error(`bad verdict ${j.verdict}`);
  return j;
}

export async function askLlm(text, rules) {
  const found = rules.redFlags.map((f) => f.label).join('; ') || 'none';
  const user = `Message or call description:\n"""${text.slice(0, 4000)}"""\n\nRule engine warning signs: ${found}\nRule engine best match: ${rules.pattern?.name || 'none'} (score ${rules.score})`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  try {
    const out = await bedrock().send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM }],
        messages: [{ role: 'user', content: [{ text: user }] }],
        inferenceConfig: { maxTokens: 300, temperature: 0 },
      }),
      { abortSignal: ctrl.signal },
    );
    record(MODEL_ID, out.usage);
    const txt = out.output?.message?.content?.map((c) => c.text || '').join('') || '';
    return { ...parseJson(txt), model: MODEL_ID, usage: out.usage };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} text
 * @param {{region?: string, mode?: 'rules'|'llm'|'hybrid'}} [opts]
 */
export async function assess(text, opts = {}) {
  const mode = opts.mode || process.env.KAVACH_MODE || 'hybrid';
  const rules = analyze(text, { region: opts.region });
  const base = { ...rules, engine: 'rules', spoken: spokenSummary(rules) };

  if (mode === 'rules' || !llmConfigured()) {
    return { ...base, llmNote: mode === 'rules' ? undefined : 'Bedrock not configured; rules only' };
  }
  if (mode === 'hybrid' && rules.score >= RULES_SHORTCUT) return { ...base, engine: 'rules (confident)' };

  const budget = canSpend(MODEL_ID);
  if (!budget.ok) return { ...base, engine: 'rules (spend cap)', llmNote: budget.reason };

  let llm;
  try {
    llm = await askLlm(text, rules);
  } catch (err) {
    return { ...base, engine: 'rules (llm failed)', llmNote: String(err.message || err) };
  }

  let verdict = llm.verdict;
  if (mode === 'hybrid' && SEVERITY[rules.verdict] > SEVERITY[verdict] && rules.verdict === 'scam') verdict = 'scam';

  const pattern =
    PATTERNS.find((p) => p.id === llm.family) && llm.family !== rules.pattern?.id
      ? (({ id, name, region, truth, advice }) => ({ id, name, region, truth, advice }))(PATTERNS.find((p) => p.id === llm.family))
      : rules.pattern;

  const result = {
    ...rules,
    verdict,
    score: Math.max(rules.score, verdict === 'scam' ? Math.max(0.5, llm.confidence ?? 0.5) : verdict === 'suspicious' ? 0.35 : 0),
    pattern,
    engine: mode === 'llm' ? 'bedrock' : 'rules + bedrock',
    llm: { verdict: llm.verdict, confidence: llm.confidence, reason: llm.reason, model: llm.model },
  };
  const truth = pattern?.truth && verdict === 'scam' ? ` ${pattern.truth}` : '';
  result.spoken =
    verdict === 'scam'
      ? `This looks like a scam. ${llm.reason}${truth} ${llm.advice || pattern?.advice || 'Please hang up and do not send any money.'}`.replace(/\s+/g, ' ')
      : verdict === 'suspicious'
        ? `I'm worried about this. ${llm.reason} ${llm.advice || 'Call back on a number you already trust before doing anything.'}`
        : spokenSummary({ ...rules, verdict: 'likely_safe' });
  return result;
}
