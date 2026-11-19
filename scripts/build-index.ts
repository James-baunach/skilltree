// Validates everything in src/content and generates the derived files the app reads:
//   _meta.json   per-hobby tree stats
//   _search.json every skill node, for search
//   _graph.json  trait profiles, related hobbies and the category heat map
// Usage: node scripts/build-index.ts [--strict]   (--strict exits 1 on errors)

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Domain, Hobby, SkillTree, ContentMeta, HobbyMeta, SearchRow, Tier, Trait, Taxonomy, Graph, Related,
} from '../src/lib/types.ts';
import { parseTraits } from '../src/lib/traits.ts';

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
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------- traits ----------
const traits = readJson<Trait[]>(join(CONTENT, 'traits.json')) ?? [];
const traitIds = new Set(traits.map((t) => t.id));
if (traitIds.size !== traits.length) errors.push('traits.json: duplicate trait ids');

function checkTraits(where: string, s: string) {
  const parsed = parseTraits(s);
  if (!Object.keys(parsed).length) errors.push(`${where}: traits string is empty or malformed`);
  for (const [id, w] of Object.entries(parsed)) {
    if (!traitIds.has(id)) errors.push(`${where}: unknown trait "${id}"`);
    if (w < 0 || w > 3) errors.push(`${where}: trait "${id}" weight must be 0-3`);
  }
  return parsed;
}

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
    if (!KEBAB.test(h.id ?? '')) errors.push(`${where}: id must be kebab-case`);
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
    if (h.traits !== undefined) checkTraits(where, h.traits);
    hobbies.set(h.id, { ...h, domain });
  }
}
for (const h of hobbies.values()) {
  for (const syn of h.synergies ?? []) {
    if (syn === h.id) errors.push(`${h.id}: lists itself as a synergy`);
    else if (!hobbies.has(syn)) warnings.push(`${h.id}: synergy "${syn}" doesn't exist yet`);
  }
}

// ---------- taxonomy (sub-categories) ----------
const taxonomy = readJson<Taxonomy>(join(CONTENT, 'taxonomy.json')) ?? {};
const subOf = new Map<string, { domain: string; sub: string; traits: Record<string, number> }>();
for (const [domain, subs] of Object.entries(taxonomy)) {
  if (!domainIds.has(domain)) errors.push(`taxonomy: unknown domain "${domain}"`);
  const subIds = new Set<string>();
  for (const sub of subs) {
    const where = `taxonomy › ${domain}/${sub.id}`;
    if (!KEBAB.test(sub.id)) errors.push(`${where}: id must be kebab-case`);
    if (subIds.has(sub.id)) errors.push(`${where}: duplicate sub-category id`);
    subIds.add(sub.id);
    if (!isNonEmptyString(sub.name)) errors.push(`${where}: missing name`);
    const profile = checkTraits(where, sub.traits);
    for (const hid of sub.hobbies) {
      const h = hobbies.get(hid);
      if (!h) errors.push(`${where}: unknown hobby "${hid}"`);
      else if (h.domain !== domain) errors.push(`${where}: "${hid}" belongs to domain "${h.domain}"`);
      if (subOf.has(hid)) errors.push(`${where}: "${hid}" is already in ${subOf.get(hid)!.sub}`);
      subOf.set(hid, { domain, sub: sub.id, traits: profile });
    }
  }
}
for (const h of hobbies.values()) if (!subOf.has(h.id)) errors.push(`${h.id}: not placed in any sub-category (taxonomy.json)`);

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
  let hours = 0;

  for (const n of tree.nodes) {
    const at = `${where} › ${n.id}`;
    if (!KEBAB.test(n.id ?? '')) errors.push(`${at}: id must be kebab-case`);
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
    if (n.mistakes !== undefined && !isStringArray(n.mistakes, 1)) errors.push(`${at}: mistakes must be a non-empty string array`);
    if (n.resources !== undefined) {
      if (!Array.isArray(n.resources)) errors.push(`${at}: resources must be an array`);
      else for (const r of n.resources) if (!isNonEmptyString(r.title) || !['book', 'video', 'site', 'course', 'tool'].includes(r.kind))
        errors.push(`${at}: resource needs a title and kind (book|video|site|course|tool)`);
    }
    if (typeof n.hours !== 'number' || n.hours <= 0) errors.push(`${at}: hours must be > 0`);
    else hours += n.hours;
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
  meta.hobbies[id] = { nodes: tree.nodes.length, tiers, party, hours: Math.round(hours) };
}

// ---------- relationship graph ----------
// Each hobby gets a trait vector: its own "traits" string if it has one, else its sub-category's
// default profile. For similarity the vector is smoothed towards its hand-picked synergy partners,
// so two hobbies in the same sub-category still differ by the company they keep.
const T = traits.map((t) => t.id);
const ids = [...hobbies.keys()].filter((id) => subOf.has(id));
const profiles: Record<string, Record<string, number>> = {};
for (const id of ids) {
  const own = hobbies.get(id)!.traits;
  // A hobby's own traits string replaces its group's default profile entirely.
  const p = own ? parseTraits(own) : { ...subOf.get(id)!.traits };
  for (const k of Object.keys(p)) if (!p[k]) delete p[k];
  profiles[id] = p;
}
const raw = ids.map((id) => T.map((t) => profiles[id][t] ?? 0));
const index = new Map(ids.map((id, i) => [id, i]));
const synSet = new Set<string>();
for (const id of ids) for (const s of hobbies.get(id)!.synergies) if (index.has(s)) {
  synSet.add(`${id}|${s}`);
  synSet.add(`${s}|${id}`);
}
const smooth = ids.map((id, i) => {
  const partners = hobbies.get(id)!.synergies.filter((s) => index.has(s)).map((s) => raw[index.get(s)!]);
  const v = raw[i].slice();
  if (partners.length) for (let k = 0; k < T.length; k++) v[k] += (0.35 * partners.reduce((a, p) => a + p[k], 0)) / partners.length;
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
});
const SYN_WEIGHT = 0.2;
const n = ids.length;
const sim = new Float32Array(n * n);
for (let a = 0; a < n; a++) {
  for (let b = a; b < n; b++) {
    let dot = 0;
    const va = smooth[a], vb = smooth[b];
    for (let k = 0; k < T.length; k++) dot += va[k] * vb[k];
    const s = a === b ? 1 : (1 - SYN_WEIGHT) * dot + (synSet.has(`${ids[a]}|${ids[b]}`) ? SYN_WEIGHT : 0);
    sim[a * n + b] = sim[b * n + a] = s;
  }
}
const sharedTraits = (a: string, b: string, max = 3) =>
  T.map((t) => [t, Math.min(profiles[a][t] ?? 0, profiles[b][t] ?? 0)] as const)
    .filter(([, w]) => w > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, max)
    .map(([t]) => t);
const r2 = (x: number) => Math.round(x * 100) / 100;

const related: Record<string, Related[]> = {};
for (let a = 0; a < n; a++) {
  const row: [number, number][] = [];
  for (let b = 0; b < n; b++) if (b !== a) row.push([b, sim[a * n + b]]);
  row.sort((x, y) => y[1] - x[1]);
  related[ids[a]] = row.slice(0, 10).map(([b, s]) => [ids[b], r2(s), sharedTraits(ids[a], ids[b]), synSet.has(`${ids[a]}|${ids[b]}`) ? 1 : 0]);
}

// Category × category: mean of each hobby's best match in the other category, averaged both ways.
// (A plain mean of every pair washes out; "how well does each hobby find a partner over there" reads better.)
const byDomain = domains.map((d) => ids.filter((id) => subOf.get(id)!.domain === d.id).map((id) => index.get(id)!));
const best = (from: number[], to: number[]) =>
  from.reduce((acc, a) => acc + Math.max(...to.filter((b) => b !== a).map((b) => sim[a * n + b])), 0) / from.length;
const matrix = domains.map(() => domains.map(() => 0));
const pairs: Record<string, [string, string, number][]> = {};
for (let i = 0; i < domains.length; i++) {
  for (let j = i; j < domains.length; j++) {
    const A = byDomain[i], B = byDomain[j];
    const v = r2((best(A, B) + best(B, A)) / 2);
    matrix[i][j] = matrix[j][i] = v;
    const top: [string, string, number][] = [];
    for (const a of A) for (const b of B) if (a !== b && (i !== j || a < b)) top.push([ids[a], ids[b], r2(sim[a * n + b])]);
    top.sort((x, y) => y[2] - x[2]);
    // Keep the list varied: one well-connected hobby shouldn't fill every slot.
    const uses = new Map<string, number>();
    const picked: typeof top = [];
    for (const t of top) {
      if (picked.length === 12) break;
      if ((uses.get(t[0]) ?? 0) >= 2 || (uses.get(t[1]) ?? 0) >= 2) continue;
      picked.push(t);
      uses.set(t[0], (uses.get(t[0]) ?? 0) + 1);
      uses.set(t[1], (uses.get(t[1]) ?? 0) + 1);
    }
    pairs[`${domains[i].id}|${domains[j].id}`] = picked;
  }
}

const graph: Graph = { profiles, related, heat: { domains: domains.map((d) => d.id), matrix, pairs } };

writeFileSync(join(CONTENT, '_meta.json'), JSON.stringify(meta));
writeFileSync(join(CONTENT, '_search.json'), JSON.stringify(search));
writeFileSync(join(CONTENT, '_graph.json'), JSON.stringify(graph));

// ---------- report ----------
const charted = Object.keys(meta.hobbies).length;
const subCount = Object.values(taxonomy).reduce((a, s) => a + s.length, 0);
console.log(
  `content: ${domains.length} categories · ${subCount} sub-categories · ${hobbies.size} hobbies · ${charted} charted · ${search.length} skill nodes · ${traits.length} traits`,
);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 40)) console.log(`  · ${w}`);
  if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 80)) console.error(`  ✗ ${e}`);
  if (strict) process.exit(1);
}
