<script lang="ts">
  import { galaxy } from '../lib/data';
  import { character, nodeKey, progress } from '../lib/progress';
  import { activeTree, nav, partyMode } from '../lib/stores';
  import { TIER_NAMES, type SkillNode } from '../lib/types';
  import NodeDetail from './NodeDetail.svelte';
  import Panel from './Panel.svelte';
  import StatBlock from './StatBlock.svelte';

  let { id, node }: { id: string; node: string | null } = $props();

  const h = $derived(galaxy.hobbyById.get(id)!);
  const d = $derived(galaxy.domains[h.domainIndex]);
  const tree = $derived($activeTree?.hobby === id ? $activeTree.tree : null);
  const loading = $derived($activeTree?.hobby === id && $activeTree.loading);
  const selected = $derived(tree && node ? (tree.nodes.find((n) => n.id === node) ?? null) : null);
  const tiers = $derived(
    tree
      ? [1, 2, 3, 4, 5]
          .map((t) => ({ tier: t, nodes: tree.nodes.filter((n) => n.tier === t) }))
          .filter((t) => t.nodes.length)
      : [],
  );
  const mine = $derived($character.byHobby.get(id));
  const synergies = $derived(h.synergies.map((s) => galaxy.hobbyById.get(s)!));

  function stateOf(n: SkillNode): string {
    const p = $progress[nodeKey(id, n.id)];
    if (p) return p.s;
    return n.requires.every((r) => $progress[nodeKey(id, r)]?.s === 'learned') ? 'available' : 'locked';
  }
</script>

<Panel label={h.name}>
  {#if selected && tree}
    <NodeDetail hobby={h} {tree} node={selected} />
  {:else}
    <header class="head" style="--c: {d.color}">
      <button class="eyebrow domain" onclick={() => nav.domain(d.id)}>{d.name}</button>
      <h2>{h.name}</h2>
      <p class="summary">{h.summary}</p>
      {#if tree}
        <div class="progress">
          <div class="bar"><span style="width: {((mine?.learned ?? 0) / tree.nodes.length) * 100}%"></span></div>
          <span class="nums">{mine?.learned ?? 0} / {tree.nodes.length} skills learned</span>
        </div>
      {/if}
    </header>

    <StatBlock stats={h.stats} />

    {#if h.safety}
      <p class="safety"><b>Safety</b> {h.safety}</p>
    {/if}

    {#if synergies.length}
      <section>
        <h3 class="eyebrow">Synergies</h3>
        <div class="chips">
          {#each synergies as s (s.id)}
            <button class="chip" style="--c: {galaxy.domains[s.domainIndex].color}" onclick={() => nav.hobby(s.id)}>
              <span class="swatch"></span>{s.name}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h3 class="eyebrow">Skill path</h3>
      {#if loading}
        <p class="muted">Charting…</p>
      {:else if tree}
        {#each tiers as t (t.tier)}
          <div class="tier">
            <p class="tier__name t{t.tier}">{TIER_NAMES[t.tier - 1]}</p>
            <ul>
              {#each t.nodes as n (n.id)}
                <li>
                  <button class="node" class:is-party={$partyMode && n.partyTrick} onclick={() => nav.node(n.id)}>
                    <span class="dot is-{stateOf(n)}"></span>
                    <span class="node__name">{n.name}</span>
                    {#if n.partyTrick}<span class="party" title="Party trick: about {n.partyTrick} min">✦ {n.partyTrick}m</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      {:else}
        <p class="muted">
          Uncharted. This hobby's full beginner-to-master tree hasn't been written yet. It arrives in a future content wave.
        </p>
      {/if}
    </section>
  {/if}
</Panel>

<style>
  .head {
    margin-bottom: 16px;
  }

  .domain {
    padding: 0;
    border: 0;
    background: none;
    color: var(--c);
    cursor: pointer;
  }

  .domain:hover {
    text-decoration: underline;
  }

  h2 {
    margin: 4px 0 8px;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #fff;
    text-shadow: 0 0 18px color-mix(in srgb, var(--c) 45%, transparent);
  }

  .summary {
    margin: 0;
    line-height: 1.55;
    color: var(--ink);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }

  .bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 198, 92, 0.12);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--gold);
    box-shadow: 0 0 8px var(--gold);
    transition: width 0.5s;
  }

  .nums {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-dim);
  }

  .safety {
    margin: 14px 0 0;
    padding: 9px 11px;
    border-left: 2px solid #ffb347;
    background: rgba(255, 179, 71, 0.08);
    font-size: 13px;
    line-height: 1.5;
    color: #ffd9a8;
  }

  .safety b {
    margin-right: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #ffb347;
  }

  section {
    margin-top: 20px;
  }

  h3 {
    margin: 0 0 8px;
    font-weight: 400;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .swatch {
    width: 6px;
    height: 6px;
    background: var(--c);
    box-shadow: 0 0 6px var(--c);
  }

  .tier {
    margin-bottom: 10px;
  }

  .tier__name {
    margin: 0 0 2px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--cyan);
    opacity: 0.8;
  }

  .tier ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .node {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 6px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .node:hover {
    background: var(--cyan-soft);
  }

  .node.is-party {
    background: rgba(255, 198, 92, 0.08);
  }

  .node__name {
    flex: 1;
    font-size: 14px;
    color: var(--ink);
  }

  .party {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--gold);
  }

  .muted {
    margin: 0;
    line-height: 1.55;
    color: var(--ink-dim);
  }
</style>
