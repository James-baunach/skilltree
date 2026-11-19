// Full-text search over hobbies and sub-categories (bundled) and skill nodes (loaded on first use).

import MiniSearch from 'minisearch';
import { domainById, hobbyById, subByKey } from './data';
import type { SearchRow, Tier } from './types';

interface Doc {
  id: string;
  kind: 'hobby' | 'node' | 'sub';
  hobby?: string;
  node?: string;
  sub?: string;
  name: string;
  tier?: Tier;
  tags?: string;
  summary?: string;
  context?: string;
}
export type SearchResult = Pick<Doc, 'kind' | 'hobby' | 'node' | 'sub' | 'name' | 'tier' | 'context'>;

const index = new MiniSearch<Doc>({
  fields: ['name', 'tags', 'summary', 'context'],
  storeFields: ['kind', 'hobby', 'node', 'sub', 'name', 'tier', 'context'],
  searchOptions: { boost: { name: 4, tags: 2, context: 1.2 }, prefix: true, fuzzy: 0.2 },
});

index.addAll([
  ...[...hobbyById.values()].map((h) => ({
    id: 'h:' + h.id,
    kind: 'hobby' as const,
    hobby: h.id,
    name: h.name,
    tags: h.tags.join(' '),
    summary: h.summary,
    context: `${domainById.get(h.domain)!.name} · ${subByKey.get(`${h.domain}/${h.sub}`)!.name}`,
  })),
  ...[...subByKey.values()].map((s) => ({
    id: 's:' + s.key,
    kind: 'sub' as const,
    sub: s.key,
    name: s.name,
    context: domainById.get(s.domain)!.name,
  })),
]);

let nodesLoaded: Promise<void> | null = null;
export function loadNodeIndex(): Promise<void> {
  nodesLoaded ??= import('../content/_search.json').then((m) => {
    const rows = m.default as SearchRow[];
    index.addAll(
      rows
        .filter(([hobby]) => hobbyById.has(hobby))
        .map(([hobby, node, name, tier]) => ({
          id: `n:${hobby}/${node}`, kind: 'node' as const, hobby, node, name, tier, context: hobbyById.get(hobby)!.name,
        })),
    );
  });
  return nodesLoaded;
}

export function search(query: string, limit = 12): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];
  return index.search(q).slice(0, limit).map((r) => ({
    kind: r.kind, hobby: r.hobby, node: r.node, sub: r.sub, name: r.name, tier: r.tier, context: r.context,
  }));
}
