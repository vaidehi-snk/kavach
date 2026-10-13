// Kavach evaluation.
// Usage: node eval/run.js [--split dev|holdout|all] [--mode rules|hybrid|llm] [--verbose]
//
// The set is split deterministically by id hash. Rules were tuned ONLY on "dev";
// "holdout" is the honest number to report.
import { createHash } from 'node:crypto';
import { CASES } from './cases.js';
import { analyze } from 'kavach-scam-patterns';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const split = opt('split', 'holdout');
const mode = opt('mode', 'rules');
const verbose = args.includes('--verbose');

export function splitOf(id) {
  const h = createHash('sha256').update(id).digest()[0];
  return h % 2 === 0 ? 'dev' : 'holdout';
}

async function classify(text, region) {
  if (mode === 'rules') return analyze(text, { region });
  const { assess } = await import('../server/assess.js');
  return assess(text, { region, mode });
}

const cases = CASES.filter((c) => split === 'all' || splitOf(c.id) === split);
const rows = [];
for (const c of cases) {
  const t0 = performance.now();
  const res = await classify(c.text, c.region);
  rows.push({ ...c, verdict: res.verdict, score: res.score, pattern: res.pattern?.id, ms: performance.now() - t0 });
}

const scams = rows.filter((r) => r.label === 'scam');
const legit = rows.filter((r) => r.label === 'legit');
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + '%' : 'n/a');
const caught = scams.filter((r) => r.verdict === 'scam').length;
const flagged = scams.filter((r) => r.verdict !== 'likely_safe').length;
const falseScam = legit.filter((r) => r.verdict === 'scam').length;
const falseFlag = legit.filter((r) => r.verdict !== 'likely_safe').length;
const avgMs = rows.reduce((a, r) => a + r.ms, 0) / (rows.length || 1);

const summary = {
  mode,
  split,
  cases: rows.length,
  scams: scams.length,
  legit: legit.length,
  scam_called_scam: pct(caught, scams.length),
  scam_flagged_any: pct(flagged, scams.length),
  missed_scams: scams.length - flagged,
  legit_called_scam: pct(falseScam, legit.length),
  legit_flagged_any: pct(falseFlag, legit.length),
  avg_latency_ms: Math.round(avgMs),
};
console.table(summary);

const mistakes = rows.filter(
  (r) => (r.label === 'scam' && r.verdict !== 'scam') || (r.label === 'legit' && r.verdict !== 'likely_safe'),
);
if (verbose || mistakes.length) {
  console.log('\nNot perfect on:');
  for (const r of mistakes) console.log(`  [${r.label} -> ${r.verdict} ${r.score}] ${r.id}: ${r.text.slice(0, 90)}...`);
}
if (args.includes('--json')) console.log(JSON.stringify(summary));
