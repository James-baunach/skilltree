// Full-text search over hobbies (bundled) and skill nodes (loaded on first use).

import MiniSearch from 'minisearch';
import { galaxy } from './data';
import type { SearchRow, Tier } from './types';

export interface SearchDoc {
  id: string;
  kind: 'hobby' | 'node';
  hobby: string;
  node?: string;
  name: string;
  tier?: Tier;
  tags?: string;
  summary?: string;
  domainName?: string;
}

export interface SearchResult {
  kind: 'hobby' | 'node';
  hobby: string;
  node?: string;
  name: string;
  tier?: Tier;
  score: number;
}

const index = new MiniSearch<SearchDoc>({
  fields: ['name', 'tags', 'summary', 'domainName'],
  storeFields: ['kind', 'hobby', 'node', 'name', 'tier'],
  searchOptions: { boost: { name: 4, tags: 2, domainName: 1.5 }, prefix: true, fuzzy: 0.2 },
});

index.addAll(
  galaxy.hobbies.map((h) => ({
    id: 'h:' + h.id,
    kind: 'hobby' as const,
    hobby: h.id,
    name: h.name,
    tags: h.tags.join(' '),
    summary: h.summary,
    domainName: galaxy.domains[h.domainIndex].name,
  })),
);

let nodesLoaded: Promise<void> | null = null;

/** Adds every skill node to the index. Safe to call repeatedly. */
export function loadNodeIndex(): Promise<void> {
  nodesLoaded ??= import('../content/_search.json').then((m) => {
    const rows = m.default as SearchRow[];
    index.addAll(
      rows
        .filter(([hobby]) => galaxy.hobbyById.has(hobby))
        .map(([hobby, node, name, tier]) => ({ id: `n:${hobby}/${node}`, kind: 'node' as const, hobby, node, name, tier })),
    );
  });
  return nodesLoaded;
}

export function search(query: string): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];
  return index.search(q).map((r) => ({
    kind: r.kind,
    hobby: r.hobby,
    node: r.node,
    name: r.name,
    tier: r.tier,
    score: r.score,
  }));
}
