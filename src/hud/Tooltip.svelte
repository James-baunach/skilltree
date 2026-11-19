<script lang="ts">
  import { galaxy } from '../lib/data';
  import { hover } from '../lib/stores';
  import { TIER_NAMES } from '../lib/types';
  import { formatHours } from './format';

  const info = $derived.by(() => {
    const h = $hover;
    if (!h) return null;
    if (h.kind === 'domain') {
      const d = galaxy.domainById.get(h.id)!;
      return {
        title: d.name,
        sub: d.hobbies.length ? `${d.hobbies.length} hobbies · click to enter` : 'Uncharted region',
        color: d.color,
      };
    }
    if (h.kind === 'hobby') {
      const x = galaxy.hobbyById.get(h.id)!;
      return {
        title: x.name,
        sub: x.charted ? `${x.meta!.nodes} skills · difficulty ${x.stats.difficulty}/5` : 'Uncharted · summary only',
        color: galaxy.domains[x.domainIndex].color,
      };
    }
    if (h.kind === 'node') {
      if (!h.name) return null;
      const parent = h.hobby ? galaxy.hobbyById.get(h.hobby) : undefined;
      const tier = TIER_NAMES[(h.tier ?? 1) - 1];
      return {
        title: h.name,
        sub: `${tier} · ${formatHours(h.hours ?? 1)}${parent ? ` · ${parent.name}` : ''}`,
        color: '#2ee6ff',
      };
    }
    return { title: 'You', sub: 'Click for your character sheet', color: '#ffc65c' };
  });
</script>

{#if info && $hover}
  <div class="tip" style="transform: translate({$hover.x + 16}px, {$hover.y + 18}px); --c: {info.color}">
    <div class="tip__t">{info.title}</div>
    <div class="tip__s">{info.sub}</div>
  </div>
{/if}

<style>
  .tip {
    position: absolute;
    left: 0;
    top: 0;
    padding: 6px 10px;
    background: var(--glass-strong);
    border-left: 2px solid var(--c);
    pointer-events: none;
    max-width: 260px;
  }

  .tip__t {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .tip__s {
    margin-top: 2px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-dim);
  }

  @media (pointer: coarse) {
    .tip {
      display: none;
    }
  }
</style>
