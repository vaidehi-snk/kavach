import { TACTICS, PATTERNS, LEGIT_CUES } from './patterns.js';
import { detectLanguage } from './multilingual.js';
import { PHRASES, PATTERN_TEXT, TACTIC_LABELS } from './translations.js';

export { TACTICS, PATTERNS, LEGIT_CUES, detectLanguage, PHRASES };
export const LANGUAGES = ['en', 'es', 'hi'];

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

  const lang = LANGUAGES.includes(opts.lang) ? opts.lang : detectLanguage(t);
  return {
    verdict,
    lang,
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

/** A scam family's name, truth and advice in the given language (falls back to English). */
export function localizePattern(pattern, lang = 'en') {
  if (!pattern) return null;
  const tr = PATTERN_TEXT[lang]?.[pattern.id];
  return tr ? { ...pattern, ...tr, lang } : { ...pattern, lang: 'en' };
}

/** Red-flag labels in the given language. */
export function localizeFlags(redFlags, lang = 'en') {
  return redFlags.map((f) => TACTIC_LABELS[lang]?.[f.id] || f.label.toLowerCase());
}

/** A short sentence suitable for a voice assistant to speak aloud, in the result's language. */
export function spokenSummary(result, lang = result.lang || 'en') {
  const P = PHRASES[lang] || PHRASES.en;
  const pat = localizePattern(result.pattern, lang);
  if (result.verdict === 'scam') {
    return [P.scam, pat?.truth, pat?.advice || P.fallbackAdvice].filter(Boolean).join(' ');
  }
  if (result.verdict === 'suspicious') {
    const flags = localizeFlags(result.redFlags, lang).slice(0, 2).join(P.and);
    return P.suspicious(flags);
  }
  return P.safe;
}
