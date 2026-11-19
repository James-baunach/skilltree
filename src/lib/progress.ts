// Player progress, saved in this browser's localStorage. Keys are "hobbyId/nodeId".

import { derived, get, writable } from 'svelte/store';
import type { SkillNode, Tier } from './types';

export type NodeState = 'learning' | 'learned';
export interface NodeProgress {
  s: NodeState;
  xp: number; // XP the node is worth, stored so totals don't need the tree loaded
  t: number; // timestamp of the last change
}
export type ProgressMap = Record<string, NodeProgress>;

const KEY = 'skillnet.progress.v1';
export const TIER_XP: Record<Tier, number> = { 1: 100, 2: 200, 3: 350, 4: 600, 5: 1000 };

function load(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const progress = writable<ProgressMap>(load());
progress.subscribe((p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); progress then lasts for the session.
  }
});

export const nodeKey = (hobby: string, node: string) => `${hobby}/${node}`;

export function setNodeState(hobby: string, node: SkillNode, s: NodeState | null) {
  progress.update((p) => {
    const next = { ...p };
    const k = nodeKey(hobby, node.id);
    if (s) next[k] = { s, xp: TIER_XP[node.tier], t: Date.now() };
    else delete next[k];
    return next;
  });
}

export const xpForLevel = (level: number) => Math.round(120 * Math.pow(level - 1, 1.7));

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface HobbyProgress {
  learned: number;
  learning: number;
  xp: number;
}

export const character = derived(progress, (p) => {
  let xp = 0;
  let learned = 0;
  let learning = 0;
  const byHobby = new Map<string, HobbyProgress>();
  for (const [key, v] of Object.entries(p)) {
    const hobby = key.slice(0, key.indexOf('/'));
    const h = byHobby.get(hobby) ?? { learned: 0, learning: 0, xp: 0 };
    if (v.s === 'learned') {
      xp += v.xp;
      h.xp += v.xp;
      h.learned++;
      learned++;
    } else {
      h.learning++;
      learning++;
    }
    byHobby.set(hobby, h);
  }
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { xp, level, next, fraction: (xp - floor) / (next - floor), learned, learning, byHobby };
});

export function exportProgress(): string {
  return JSON.stringify({ app: 'skilltree', version: 1, exported: new Date().toISOString(), progress: get(progress) }, null, 2);
}

/** Merges an exported file into current progress. Returns the number of nodes imported. */
export function importProgress(text: string): number {
  const data = JSON.parse(text);
  const incoming: unknown = data?.progress ?? data;
  if (!incoming || typeof incoming !== 'object') throw new Error('Not a Skilltree progress file');
  let count = 0;
  const clean: ProgressMap = {};
  for (const [k, v] of Object.entries(incoming as Record<string, NodeProgress>)) {
    if (!k.includes('/') || !v || (v.s !== 'learned' && v.s !== 'learning') || typeof v.xp !== 'number') continue;
    clean[k] = { s: v.s, xp: v.xp, t: typeof v.t === 'number' ? v.t : Date.now() };
    count++;
  }
  // An empty export is fine; an unrelated JSON file with nothing usable is not.
  if (count === 0 && data?.app !== 'skillnet' && data?.app !== 'skilltree') throw new Error('Not a Skilltree progress file');
  progress.update((p) => ({ ...p, ...clean }));
  return count;
}
