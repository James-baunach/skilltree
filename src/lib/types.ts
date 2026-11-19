// Content schema. Authored JSON lives in src/content and is validated by scripts/build-index.ts.

export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIER_NAMES = ['Novice', 'Apprentice', 'Adept', 'Expert', 'Master'] as const;

export interface Domain {
  id: string;
  name: string;
  color: string; // '#rrggbb'
  blurb: string;
}

/** src/content/traits.json: the shared ability vocabulary used to relate hobbies. */
export interface Trait {
  id: string;
  name: string;
  group: string;
}

/** src/content/taxonomy.json: domain id → its sub-categories. */
export interface SubCategory {
  id: string;
  name: string;
  traits: string; // default trait profile for its hobbies, e.g. "strength3 balance2"
  hobbies: string[]; // hobby ids, in display order
}
export type Taxonomy = Record<string, SubCategory[]>;

export type Social = 'solo' | 'group' | 'either';
export type Setting = 'indoor' | 'outdoor' | 'either';
export type Focus = 'physical' | 'mental' | 'creative';

export interface HobbyStats {
  difficulty: 1 | 2 | 3 | 4 | 5;
  hours: number; // rough hours to basic competence
  cost: 0 | 1 | 2 | 3 | 4; // 0 free · 1 <$50 · 2 <$250 · 3 <$1000 · 4 $1000+
  gear: string[];
  social: Social;
  setting: Setting;
  focus: Focus[];
}

/** One entry in src/content/hobbies/<domainId>.json */
export interface Hobby {
  id: string;
  name: string;
  summary: string;
  pop: 1 | 2 | 3 | 4 | 5;
  stats: HobbyStats;
  tags: string[];
  synergies: string[];
  traits?: string; // optional per-hobby overrides of the sub-category trait profile
  partyTrick?: boolean;
  safety?: string;
}

export interface Resource {
  title: string;
  kind: 'book' | 'video' | 'site' | 'course' | 'tool';
  by?: string;
  url?: string;
}

/** One node in src/content/trees/<hobbyId>.json */
export interface SkillNode {
  id: string;
  name: string;
  tier: Tier;
  requires: string[];
  summary: string;
  steps: string[];
  drills: string[];
  mastery: string;
  mistakes?: string[];
  resources?: Resource[];
  hours: number;
  partyTrick?: number;
}

export interface SkillTree {
  hobby: string;
  nodes: SkillNode[];
}

/** Generated into src/content/_meta.json */
export interface HobbyMeta {
  nodes: number;
  tiers: number[];
  party: { id: string; name: string; minutes: number; tier: Tier }[];
  hours: number;
}
export interface ContentMeta {
  generated: string;
  hobbies: Record<string, HobbyMeta>;
}

/** Generated into src/content/_search.json: [hobbyId, nodeId, nodeName, tier] */
export type SearchRow = [string, string, string, Tier];

/** [hobbyId, similarity 0-1, shared trait ids, 1 if a hand-picked synergy] */
export type Related = [string, number, string[], 0 | 1];

/** Generated into src/content/_graph.json */
export interface Graph {
  profiles: Record<string, Record<string, number>>;
  related: Record<string, Related[]>;
  heat: {
    domains: string[];
    matrix: number[][];
    pairs: Record<string, [string, string, number][]>; // "a|b" with a before b in domain order
  };
}
