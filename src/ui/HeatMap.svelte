<script lang="ts">
  import { domains, domainById, hobbyById, loadGraph, traitById } from '../lib/data';
  import { href } from '../lib/router.svelte';
  import type { Graph } from '../lib/types';

  let { a, b }: { a?: string; b?: string } = $props();

  let hover = $state<[number, number] | null>(null);
  const graph = loadGraph();

  // Off-diagonal values are rescaled to the full colour range so the structure is visible.
  function scale(g: Graph) {
    const vals = g.heat.matrix.flatMap((row, i) => row.filter((_, j) => j !== i));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  }

  function pairsFor(g: Graph, x: string, y: string) {
    const ix = g.heat.domains.indexOf(x), iy = g.heat.domains.indexOf(y);
    return g.heat.pairs[ix <= iy ? `${x}|${y}` : `${y}|${x}`] ?? [];
  }

  function shared(g: Graph, p: string, q: string) {
    const A = g.profiles[p] ?? {}, B = g.profiles[q] ?? {};
    return Object.keys(A)
      .filter((t) => B[t])
      .sort((s, t) => Math.min(B[t], A[t]) - Math.min(B[s], A[s]))
      .slice(0, 3)
      .map((t) => traitById.get(t)?.name ?? t);
  }

  function nearest(g: Graph, i: number) {
    return g.heat.matrix[i]
      .map((v, j) => [j, v] as const)
      .filter(([j]) => j !== i)
      .sort((x, y) => y[1] - x[1]);
  }
</script>

<section class="intro">
  <h1>Connections</h1>
  <p class="muted">
    How close each pair of categories is, based on the abilities their hobbies train and the synergies between
    them. Darker means more overlap. Click a cell to see the hobby pairs that bridge the two categories.
  </p>
</section>

{#await graph}
  <p class="faint">Loading connections…</p>
{:then g}
  {@const s = scale(g)}
  {@const ds = g.heat.domains.map((id) => domainById.get(id)!)}
  <div class="wrap">
    <div class="grid" style:--n={ds.length}>
      <div></div>
      {#each ds as d, j}
        <div class="col-label" class:hl={hover?.[1] === j} title={d.name}><span>{d.name}</span></div>
      {/each}
      {#each ds as row, i}
        <a class="row-label" class:hl={hover?.[0] === i} href={href({ view: 'map', a: row.id, b: row.id })}>
          <span class="dot" style:--c={row.color}></span>{row.name}
        </a>
        {#each ds as col, j}
          {@const v = g.heat.matrix[i][j]}
          <a
            class="cell"
            class:diag={i === j}
            class:sel={(a === row.id && b === col.id) || (a === col.id && b === row.id)}
            style:--v={i === j ? 1 : s(v)}
            href={href({ view: 'map', a: row.id, b: col.id })}
            onmouseenter={() => (hover = [i, j])}
            onmouseleave={() => (hover = null)}
            title="{row.name} × {col.name}: {Math.round(v * 100)}%"
            aria-label="{row.name} and {col.name}, {Math.round(v * 100)} percent"
          ></a>
        {/each}
      {/each}
    </div>
  </div>

  {#if a && b && domainById.has(a) && domainById.has(b)}
    {@const da = domainById.get(a)!}
    {@const db = domainById.get(b)!}
    {@const ia = g.heat.domains.indexOf(a)}
    <section class="panel">
      <h2>
        <span class="dot" style:--c={da.color}></span> {da.name}
        {#if a !== b}<span class="faint"> × </span><span class="dot" style:--c={db.color}></span> {db.name}{/if}
        <span class="mono faint">{Math.round(g.heat.matrix[ia][g.heat.domains.indexOf(b)] * 100)}%</span>
      </h2>
      {#if a === b}
        <h3 class="eyebrow">Closest categories</h3>
        <p class="near">
          {#each nearest(g, ia).slice(0, 6) as [j, v]}
            {@const d = domainById.get(g.heat.domains[j])!}
            <a class="chip" href={href({ view: 'map', a, b: d.id })}><span class="dot" style:--c={d.color}></span>{d.name} <span class="mono">{Math.round(v * 100)}</span></a>
          {/each}
        </p>
        <h3 class="eyebrow">Tightest pairs inside {da.name}</h3>
      {:else}
        <h3 class="eyebrow">Hobbies that bridge them</h3>
      {/if}
      <ol class="pairs">
        {#each pairsFor(g, a, b) as [p, q, v]}
          {@const hp = hobbyById.get(p)}
          {@const hq = hobbyById.get(q)}
          {#if hp && hq}
            <li>
              <span class="mono score">{Math.round(v * 100)}</span>
              <a href={href({ view: 'tree', hobby: p })}>{hp.name}</a>
              <span class="faint">↔</span>
              <a href={href({ view: 'tree', hobby: q })}>{hq.name}</a>
              <span class="faint why">{shared(g, p, q).join(', ')}</span>
            </li>
          {/if}
        {/each}
      </ol>
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
  .wrap {
    overflow-x: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: 11rem repeat(var(--n), minmax(16px, 1fr));
    gap: 2px;
    min-width: 640px;
  }
  .col-label {
    height: 8.5rem;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: 0.72rem;
    color: var(--fg-muted);
  }
  .col-label span {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
  }
  .row-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--fg-muted);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
  }
  .hl {
    color: var(--fg);
    font-weight: 600;
  }
  .cell {
    aspect-ratio: 1;
    border-radius: 2px;
    background: color-mix(in oklab, var(--heat) calc(var(--v) * 100%), var(--bg-sunken));
  }
  .cell.diag {
    background: var(--fg);
    opacity: 0.85;
  }
  .cell:hover,
  .cell.sel {
    outline: 2px solid var(--fg);
    outline-offset: 0;
  }
  .panel {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  h2 {
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin: 0 0 0.75rem;
  }
  h3 {
    margin: 1rem 0 0.4rem;
    font-weight: 400;
  }
  .near {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
  }
  .pairs {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pairs li {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    line-height: 1.9;
    white-space: nowrap;
  }
  .pairs a {
    text-decoration: none;
  }
  .pairs a:hover {
    text-decoration: underline;
  }
  .score {
    width: 2rem;
    color: var(--heat);
  }
  .why {
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
