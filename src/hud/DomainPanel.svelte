<script lang="ts">
  import { galaxy } from '../lib/data';
  import { character } from '../lib/progress';
  import { highlight, nav } from '../lib/stores';
  import Panel from './Panel.svelte';
  import { costSymbols } from './format';

  let { id }: { id: string } = $props();

  const d = $derived(galaxy.domainById.get(id)!);
  const list = $derived(
    d.hobbies.map((i) => galaxy.hobbies[i]).sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name)),
  );
  const charted = $derived(list.filter((h) => h.charted).length);
</script>

<Panel label={d.name}>
  <header class="head" style="--c: {d.color}">
    <p class="eyebrow">Domain</p>
    <h2>{d.name}</h2>
    <p class="blurb">{d.blurb}</p>
    {#if list.length}
      <p class="count">{list.length} hobbies · {charted} with full skill trees</p>
    {/if}
  </header>

  {#if list.length}
    <ul class="list">
      {#each list as h (h.id)}
        {@const prog = $character.byHobby.get(h.id)}
        <li>
          <button class="row" class:is-dim={$highlight && !$highlight.has(h.index)} onclick={() => nav.hobby(h.id)}>
            <span class="name">
              {h.name}
              {#if h.partyTrick || h.meta?.party.length}<span class="party" title="Has party tricks">✦</span>{/if}
            </span>
            <span class="meta">
              <span class="diff" title="Difficulty {h.stats.difficulty} of 5">
                {#each [1, 2, 3, 4, 5] as i (i)}<i class:is-on={i <= h.stats.difficulty}></i>{/each}
              </span>
              <span class="cost">{costSymbols(h.stats.cost)}</span>
              {#if prog?.learned}
                <span class="tag is-gold">{prog.learned}/{h.meta?.nodes ?? '?'}</span>
              {:else if h.charted}
                <span class="tag">{h.meta!.nodes} skills</span>
              {:else}
                <span class="tag is-dim">uncharted</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">
      Uncharted region. This domain's hobbies arrive in a future content wave. Explore Tricks &amp; Dexterity, Games
      &amp; Puzzles or Culinary for now.
    </p>
  {/if}
</Panel>

<style>
  .head {
    margin-bottom: 16px;
  }

  .head .eyebrow {
    margin: 0;
    color: var(--c);
  }

  h2 {
    margin: 4px 0 8px;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #fff;
    text-shadow: 0 0 18px color-mix(in srgb, var(--c) 45%, transparent);
  }

  .blurb {
    margin: 0;
    line-height: 1.5;
    color: var(--ink-dim);
  }

  .count {
    margin: 10px 0 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-faint);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid rgba(46, 230, 255, 0.12);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 10px 6px;
    border: 0;
    border-bottom: 1px solid rgba(46, 230, 255, 0.08);
    background: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s, opacity 0.2s;
  }

  .row:hover {
    background: var(--cyan-soft);
  }

  .row.is-dim {
    opacity: 0.35;
  }

  .name {
    font-size: 14.5px;
    color: var(--ink);
  }

  .party {
    margin-left: 4px;
    color: var(--gold);
    font-size: 11px;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }

  .diff {
    display: inline-flex;
    gap: 2px;
  }

  .diff i {
    width: 6px;
    height: 6px;
    background: rgba(46, 230, 255, 0.15);
  }

  .diff i.is-on {
    background: var(--cyan);
  }

  .cost {
    width: 34px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--gold);
    text-align: right;
  }

  .tag {
    min-width: 64px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-align: right;
    color: var(--cyan);
  }

  .tag.is-dim {
    color: var(--ink-faint);
  }

  .tag.is-gold {
    color: var(--gold);
  }

  .empty {
    line-height: 1.6;
    color: var(--ink-dim);
  }
</style>
