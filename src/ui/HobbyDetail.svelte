<script lang="ts">
  import { hobbyById, loadGraph, loadTree, traitById, domainById, type HobbyEntry } from '../lib/data';
  import { formatHours, COST_LABEL, SOCIAL_LABEL, SETTING_LABEL } from '../lib/format';
  import { href } from '../lib/router.svelte';
  import SkillTree from './SkillTree.svelte';

  let { hobby, activeNode }: { hobby: HobbyEntry; activeNode?: string } = $props();

  const graph = loadGraph();
  const tree = $derived(loadTree(hobby.id));
  const s = $derived(hobby.stats);
</script>

<div class="detail">
  <p class="summary">{hobby.summary}</p>

  <dl class="stats">
    <div><dt>Difficulty</dt><dd>{s.difficulty} / 5</dd></div>
    <div><dt>To competence</dt><dd>{formatHours(s.hours)}</dd></div>
    <div><dt>Start-up cost</dt><dd>{COST_LABEL[s.cost]}</dd></div>
    <div><dt>Style</dt><dd>{SOCIAL_LABEL[s.social]} · {SETTING_LABEL[s.setting]}</dd></div>
    {#if s.gear.length}<div class="wide"><dt>Gear</dt><dd>{s.gear.join(', ')}</dd></div>{/if}
  </dl>
  {#if hobby.safety}<p class="safety"><strong>Safety:</strong> {hobby.safety}</p>{/if}

  {#await graph then g}
    {@const profile = Object.entries(g.profiles[hobby.id] ?? {}).sort((a, b) => b[1] - a[1])}
    {@const related = g.related[hobby.id] ?? []}
    <div class="cols">
      <section>
        <h4 class="eyebrow">Trains</h4>
        <ul class="bars">
          {#each profile as [t, w]}
            <li>
              <a href={href({ view: 'traits', trait: t })}>{traitById.get(t)?.name ?? t}</a>
              <span class="bar mono" aria-label="{w} of 3">{'■'.repeat(w)}<span class="off">{'■'.repeat(3 - w)}</span></span>
            </li>
          {/each}
        </ul>
      </section>
      <section>
        <h4 class="eyebrow">Closest hobbies</h4>
        <ul class="related">
          {#each related.slice(0, 8) as [id, score, shared, syn]}
            {@const r = hobbyById.get(id)}
            {#if r}
              <li>
                <span class="heat" style:--v={score}></span>
                <a href={href({ view: 'tree', hobby: id })}>{r.name}</a>
                {#if syn}<span class="syn" title="Hand-picked synergy">✦</span>{/if}
                <span class="faint why">
                  {r.domain !== hobby.domain ? domainById.get(r.domain)?.name + ' · ' : ''}{shared.map((t) => traitById.get(t)?.name).join(', ')}
                </span>
              </li>
            {/if}
          {/each}
        </ul>
      </section>
    </div>
  {/await}

  {#await tree}
    <p class="faint">Loading tree…</p>
  {:then t}
    {#if t}
      <SkillTree hobby={hobby.id} tree={t} {activeNode} />
    {:else}
      <p class="uncharted">
        <span class="eyebrow">Uncharted</span><br />
        This hobby's skill tree hasn't been written yet. The stats, traits and connections above are already live.
      </p>
    {/if}
  {/await}
</div>

<style>
  .detail {
    margin: 0.25rem 0 1.25rem 0.4rem;
    padding: 0.9rem 1.1rem 1rem;
    border: 1px solid var(--line);
    border-left: 3px solid var(--c, var(--accent));
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .summary {
    margin: 0 0 0.75rem;
    font-size: 0.98rem;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.6rem;
    margin: 0 0 0.75rem;
  }
  .stats .wide {
    flex-basis: 100%;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-faint);
  }
  dd {
    margin: 0;
    font-size: 0.9rem;
  }
  .safety {
    font-size: 0.85rem;
    color: var(--warn);
    margin: 0 0 0.75rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 2fr;
    gap: 1.5rem;
    margin: 1rem 0;
  }
  h4 {
    margin: 0 0 0.4rem;
    font-weight: 400;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .bars li {
    display: flex;
    justify-content: space-between;
    font-size: 0.88rem;
    line-height: 1.7;
  }
  .bars a,
  .related a {
    text-decoration: none;
  }
  .bars a:hover,
  .related a:hover {
    text-decoration: underline;
  }
  .bar {
    color: var(--c, var(--accent));
    letter-spacing: 0.05em;
  }
  .bar .off {
    color: var(--line);
  }
  .related li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.88rem;
    line-height: 1.75;
    white-space: nowrap;
  }
  .heat {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    flex: none;
    align-self: center;
    background: color-mix(in oklab, var(--heat) calc(var(--v) * 100%), var(--bg-sunken));
  }
  .syn {
    color: var(--warn);
    font-size: 0.75rem;
  }
  .why {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.8rem;
  }
  .uncharted {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--fg-muted);
  }
  @media (max-width: 640px) {
    .cols {
      grid-template-columns: 1fr;
    }
    .detail {
      margin-left: 0;
    }
  }
</style>
