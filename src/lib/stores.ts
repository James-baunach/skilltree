// App state shared by the 3D engine and the HUD. The engine reacts to `focus`;
// clicks in 3D and in the HUD both go through `nav`.

import { derived, get, writable } from 'svelte/store';
import { galaxy, loadTree } from './data';
import type { Focus as FocusKind, Setting, SkillTree, Social, Tier } from './types';

/** What the side panel shows. 'map' means nothing is selected. */
export type Level = 'map' | 'domain' | 'hobby';

export interface Focus {
  level: Level;
  domain: string | null;
  hobby: string | null;
  node: string | null;
  fly: boolean; // move the camera to frame the new selection
}

export const focus = writable<Focus>({ level: 'map', domain: null, hobby: null, node: null, fly: false });

export interface HoverInfo {
  kind: 'domain' | 'hobby' | 'node' | 'core';
  id: string;
  x: number;
  y: number;
  hobby?: string; // for skill nodes: the hobby whose tree they belong to
  name?: string; // for skill nodes
  tier?: Tier; // for skill nodes
  hours?: number; // for skill nodes
}
export const hover = writable<HoverInfo | null>(null);

export interface TreeState {
  hobby: string;
  tree: SkillTree | null;
  loading: boolean;
}
export const activeTree = writable<TreeState | null>(null);

/** Which HUD popover is open, if any. */
export const openMenu = writable<'filters' | 'party' | 'character' | null>(null);

export const nav = {
  /** Clear the selection; with fly, also zoom out to the whole map. */
  home(fly = true) {
    focus.set({ level: 'map', domain: null, hobby: null, node: null, fly });
  },
  domain(id: string, fly = true) {
    if (!galaxy.domainById.has(id)) return;
    focus.set({ level: 'domain', domain: id, hobby: null, node: null, fly });
  },
  hobby(id: string, node: string | null = null) {
    const h = galaxy.hobbyById.get(id);
    if (!h) return;
    const f = get(focus);
    if (f.hobby === id) focus.set({ ...f, node, fly: false });
    else focus.set({ level: 'hobby', domain: h.domain, hobby: id, node, fly: true });
  },
  node(id: string | null) {
    focus.update((f) => (f.level === 'hobby' ? { ...f, node: id, fly: false } : f));
  },
  /** Step the selection up one level (Esc) without moving the camera. */
  up() {
    const f = get(focus);
    if (f.node) nav.node(null);
    else if (f.level === 'hobby' && f.domain) nav.domain(f.domain, false);
    else if (f.level === 'domain') nav.home(false);
  },
};

// Load the focused hobby's tree whenever the focused hobby changes.
let loadingFor: string | null = null;
focus.subscribe((f) => {
  if (f.hobby === loadingFor) return;
  loadingFor = f.hobby;
  if (!f.hobby) {
    activeTree.set(null);
    return;
  }
  const id = f.hobby;
  activeTree.set({ hobby: id, tree: null, loading: true });
  loadTree(id).then((tree) => {
    if (loadingFor === id) activeTree.set({ hobby: id, tree, loading: false });
  });
});

// ---------------------------------------------------------------- discovery

export interface Filters {
  maxCost: number | null;
  maxHours: number | null;
  social: Social | null;
  setting: Setting | null;
  focus: FocusKind | null;
}
export const emptyFilters: Filters = { maxCost: null, maxHours: null, social: null, setting: null, focus: null };
export const filters = writable<Filters>({ ...emptyFilters });
export const partyMode = writable(false);
/** Hobby ids matching the current search text, or null when the search box is empty. */
export const searchHits = writable<Set<string> | null>(null);

export const filtersActive = derived(filters, (f) => Object.values(f).some((v) => v !== null));

export const hasPartyTricks = (i: number) => {
  const h = galaxy.hobbies[i];
  return Boolean(h.partyTrick || h.meta?.party.length);
};

/** Indices of hobbies to light up, or null when nothing is filtering the map. */
export const highlight = derived([filters, partyMode, searchHits], ([f, party, hits]) => {
  const anyFilter = Object.values(f).some((v) => v !== null);
  if (!anyFilter && !party && !hits) return null;
  const set = new Set<number>();
  for (const h of galaxy.hobbies) {
    const s = h.stats;
    if (party && !hasPartyTricks(h.index)) continue;
    if (hits && !hits.has(h.id)) continue;
    if (f.maxCost !== null && s.cost > f.maxCost) continue;
    if (f.maxHours !== null && s.hours > f.maxHours) continue;
    if (f.social && s.social !== 'either' && s.social !== f.social) continue;
    if (f.setting && s.setting !== 'either' && s.setting !== f.setting) continue;
    if (f.focus && !s.focus.includes(f.focus)) continue;
    set.add(h.index);
  }
  return set;
});

// ---------------------------------------------------------------- deep links
// #/d/<domain>  ·  #/h/<hobby>  ·  #/h/<hobby>/<node>

function hashFor(f: Focus): string {
  if (f.level === 'hobby' && f.hobby) return `#/h/${f.hobby}${f.node ? '/' + f.node : ''}`;
  if (f.level === 'domain' && f.domain) return `#/d/${f.domain}`;
  return '';
}

function applyHash(hash: string) {
  const [, kind, id, node] = hash.replace(/^#/, '').split('/');
  if (kind === 'h' && id) nav.hobby(id, node ?? null);
  else if (kind === 'd' && id) nav.domain(id);
  else if (get(focus).level !== 'map') nav.home(false);
}

export function initRouting() {
  if (location.hash) applyHash(location.hash);
  const unsub = focus.subscribe((f) => {
    const h = hashFor(f);
    if (h !== location.hash && !(h === '' && location.hash === '')) {
      history.replaceState(null, '', h || location.pathname + location.search);
    }
  });
  const onHash = () => applyHash(location.hash);
  addEventListener('hashchange', onHash);
  return () => {
    unsub();
    removeEventListener('hashchange', onHash);
  };
}
