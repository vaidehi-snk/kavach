import { TACTICS, PATTERNS, LEGIT_CUES } from './patterns.js';

export { TACTICS, PATTERNS, LEGIT_CUES };

const DEFAULT_PATTERN_WEIGHT = 0.28; // per matched cue; strongly diagnostic families set their own
const PATTERN_CAP = 0.55;
export const THRESHOLDS = { scam: 0.5, suspicious: 0.28 };

function normalize(text) {
  return String(text || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function hits(cues, text) {
  return cues.filter((re) => re.test(text)).length;
}

/**
 * Analyze a description of a call, text, or email.
 * Returns a risk score in [0, 1], a verdict, the scam family that fits best,
 * and the red flags found, in plain language.
 *
 * @param {string} text  What the person heard or read, in their own words.
 * @param {{region?: 'US'|'IN'|'GLOBAL'}} [opts]
 */
export function analyze(text, opts = {}) {
  const t = normalize(text);
  const redFlags = [];
  let tacticScore = 0;

  for (const [id, tactic] of Object.entries(TACTICS)) {
    const n = hits(tactic.cues, t);
    if (n > 0) {
      // second hit of the same tactic adds a little, not a full weight
      tacticScore += tactic.weight * (1 + 0.25 * (n - 1));
      redFlags.push({ id, label: tactic.label });
    }
  }

  const ranked = PATTERNS.map((p) => {
    const n = hits(p.cues, t);
    let s = Math.min(PATTERN_CAP, n * (p.weight ?? DEFAULT_PATTERN_WEIGHT));
    if (n && opts.region && p.region !== 'GLOBAL' && p.region !== opts.region) s *= 0.85;
    return { pattern: p, n, score: s };
  })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const legitHits = hits(LEGIT_CUES.cues, t);
  const legitScore = legitHits ? LEGIT_CUES.weight * Math.min(2, legitHits) : 0;

  // Multiple independent tactics together are far more telling than any one alone.
  const combo = redFlags.length >= 3 ? 0.1 : 0;
  const raw = tacticScore + (best ? best.score : 0) + combo + legitScore;
  const score = Math.max(0, Math.min(1, raw));

  const verdict =
    score >= THRESHOLDS.scam ? 'scam' : score >= THRESHOLDS.suspicious ? 'suspicious' : 'likely_safe';

  return {
    verdict,
    score: Number(score.toFixed(3)),
    pattern: best
      ? {
          id: best.pattern.id,
          name: best.pattern.name,
          region: best.pattern.region,
          truth: best.pattern.truth,
          advice: best.pattern.advice,
        }
      : null,
    otherPatterns: ranked.slice(1, 3).map((x) => x.pattern.id),
    redFlags,
    legitSignals: legitHits,
  };
}

/** A short sentence suitable for a voice assistant to speak aloud. */
export function spokenSummary(result) {
  if (result.verdict === 'scam') {
    const truth = result.pattern ? ` ${result.pattern.truth}` : '';
    const advice = result.pattern ? ` ${result.pattern.advice}` : ' Please hang up and do not send any money.';
    return `This looks like a scam.${truth}${advice}`;
  }
  if (result.verdict === 'suspicious') {
    const flags = result.redFlags.map((f) => f.label.toLowerCase()).slice(0, 2).join(' and ');
    return `I'm not sure, but I'm worried. I noticed ${flags || 'some warning signs'}. Before you do anything, call back on a number you already trust.`;
  }
  return "I don't see the usual warning signs of a scam. If anything still feels off, it's always okay to hang up and call back on a number you trust.";
}
