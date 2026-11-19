// Builds the runtime catalogue from authored content. Hobby lists and the taxonomy are bundled;
// each skill tree and the relationship graph are lazily loaded chunks.

import domainsJson from '../content/domains.json';
import taxonomyJson from '../content/taxonomy.json';
import traitsJson from '../content/traits.json';
import metaJson from '../content/_meta.json';
import type { ContentMeta, Domain, Graph, Hobby, HobbyMeta, SkillTree, Taxonomy, Trait } from './types';

const hobbyFiles = import.meta.glob<Hobby[]>('../content/hobbies/*.json', { eager: true, import: 'default' });
const treeFiles = import.meta.glob<SkillTree>('../content/trees/*.json', { import: 'default' });

export interface HobbyEntry extends Hobby {
  domain: string;
  sub: string;
  charted: boolean;
  meta: HobbyMeta | null;
}
export interface SubEntry {
  id: string;
  key: string; // "domain/sub"
  name: string;
  domain: string;
  hobbies: HobbyEntry[];
  charted: number;
}
export interface DomainEntry extends Domain {
  subs: SubEntry[];
  count: number;
  charted: number;
}

const meta = metaJson as ContentMeta;
export const traits = traitsJson as Trait[];
export const traitById = new Map(traits.map((t) => [t.id, t]));
export const traitGroups = [...new Set(traits.map((t) => t.group))];

const hobbyRaw = new Map<string, Hobby>();
for (const list of Object.values(hobbyFiles)) for (const h of list) hobbyRaw.set(h.id, h);

export const hobbyById = new Map<string, HobbyEntry>();
export const domains: DomainEntry[] = (domainsJson as Domain[]).map((d) => {
  const subs = ((taxonomyJson as Taxonomy)[d.id] ?? []).map((s): SubEntry => {
    const hobbies = s.hobbies
      .map((id) => hobbyRaw.get(id))
      .filter((h): h is Hobby => !!h)
      .map((h) => {
        const e: HobbyEntry = { ...h, domain: d.id, sub: s.id, charted: !!meta.hobbies[h.id], meta: meta.hobbies[h.id] ?? null };
        hobbyById.set(h.id, e);
        return e;
      })
      // charted trees first, then most popular, then A-Z
      .sort((a, b) => Number(b.charted) - Number(a.charted) || b.pop - a.pop || a.name.localeCompare(b.name));
    return { id: s.id, key: `${d.id}/${s.id}`, name: s.name, domain: d.id, hobbies, charted: hobbies.filter((h) => h.charted).length };
  });
  return {
    ...d,
    subs,
    count: subs.reduce((a, s) => a + s.hobbies.length, 0),
    charted: subs.reduce((a, s) => a + s.charted, 0),
  };
});
export const domainById = new Map(domains.map((d) => [d.id, d]));
export const subByKey = new Map(domains.flatMap((d) => d.subs.map((s) => [s.key, s] as const)));
export const totals = {
  hobbies: hobbyById.size,
  charted: Object.keys(meta.hobbies).length,
  nodes: Object.values(meta.hobbies).reduce((a, m) => a + m.nodes, 0),
  subs: subByKey.size,
};

const treeCache = new Map<string, Promise<SkillTree | null>>();
export function loadTree(hobbyId: string): Promise<SkillTree | null> {
  const loader = treeFiles[`../content/trees/${hobbyId}.json`];
  if (!loader) return Promise.resolve(null);
  let p = treeCache.get(hobbyId);
  if (!p) {
    p = loader().catch((e) => {
      console.error(`Failed to load tree for ${hobbyId}`, e);
      treeCache.delete(hobbyId);
      return null;
    });
    treeCache.set(hobbyId, p);
  }
  return p;
}

let graphP: Promise<Graph> | null = null;
export const loadGraph = () => (graphP ??= import('../content/_graph.json').then((m) => m.default as unknown as Graph));
