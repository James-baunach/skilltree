<script lang="ts">
  import type { HobbyStats } from '../lib/types';
  import { COST_LABEL, SETTING_LABEL, SOCIAL_LABEL, costSymbols, formatHours } from './format';

  let { stats }: { stats: HobbyStats } = $props();
</script>

<dl class="stats">
  <div class="stat">
    <dt>Difficulty</dt>
    <dd>
      <span class="pips" aria-label="{stats.difficulty} out of 5">
        {#each [1, 2, 3, 4, 5] as i (i)}<i class:is-on={i <= stats.difficulty}></i>{/each}
      </span>
    </dd>
  </div>
  <div class="stat">
    <dt>To competence</dt>
    <dd>{formatHours(stats.hours)}</dd>
  </div>
  <div class="stat">
    <dt>Start cost</dt>
    <dd>
      {#if stats.cost === 0}
        <span class="money">Free</span>
      {:else}
        <span class="money">{costSymbols(stats.cost)}</span> <span class="dim">{COST_LABEL[stats.cost]}</span>
      {/if}
    </dd>
  </div>
  <div class="stat">
    <dt>Play style</dt>
    <dd>{SOCIAL_LABEL[stats.social]} · {SETTING_LABEL[stats.setting]}</dd>
  </div>
  <div class="stat is-wide">
    <dt>Trains</dt>
    <dd class="focus">
      {#each stats.focus as f (f)}<span class="chip is-{f}">{f}</span>{/each}
    </dd>
  </div>
  {#if stats.gear.length}
    <div class="stat is-wide">
      <dt>Starter gear</dt>
      <dd>
        <ul class="gear">
          {#each stats.gear as g (g)}<li>{g}</li>{/each}
        </ul>
      </dd>
    </div>
  {/if}
</dl>

<style>
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    margin: 0;
    background: var(--cyan-line);
    border: 1px solid var(--cyan-line);
  }

  .stat {
    padding: 9px 11px;
    background: rgba(5, 9, 20, 0.92);
  }

  .stat.is-wide {
    grid-column: 1 / -1;
  }

  dt {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  dd {
    margin: 4px 0 0;
    font-size: 13.5px;
    color: var(--ink);
  }

  .pips {
    display: inline-flex;
    gap: 4px;
  }

  .pips i {
    width: 14px;
    height: 6px;
    background: rgba(46, 230, 255, 0.12);
    border: 1px solid var(--cyan-line);
    transform: skewX(-20deg);
  }

  .pips i.is-on {
    background: var(--cyan);
    border-color: var(--cyan);
    box-shadow: 0 0 6px var(--cyan);
  }

  .money {
    font-family: var(--font-mono);
    color: var(--gold);
    letter-spacing: 0.08em;
  }

  .dim {
    color: var(--ink-dim);
    font-size: 12px;
  }

  .focus {
    display: flex;
    gap: 6px;
  }

  .focus .chip {
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .chip.is-physical {
    color: #6fe0b0;
    border-color: rgba(111, 224, 176, 0.35);
  }

  .chip.is-mental {
    color: #b59bff;
    border-color: rgba(181, 155, 255, 0.35);
  }

  .chip.is-creative {
    color: #ff9ec7;
    border-color: rgba(255, 158, 199, 0.35);
  }

  .gear {
    margin: 0;
    padding-left: 16px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-dim);
  }
</style>
