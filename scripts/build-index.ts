// Validates everything in src/content and generates _meta.json and _search.json.
// Usage: node scripts/build-index.ts [--strict]   (--strict exits 1 on errors)

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Domain, Hobby, SkillTree, ContentMeta, HobbyMeta, SearchRow, Tier } from '../src/lib/types.ts';

const CONTENT = fileURLToPath(new URL('../src/content/', import.meta.url));
const strict = process.argv.includes('--strict');
const errors: string[] = [];
const warnings: string[] = [];

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (e) {
    errors.push(`${basename(path)}: invalid JSON (${(e as Error).message})`);
    return null;
  }
}

const listJson = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];

const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isStringArray = (v: unknown, min = 0) =>
  Array.isArray(v) && v.length >= min && v.every(isNonEmptyString);
const inRange = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

// ---------- domains ----------
const domains = readJson<Domain[]>(join(CONTENT, 'domains.json')) ?? [];
const domainIds = new Set<string>();
for (const d of domains) {
  if (!isNonEmptyString(d.id) || !isNonEmptyString(d.name)) errors.push(`domain missing id/name: ${JSON.stringify(d)}`);
  if (domainIds.has(d.id)) errors.push(`duplicate domain id "${d.id}"`);
  if (!/^#[0-9a-f]{6}$/i.test(d.color)) errors.push(`domain "${d.id}": color must be #rrggbb`);
  domainIds.add(d.id);
}

// ---------- hobbies ----------
const hobbies = new Map<string, Hobby & { domain: string }>();
for (const file of listJson(join(CONTENT, 'hobbies'))) {
  const domain = file.replace(/\.json$/, '');
  if (!domainIds.has(domain)) errors.push(`hobbies/${file}: no domain with id "${domain}"`);
  const list = readJson<Hobby[]>(join(CONTENT, 'hobbies', file));
  if (!Array.isArray(list)) continue;
  for (const h of list) {
    const where = `hobbies/${file} › ${h.id ?? '?'}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(h.id ?? '')) errors.push(`${where}: id must be kebab-case`);
    if (hobbies.has(h.id)) errors.push(`${where}: duplicate hobby id (also in ${hobbies.get(h.id)!.domain})`);
    if (!isNonEmptyString(h.name)) errors.push(`${where}: missing name`);
    if (!isNonEmptyString(h.summary)) errors.push(`${where}: missing summary`);
    if (!inRange(h.pop, 1, 5)) errors.push(`${where}: pop must be 1-5`);
    const s = h.stats;
    if (!s) errors.push(`${where}: missing stats`);
    else {
      if (!inRange(s.difficulty, 1, 5)) errors.push(`${where}: stats.difficulty must be 1-5`);
      if (typeof s.hours !== 'number' || s.hours <= 0) errors.push(`${where}: stats.hours must be > 0`);
      if (!inRange(s.cost, 0, 4)) errors.push(`${where}: stats.cost must be 0-4`);
      if (!isStringArray(s.gear)) errors.push(`${where}: stats.gear must be a string array`);
      if (!['solo', 'group', 'either'].includes(s.social)) errors.push(`${where}: stats.social invalid`);
      if (!['indoor', 'outdoor', 'either'].includes(s.setting)) errors.push(`${where}: stats.setting invalid`);
      if (!Array.isArray(s.focus) || !s.focus.length || !s.focus.every((f) => ['physical', 'mental', 'creative'].includes(f)))
        errors.push(`${where}: stats.focus must list physical/mental/creative`);
    }
    if (!isStringArray(h.tags)) errors.push(`${where}: tags must be a string array`);
    if (!isStringArray(h.synergies)) errors.push(`${where}: synergies must be a string array`);
    hobbies.set(h.id, { ...h, domain });
  }
}
for (const h of hobbies.values()) {
  for (const syn of h.synergies ?? []) {
    if (syn === h.id) errors.push(`${h.id}: lists itself as a synergy`);
    else if (!hobbies.has(syn)) warnings.push(`${h.id}: synergy "${syn}" doesn't exist yet`);
  }
}

// ---------- trees ----------
const meta: ContentMeta = { generated: new Date().toISOString(), hobbies: {} };
const search: SearchRow[] = [];

for (const file of listJson(join(CONTENT, 'trees'))) {
  const id = file.replace(/\.json$/, '');
  const tree = readJson<SkillTree>(join(CONTENT, 'trees', file));
  if (!tree) continue;
  const where = `trees/${file}`;
  if (tree.hobby !== id) errors.push(`${where}: "hobby" must equal the file name (${id})`);
  if (!hobbies.has(id)) errors.push(`${where}: no hobby with id "${id}"`);
  if (!Array.isArray(tree.nodes) || !tree.nodes.length) {
    errors.push(`${where}: no nodes`);
    continue;
  }

  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  if (byId.size !== tree.nodes.length) errors.push(`${where}: duplicate node ids`);
  const tiers = [0, 0, 0, 0, 0];
  const party: HobbyMeta['party'] = [];

  for (const n of tree.nodes) {
    const at = `${where} › ${n.id}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.id ?? '')) errors.push(`${at}: id must be kebab-case`);
    if (!isNonEmptyString(n.name)) errors.push(`${at}: missing name`);
    if (!inRange(n.tier, 1, 5)) {
      errors.push(`${at}: tier must be 1-5`);
      continue;
    }
    tiers[n.tier - 1]++;
    if (!isNonEmptyString(n.summary)) errors.push(`${at}: missing summary`);
    if (!isStringArray(n.steps, 2)) errors.push(`${at}: needs at least 2 steps`);
    if (!isStringArray(n.drills, 1)) errors.push(`${at}: needs at least 1 drill`);
    if (!isNonEmptyString(n.mastery)) errors.push(`${at}: missing mastery check`);
    if (typeof n.hours !== 'number' || n.hours <= 0) errors.push(`${at}: hours must be > 0`);
    if (!Array.isArray(n.requires)) errors.push(`${at}: requires must be an array`);
    for (const r of n.requires ?? []) {
      const req = byId.get(r);
      if (!req) errors.push(`${at}: requires unknown node "${r}"`);
      else if (req.tier > n.tier) errors.push(`${at}: requires "${r}", which has a higher tier`);
    }
    if (n.tier > 1 && !(n.requires ?? []).length) warnings.push(`${at}: tier ${n.tier} node has no prerequisites`);
    if (n.partyTrick !== undefined) {
      if (typeof n.partyTrick !== 'number' || n.partyTrick <= 0 || n.partyTrick > 120)
        errors.push(`${at}: partyTrick must be minutes between 1 and 120`);
      else party.push({ id: n.id, name: n.name, minutes: n.partyTrick, tier: n.tier as Tier });
    }
    search.push([id, n.id, n.name, n.tier as Tier]);
  }

  // Cycle check (depth-first, white/grey/black)
  const state = new Map<string, 1 | 2>();
  const visit = (nid: string, path: string[]): void => {
    if (state.get(nid) === 2) return;
    if (state.get(nid) === 1) {
      errors.push(`${where}: prerequisite cycle ${[...path, nid].join(' → ')}`);
      return;
    }
    state.set(nid, 1);
    for (const r of byId.get(nid)?.requires ?? []) if (byId.has(r)) visit(r, [...path, nid]);
    state.set(nid, 2);
  };
  for (const n of tree.nodes) visit(n.id, []);

  tiers.forEach((c, i) => {
    if (!c) warnings.push(`${where}: no ${['Novice', 'Apprentice', 'Adept', 'Expert', 'Master'][i]} nodes`);
  });
  meta.hobbies[id] = { nodes: tree.nodes.length, tiers, party };
}

writeFileSync(join(CONTENT, '_meta.json'), JSON.stringify(meta));
writeFileSync(join(CONTENT, '_search.json'), JSON.stringify(search));

// ---------- report ----------
const charted = Object.keys(meta.hobbies).length;
console.log(
  `content: ${domains.length} domains · ${hobbies.size} hobbies · ${charted} charted · ${search.length} skill nodes`,
);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 40)) console.log(`  · ${w}`);
  if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  if (strict) process.exit(1);
}
