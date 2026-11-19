import type { HobbyStats } from '../lib/types';

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 10) return `~${Math.round(h * 2) / 2} h`;
  return `~${Math.round(h).toLocaleString()} h`;
}

export const COST_LABEL = ['Free', 'Under $50', 'Under $250', 'Under $1,000', '$1,000+'] as const;
export const costSymbols = (cost: number) => (cost === 0 ? 'FREE' : '$'.repeat(cost));

export const SOCIAL_LABEL: Record<HobbyStats['social'], string> = {
  solo: 'Solo',
  group: 'With others',
  either: 'Solo or social',
};

export const SETTING_LABEL: Record<HobbyStats['setting'], string> = {
  indoor: 'Indoors',
  outdoor: 'Outdoors',
  either: 'Anywhere',
};
