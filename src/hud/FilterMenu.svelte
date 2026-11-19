<script lang="ts">
  import { galaxy } from '../lib/data';
  import { emptyFilters, filters, filtersActive, highlight, openMenu, type Filters } from '../lib/stores';

  type Option = [Filters[keyof Filters], string];
  const groups: { key: keyof Filters; label: string; options: Option[] }[] = [
    { key: 'maxCost', label: 'Start cost', options: [[null, 'Any'], [0, 'Free'], [1, '≤ $50'], [2, '≤ $250'], [3, '≤ $1k']] },
    { key: 'maxHours', label: 'Time to competence', options: [[null, 'Any'], [10, '≤ 10 h'], [25, '≤ 25 h'], [50, '≤ 50 h']] },
    { key: 'social', label: 'Play style', options: [[null, 'Any'], ['solo', 'Solo'], ['group', 'Social']] },
    { key: 'setting', label: 'Setting', options: [[null, 'Any'], ['indoor', 'Indoors'], ['outdoor', 'Outdoors']] },
    { key: 'focus', label: 'Trains your', options: [[null, 'Any'], ['physical', 'Body'], ['mental', 'Mind'], ['creative', 'Creativity']] },
  ];

  const count = $derived(Object.values($filters).filter((v) => v !== null).length);

  function set(key: keyof Filters, value: Filters[keyof Filters]) {
    filters.update((f) => ({ ...f, [key]: value }));
  }
</script>

<div class="menu-wrap">
  <button
    class="btn"
    class:is-on={$filtersActive}
    aria-label={count ? `Filters (${count} active)` : 'Filters'}
    aria-expanded={$openMenu === 'filters'}
    onclick={() => openMenu.update((m) => (m === 'filters' ? null : 'filters'))}>
    <span aria-hidden="true">⚙</span><span class="label">Filters</span>
    {#if count}<span class="badge">{count}</span>{/if}
  </button>

  {#if $openMenu === 'filters'}
    <div class="menu glass" role="dialog" aria-label="Filter hobbies">
      {#each groups as g (g.key)}
        <fieldset>
          <legend class="eyebrow">{g.label}</legend>
          <div class="opts">
            {#each g.options as [value, label] (label)}
              <button class="opt" class:is-on={$filters[g.key] === value} onclick={() => set(g.key, value)}>{label}</button>
            {/each}
          </div>
        </fieldset>
      {/each}
      <div class="foot">
        <span>{$highlight ? $highlight.size : galaxy.hobbies.length} of {galaxy.hobbies.length} hobbies match</span>
        <button class="btn is-ghost" onclick={() => filters.set({ ...emptyFilters })}>Clear</button>
      </div>
    </div>
  {/if}
</div>

<style>
  fieldset {
    margin: 0 0 12px;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 6px;
    padding: 0;
  }

  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid rgba(46, 230, 255, 0.12);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-dim);
  }
</style>
