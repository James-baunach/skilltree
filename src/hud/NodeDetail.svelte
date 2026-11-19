<script lang="ts">
  import { nodeKey, progress, setNodeState, TIER_XP } from '../lib/progress';
  import { nav } from '../lib/stores';
  import { TIER_NAMES, type HobbyEntry, type SkillNode, type SkillTree } from '../lib/types';
  import { formatHours } from './format';

  let { hobby, tree, node }: { hobby: HobbyEntry; tree: SkillTree; node: SkillNode } = $props();

  const state = $derived($progress[nodeKey(hobby.id, node.id)]?.s ?? null);
  const reqs = $derived(node.requires.map((r) => tree.nodes.find((n) => n.id === r)).filter((n) => n !== undefined));
  const unlocks = $derived(tree.nodes.filter((n) => n.requires.includes(node.id)));
  const missing = $derived(reqs.filter((r) => $progress[nodeKey(hobby.id, r.id)]?.s !== 'learned'));
  const learned = (n: SkillNode) => $progress[nodeKey(hobby.id, n.id)]?.s === 'learned';
</script>

<article class="node">
  <button class="btn is-ghost back" onclick={() => nav.node(null)}>‹ {hobby.name}</button>

  <p class="eyebrow tier">{TIER_NAMES[node.tier - 1]} · Tier {node.tier} · {TIER_XP[node.tier]} XP</p>
  <h2>{node.name}</h2>
  {#if node.partyTrick}
    <p class="party">✦ Party trick · learn it in about {node.partyTrick} minutes</p>
  {/if}
  <p class="summary">{node.summary}</p>

  <div class="actions">
    {#if state === 'learned'}
      <button class="btn is-gold is-on" onclick={() => setNodeState(hobby.id, node, null)}>✓ Learned · undo</button>
    {:else}
      <button
        class="btn is-magenta"
        class:is-on={state === 'learning'}
        onclick={() => setNodeState(hobby.id, node, state === 'learning' ? null : 'learning')}>
        {state === 'learning' ? '◉ Learning · stop' : 'Start learning'}
      </button>
      <button class="btn is-gold" onclick={() => setNodeState(hobby.id, node, 'learned')}>Mark learned</button>
    {/if}
  </div>
  {#if missing.length && state !== 'learned'}
    <p class="note">Builds on {missing.map((r) => r.name).join(', ')}. Already know it? Mark it anyway.</p>
  {/if}

  <section>
    <h3 class="eyebrow">How to learn it</h3>
    <ol>
      {#each node.steps as s, i (i)}<li>{s}</li>{/each}
    </ol>
  </section>

  <section>
    <h3 class="eyebrow">Practice drills</h3>
    <ul>
      {#each node.drills as s, i (i)}<li>{s}</li>{/each}
    </ul>
  </section>

  <section class="mastery">
    <h3 class="eyebrow">You've got it when</h3>
    <p>{node.mastery}</p>
  </section>

  <p class="facts"><span class="chip">{formatHours(node.hours)} of practice</span></p>

  {#if reqs.length}
    <section>
      <h3 class="eyebrow">Requires</h3>
      <div class="chips">
        {#each reqs as r (r.id)}
          <button class="chip" onclick={() => nav.node(r.id)}><span class="dot" class:is-learned={learned(r)}></span>{r.name}</button>
        {/each}
      </div>
    </section>
  {/if}
  {#if unlocks.length}
    <section>
      <h3 class="eyebrow">Unlocks</h3>
      <div class="chips">
        {#each unlocks as u (u.id)}
          <button class="chip" onclick={() => nav.node(u.id)}><span class="dot" class:is-learned={learned(u)}></span>{u.name}</button>
        {/each}
      </div>
    </section>
  {/if}
</article>

<style>
  .back {
    margin: -6px 0 10px -10px;
    text-transform: none;
    letter-spacing: 0.04em;
  }

  .tier {
    margin: 0;
    color: var(--cyan);
  }

  h2 {
    margin: 4px 0 8px;
    font-size: 26px;
    font-weight: 600;
    color: #fff;
  }

  .party {
    margin: 0 0 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--gold);
  }

  .summary {
    margin: 0;
    line-height: 1.55;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .note {
    margin: 10px 0 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-dim);
  }

  section {
    margin-top: 20px;
  }

  h3 {
    margin: 0 0 8px;
    font-weight: 400;
  }

  ol,
  ul {
    margin: 0;
    padding-left: 20px;
    line-height: 1.55;
  }

  li {
    margin-bottom: 6px;
  }

  li::marker {
    color: var(--cyan);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .mastery {
    padding: 12px 14px;
    border: 1px solid rgba(255, 198, 92, 0.35);
    background: var(--gold-soft);
  }

  .mastery h3 {
    color: var(--gold);
  }

  .mastery p {
    margin: 0;
    line-height: 1.55;
    color: #fff3dc;
  }

  .facts {
    margin: 16px 0 0;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
