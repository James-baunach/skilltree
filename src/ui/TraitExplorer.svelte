<script lang="ts">
  import { traits, traitGroups, traitById, hobbyById, domainById, loadGraph } from '../lib/data';
  import { href } from '../lib/router.svelte';
  import type { Graph } from '../lib/types';

  let { trait }: { trait?: string } = $props();
  const graph = loadGraph();
  const current = $derived(trait ? traitById.get(trait) : undefined);

  function ranked(g: Graph, t: string) {
    const levels: Record<number, string[]> = { 3: [], 2: [], 1: [] };
    for (const [id, p] of Object.entries(g.profiles)) if (p[t]) levels[p[t]].push(id);
    for (const l of Object.values(levels)) l.sort((x, y) => (hobbyById.get(y)?.pop ?? 0) - (hobbyById.get(x)?.pop ?? 0));
    return levels;
  }

  // Traits that most often show up alongside this one.
  function companions(g: Graph, t: string) {
    const c: Record<string, number> = {};
    for (const p of Object.values(g.profiles)) if (p[t]) for (const [k, w] of Object.entries(p)) if (k !== t) c[k] = (c[k] ?? 0) + w * p[t];
    return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k]) => k);
  }

  const counts = (g: Graph) => {
    const c: Record<string, number> = {};
    for (const p of Object.values(g.profiles)) for (const k of Object.keys(p)) c[k] = (c[k] ?? 0) + 1;
    return c;
  };
  const LEVEL = { 3: 'Core', 2: 'Strong', 1: 'Some' } as const;
</script>

<section class="intro">
  <h1>Traits</h1>
  <p class="muted">
    The {traits.length} underlying abilities that hobbies train. Every hobby is scored 0–3 on each, which is what
    powers the connections between them. Pick a trait to see where it's built.
  </p>
</section>

{#await graph then g}
  {@const n = counts(g)}
  <div class="groups">
    {#each traitGroups as grp}
      <div class="group">
        <h3 class="eyebrow">{grp}</h3>
        <div class="chips">
          {#each traits.filter((t) => t.group === grp) as t}
            <a class="chip" class:on={t.id === trait} href={href({ view: 'traits', trait: t.id })}>{t.name} <span class="mono faint">{n[t.id] ?? 0}</span></a>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if current}
    {@const lv = ranked(g, current.id)}
    <section class="panel">
      <h2>{current.name}</h2>
      <p class="muted small">
        Often paired with:
        {#each companions(g, current.id) as c, i}{i ? ', ' : ''}<a href={href({ view: 'traits', trait: c })}>{traitById.get(c)?.name}</a>{/each}
      </p>
      {#each [3, 2, 1] as const as l}
        {#if lv[l].length}
          <h3 class="eyebrow">{LEVEL[l]} · {lv[l].length}</h3>
          <ul class="list">
            {#each lv[l] as id}
              {@const h = hobbyById.get(id)!}
              <li>
                <span class="dot" style:--c={domainById.get(h.domain)?.color}></span>
                <a href={href({ view: 'tree', hobby: id })} class:charted={h.charted}>{h.name}</a>
              </li>
            {/each}
          </ul>
        {/if}
      {/each}
    </section>
  {/if}
{/await}

<style>
  .intro {
    margin: 1rem 0 1.5rem;
  }
  h1 {
    font-size: 1.9rem;
    letter-spacing: -0.03em;
    margin: 0 0 0.4rem;
  }
  .intro p {
    max-width: 62ch;
    margin: 0;
  }
  .groups {
    display: grid;
    gap: 0.9rem;
  }
  .group h3 {
    margin: 0 0 0.35rem;
    font-weight: 400;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .panel {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  h2 {
    margin: 0 0 0.25rem;
  }
  .small {
    font-size: 0.88rem;
  }
  .panel h3 {
    margin: 1.2rem 0 0.4rem;
    font-weight: 400;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    columns: 3 14rem;
    column-gap: 1.5rem;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.88rem;
    line-height: 1.8;
    break-inside: avoid;
  }
  .list a {
    text-decoration: none;
    color: var(--fg-muted);
  }
  .list a.charted {
    color: var(--fg);
    font-weight: 600;
  }
  .list a:hover {
    text-decoration: underline;
  }
</style>
