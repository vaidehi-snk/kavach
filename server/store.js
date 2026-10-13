// Tiny JSON-file store: household profile + an activity log (checks, alerts, check-ins).
// Swap for DynamoDB in production; the interface stays the same.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const DATA_DIR = process.env.KAVACH_DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = join(DATA_DIR, 'household.json');

const DEFAULT = {
  person: { name: 'Shanta', preferredName: 'Aaji', region: 'IN', timezone: 'Asia/Kolkata' },
  family: [
    { id: 'rohan', name: 'Rohan', relation: 'son', ntfyTopic: process.env.KAVACH_NTFY_TOPIC || '', email: '' },
  ],
  events: [],
};

let state;
function load() {
  if (state) return state;
  if (existsSync(FILE)) state = JSON.parse(readFileSync(FILE, 'utf8'));
  else state = structuredClone(DEFAULT);
  return state;
}
function save() {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export const household = () => load();

export function addEvent(type, data) {
  const ev = { id: randomUUID(), type, at: new Date().toISOString(), ...data };
  load().events.push(ev);
  if (state.events.length > 2000) state.events.splice(0, state.events.length - 2000);
  save();
  return ev;
}

export function eventsSince(ms) {
  const cutoff = Date.now() - ms;
  return load().events.filter((e) => Date.parse(e.at) >= cutoff);
}

export function findFamily(nameOrRelation) {
  const fam = load().family;
  if (!nameOrRelation) return fam;
  const q = nameOrRelation.toLowerCase();
  return fam.filter((f) => f.name.toLowerCase() === q || f.relation.toLowerCase() === q || f.id === q);
}

export function setHousehold(patch) {
  const s = load();
  if (patch.person) s.person = { ...s.person, ...patch.person };
  if (patch.family) s.family = patch.family;
  save();
  return s;
}
