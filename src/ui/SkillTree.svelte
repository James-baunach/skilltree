<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { tick } from 'svelte';
  import { TIER_NAMES, type SkillTree, type SkillNode, type Tier } from '../lib/types';
  import { progress, nodeKey, setNodeState, TIER_XP, type NodeState } from '../lib/progress';
  import { formatHours } from '../lib/format';

  let { hobby, tree, activeNode }: { hobby: string; tree: SkillTree; activeNode?: string } = $props();

  const open = new SvelteSet<string>();
  const byId = $derived(new Map(tree.nodes.map((n) => [n.id, n])));
  const tiers = $derived(
    ([1, 2, 3, 4, 5] as Tier[]).map((t) => ({ tier: t, nodes: tree.nodes.filter((n) => n.tier === t) })).filter((t) => t.nodes.length),
  );

  const stateOf = (id: string): NodeState | undefined => $progress[nodeKey(hobby, id)]?.s;
  const unlocked = (n: SkillNode) => n.requires.every((r) => stateOf(r) === 'learned');
  const learned = $derived(tree.nodes.filter((n) => stateOf(n.id) === 'learned'));
  const xp = $derived(learned.reduce((a, n) => a + TIER_XP[n.tier], 0));
  const totalXp = $derived(tree.nodes.reduce((a, n) => a + TIER_XP[n.tier], 0));

  function cycle(n: SkillNode) {
    const s = stateOf(n.id);
    setNodeState(hobby, n, s === undefined ? 'learning' : s === 'learning' ? 'learned' : null);
  }

  function toggle(id: string) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
    history.replaceState(null, '', open.has(id) ? `#/h/${hobby}/${id}` : `#/h/${hobby}`);
  }

  $effect(() => {
    if (activeNode && byId.has(activeNode)) {
      open.add(activeNode);
      tick().then(() => document.getElementById(`n-${hobby}-${activeNode}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
  });
</script>

<div class="head">
  <h4 class="eyebrow">Skill tree</h4>
  <span class="mono muted">{learned.length}/{tree.nodes.length} learned · {xp.toLocaleString()}/{totalXp.toLocaleString()} XP</span>
</div>
<div class="meter"><span style:width="{(xp / totalXp) * 100}%"></span></div>

<ul class="tree root">
  {#each tiers as t (t.tier)}
    <li class="tier">
      <div class="row tierrow">
        <span class="tname">{TIER_NAMES[t.tier - 1]}</span>
        <span class="rule"></span>
        <span class="mono faint">{TIER_XP[t.tier]} XP each</span>
      </div>
      <ul class="tree">
        {#each t.nodes as n (n.id)}
          {@const st = stateOf(n.id)}
          {@const isOpen = open.has(n.id)}
          {@const ready = unlocked(n)}
          <li id="n-{hobby}-{n.id}">
            <div class="row nrow">
              <button
                class="status {st ?? 'none'}"
                onclick={() => cycle(n)}
                title={st === 'learned' ? 'Learned (click to reset)' : st === 'learning' ? 'Learning (click to mark learned)' : 'Click to start learning'}
                aria-label="Status: {st ?? 'not started'}"
              >{st === 'learned' ? '◆' : st === 'learning' ? '◈' : '◇'}</button>
              <button class="grow nname" class:locked={!ready && !st} onclick={() => toggle(n.id)} aria-expanded={isOpen}>
                {n.name}
                {#if n.partyTrick}<span class="party mono" title="Party trick: learn it in {n.partyTrick} min">✦ {n.partyTrick}m</span>{/if}
              </button>
              {#if n.requires.length}
                <span class="req faint hide-sm">← {n.requires.map((r) => byId.get(r)?.name ?? r).join(', ')}</span>
              {/if}
              <span class="mono faint hrs">{formatHours(n.hours)}</span>
            </div>
            {#if isOpen}
              <div class="node">
                <p>{n.summary}</p>
                <div class="grid">
                  <section>
                    <h5 class="eyebrow">How to learn it</h5>
                    <ol>{#each n.steps as step}<li>{step}</li>{/each}</ol>
                  </section>
                  <section>
                    <h5 class="eyebrow">Drills</h5>
                    <ul>{#each n.drills as d}<li>{d}</li>{/each}</ul>
                    {#if n.mistakes?.length}
                      <h5 class="eyebrow">Common mistakes</h5>
                      <ul>{#each n.mistakes as m}<li>{m}</li>{/each}</ul>
                    {/if}
                  </section>
                </div>
                <p class="mastery"><span class="eyebrow">Mastery check</span><br />{n.mastery}</p>
                {#if n.resources?.length}
                  <h5 class="eyebrow">Resources</h5>
                  <ul class="res">
                    {#each n.resources as r}
                      <li>
                        <span class="mono faint">{r.kind}</span>
                        {#if r.url}<a href={r.url} target="_blank" rel="noopener">{r.title}</a>{:else}{r.title}{/if}
                        {#if r.by}<span class="faint"> · {r.by}</span>{/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </li>
  {/each}
</ul>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 1.25rem;
  }
  h4 {
    margin: 0;
    font-weight: 400;
  }
  .meter {
    height: 3px;
    background: var(--bg-sunken);
    border-radius: 2px;
    margin: 0.35rem 0 0.5rem;
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--good);
    transition: width 0.3s;
  }
  .tierrow {
    gap: 0.75rem;
    padding: 0;
  }
  .tname {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .rule {
    flex: 1;
    border-top: 1px dashed var(--line);
  }
  .nrow {
    gap: 0.5rem;
    padding: 0 0.2rem;
  }
  .nrow:hover {
    background: var(--bg-sunken);
  }
  .status {
    width: 1.2rem;
    font-size: 0.95rem;
    line-height: 1;
    color: var(--fg-faint);
  }
  .status.learning {
    color: var(--warn);
  }
  .status.learned {
    color: var(--good);
  }
  .nname {
    text-align: left;
    padding: 0.25rem 0;
  }
  .nname.locked {
    color: var(--fg-muted);
  }
  .party {
    color: var(--warn);
    margin-left: 0.4rem;
  }
  .req {
    font-size: 0.78rem;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hrs {
    width: 4.2rem;
    text-align: right;
    flex: none;
  }
  .node {
    margin: 0.1rem 0 0.75rem 1.7rem;
    padding: 0.6rem 0.9rem;
    border-left: 2px solid var(--line);
    font-size: 0.9rem;
  }
  .node p {
    margin: 0 0 0.6rem;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  h5 {
    margin: 0.4rem 0 0.25rem;
    font-weight: 400;
  }
  ol,
  ul:not(.tree) {
    margin: 0;
    padding-left: 1.1rem;
  }
  li {
    margin-bottom: 0.15rem;
  }
  .mastery {
    margin-top: 0.75rem !important;
    padding: 0.5rem 0.7rem;
    background: var(--bg-sunken);
    border-radius: var(--radius);
  }
  .res {
    list-style: none;
    padding: 0 !important;
  }
  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
    }
    .node {
      margin-left: 0.5rem;
    }
  }
</style>
