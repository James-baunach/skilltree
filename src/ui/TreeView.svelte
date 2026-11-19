<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { tick } from 'svelte';
  import { domains, hobbyById, totals } from '../lib/data';
  import { formatHours, costSymbols } from '../lib/format';
  import HobbyDetail from './HobbyDetail.svelte';

  let { hobby, node, group }: { hobby?: string; node?: string; group?: string } = $props();

  const openDomains = new SvelteSet<string>();
  const openSubs = new SvelteSet<string>();
  const openHobbies = new SvelteSet<string>();
  let chartedOnly = $state(false);

  // External navigation (search, related links, deep links) opens the path and scrolls to it.
  $effect(() => {
    const target = hobby ? hobbyById.get(hobby) : null;
    if (target) {
      openDomains.add(target.domain);
      openSubs.add(`${target.domain}/${target.sub}`);
      openHobbies.add(target.id);
      if (!node) reveal(`h-${target.id}`);
    } else if (group) {
      openDomains.add(group.split('/')[0]);
      openSubs.add(group);
      reveal(`s-${group.replace('/', '--')}`);
    }
  });

  async function reveal(id: string) {
    await tick();
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  const toggle = (set: SvelteSet<string>, key: string) => (set.has(key) ? set.delete(key) : set.add(key));

  function toggleHobby(id: string) {
    toggle(openHobbies, id);
    // Keep the URL shareable without triggering the scroll-to effect.
    history.replaceState(null, '', openHobbies.has(id) ? `#/h/${id}` : '#/');
  }

  function expandAll() {
    for (const d of domains) openDomains.add(d.id);
  }
  function collapseAll() {
    openDomains.clear();
    openSubs.clear();
    openHobbies.clear();
  }
</script>

<section class="intro">
  <h1>Every hobby, as a skill tree.</h1>
  <p class="muted">
    {totals.hobbies.toLocaleString()} hobbies in {domains.length} categories and {totals.subs} groups.
    {totals.charted} are fully charted, with {totals.nodes} skills from Novice to Master. Open anything to see what it
    takes, what it trains and what it connects to.
  </p>
  <div class="tools">
    <button class="chip" onclick={expandAll}>Expand categories</button>
    <button class="chip" onclick={collapseAll}>Collapse all</button>
    <button class="chip" class:on={chartedOnly} onclick={() => (chartedOnly = !chartedOnly)}>Charted trees only</button>
  </div>
</section>

<ul class="tree root">
  {#each domains as d (d.id)}
    {#if !chartedOnly || d.charted}
      {@const dOpen = openDomains.has(d.id)}
      <li class="domain" style:--c={d.color}>
        <button class="row drow" onclick={() => toggle(openDomains, d.id)} aria-expanded={dOpen}>
          <span class="caret" class:open={dOpen}>▶</span>
          <span class="dot"></span>
          <span class="grow dname">{d.name}</span>
          <span class="mono faint">{d.count}{#if d.charted}&nbsp;· <span class="charted">{d.charted} charted</span>{/if}</span>
        </button>
        {#if dOpen}
          <p class="blurb muted">{d.blurb}</p>
          <ul class="tree">
            {#each d.subs as s (s.key)}
              {#if !chartedOnly || s.charted}
                {@const sOpen = openSubs.has(s.key)}
                <li id="s-{s.key.replace('/', '--')}">
                  <button class="row" onclick={() => toggle(openSubs, s.key)} aria-expanded={sOpen}>
                    <span class="caret" class:open={sOpen}>▶</span>
                    <span class="grow sname">{s.name}</span>
                    <span class="mono faint">{s.hobbies.length}{#if s.charted}&nbsp;· <span class="charted">{s.charted}</span>{/if}</span>
                  </button>
                  {#if sOpen}
                    <ul class="tree">
                      {#each s.hobbies as h (h.id)}
                        {#if !chartedOnly || h.charted}
                          {@const hOpen = openHobbies.has(h.id)}
                          <li id="h-{h.id}" class:hopen={hOpen}>
                            <button class="row hrow" onclick={() => toggleHobby(h.id)} aria-expanded={hOpen}>
                              <span class="caret" class:open={hOpen}>▶</span>
                              <span class="grow" class:uncharted={!h.charted}>{h.name}</span>
                              {#if h.charted}<span class="badge mono">{h.meta?.nodes} skills</span>{/if}
                              <span class="mono faint hide-sm pips" title="Difficulty {h.stats.difficulty}/5">
                                {'●'.repeat(h.stats.difficulty)}<span class="off">{'●'.repeat(5 - h.stats.difficulty)}</span>
                              </span>
                              <span class="mono faint hide-sm hrs">{formatHours(h.stats.hours)}</span>
                              <span class="mono faint hide-sm cost">{costSymbols(h.stats.cost)}</span>
                            </button>
                            {#if hOpen}
                              <HobbyDetail hobby={h} activeNode={hobby === h.id ? node : undefined} />
                            {/if}
                          </li>
                        {/if}
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/if}
            {/each}
          </ul>
        {/if}
      </li>
    {/if}
  {/each}
</ul>

<style>
  .intro {
    margin: 1rem 0 1.75rem;
  }
  h1 {
    font-size: 1.9rem;
    letter-spacing: -0.03em;
    margin: 0 0 0.4rem;
  }
  .intro p {
    max-width: 60ch;
    margin: 0 0 1rem;
  }
  .tools {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .domain {
    border-top: 1px solid var(--line);
    padding: 0.25rem 0;
  }
  .drow {
    min-height: 2.6rem;
  }
  .dname {
    font-weight: 650;
    font-size: 1.05rem;
  }
  .blurb {
    margin: 0 0 0.4rem 2rem;
    font-size: 0.88rem;
  }
  .sname {
    font-weight: 550;
  }
  .charted {
    color: var(--good);
  }
  .uncharted {
    color: var(--fg-muted);
  }
  .hrow .grow:not(.uncharted) {
    font-weight: 550;
  }
  .badge {
    color: var(--good);
    border: 1px solid color-mix(in srgb, var(--good) 40%, transparent);
    border-radius: 999px;
    padding: 0 0.45rem;
  }
  .pips {
    letter-spacing: -0.15em;
    width: 4.5rem;
    text-align: right;
    color: var(--c);
  }
  .pips .off {
    color: var(--line);
  }
  .hrs {
    width: 4.2rem;
    text-align: right;
  }
  .cost {
    width: 2.6rem;
    text-align: right;
  }
  li[id] {
    scroll-margin-top: 4.5rem;
  }
</style>
