<script lang="ts">
  import { galaxy } from '../lib/data';
  import { activeTree, focus, nav } from '../lib/stores';

  const domain = $derived($focus.domain ? galaxy.domainById.get($focus.domain) : undefined);
  const hobby = $derived($focus.hobby ? galaxy.hobbyById.get($focus.hobby) : undefined);
  const node = $derived(
    $focus.node && $activeTree?.hobby === $focus.hobby ? $activeTree.tree?.nodes.find((n) => n.id === $focus.node) : undefined,
  );
</script>

<header class="topbar">
  <button class="brand" onclick={() => nav.home()} aria-label="Skillnet: show the whole map">
    <span class="brand__mark" aria-hidden="true">◈</span>
    <span class="brand__name">SKILL<b>NET</b></span>
  </button>

  <nav class="crumbs" aria-label="Location">
    <button class="crumb" class:is-current={$focus.level === 'map'} onclick={() => nav.home()}>Map</button>
    {#if domain}
      <span class="sep" aria-hidden="true">/</span>
      <button
        class="crumb"
        style="--c: {domain.color}"
        class:is-current={$focus.level === 'domain'}
        onclick={() => nav.domain(domain.id)}>{domain.name}</button>
    {/if}
    {#if hobby}
      <span class="sep" aria-hidden="true">/</span>
      <button class="crumb" class:is-current={!node} onclick={() => nav.node(null)}>{hobby.name}</button>
    {/if}
    {#if node}
      <span class="sep" aria-hidden="true">/</span>
      <span class="crumb is-current">{node.name}</span>
    {/if}
  </nav>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 18px;
    flex: 1;
    min-width: 0;
    min-height: 36px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 2px;
    border: 0;
    background: none;
    cursor: pointer;
    pointer-events: auto;
    flex: none;
  }

  .brand__mark {
    color: var(--magenta);
    font-size: 20px;
    text-shadow: 0 0 12px var(--magenta);
  }

  .brand__name {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.32em;
    color: #fff;
    text-shadow: 0 0 10px rgba(46, 230, 255, 0.6);
  }

  .brand__name b {
    color: var(--cyan);
    font-weight: 600;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 11.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .crumb {
    padding: 4px 2px;
    border: 0;
    background: none;
    color: var(--ink-dim);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: auto;
  }

  button.crumb:hover {
    color: #fff;
  }

  .crumb[style] {
    color: var(--c);
  }

  .crumb.is-current {
    color: #fff;
  }

  .sep {
    color: var(--ink-faint);
  }

  /* Narrow desktops: no room for breadcrumbs beside the tools (the panel has its own back links). */
  @media (min-width: 760px) and (max-width: 999.98px) {
    .crumbs {
      display: none;
    }
  }

  @media (max-width: 759.98px) {
    .topbar {
      gap: 10px;
      flex-wrap: wrap;
      row-gap: 2px;
    }

    .brand__name {
      font-size: 15px;
      letter-spacing: 0.24em;
    }

    .crumbs {
      width: 100%;
      font-size: 10.5px;
    }
  }
</style>
