<script lang="ts">
  import { router, href, go } from '../lib/router.svelte';
  import { search, loadNodeIndex, type SearchResult } from '../lib/search';
  import { character } from '../lib/progress';
  import { TIER_NAMES } from '../lib/types';

  let query = $state('');
  let active = $state(0);
  let open = $state(false);
  let input: HTMLInputElement;
  let nodesReady = $state(false);
  const results: SearchResult[] = $derived.by(() => {
    void nodesReady; // re-run once skill nodes join the index
    return search(query);
  });

  function pick(r: SearchResult) {
    if (r.kind === 'sub') go({ view: 'tree', group: r.sub });
    else go({ view: 'tree', hobby: r.hobby, node: r.node });
    query = '';
    open = false;
    input.blur();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, results.length - 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); e.preventDefault(); }
    else if (e.key === 'Enter' && results[active]) pick(results[active]);
    else if (e.key === 'Escape') { query = ''; input.blur(); }
  }

  function onGlobalKey(e: KeyboardEvent) {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); input.focus(); }
  }

  const tabs = [
    { view: 'tree', label: 'Tree' },
    { view: 'map', label: 'Connections' },
    { view: 'traits', label: 'Traits' },
  ] as const;
</script>

<svelte:window onkeydown={onGlobalKey} />

<header>
  <div class="inner">
    <a class="brand" href="#/">Skilltree</a>
    <nav>
      {#each tabs as t}
        <a href={href({ view: t.view })} class:on={router.route.view === t.view}>{t.label}</a>
      {/each}
    </nav>
    <div class="search">
      <input
        bind:this={input}
        bind:value={query}
        oninput={() => { active = 0; open = true; }}
        onfocus={() => { open = true; loadNodeIndex().then(() => (nodesReady = true)); }}
        onblur={() => setTimeout(() => (open = false), 150)}
        onkeydown={onKey}
        placeholder="Search hobbies & skills  /"
        aria-label="Search"
      />
      {#if open && results.length}
        <ul class="results" role="listbox">
          {#each results as r, i}
            <li>
              <button class:active={i === active} onmousedown={() => pick(r)} onmouseenter={() => (active = i)}>
                <span class="kind mono">{r.kind === 'node' ? TIER_NAMES[(r.tier ?? 1) - 1] : r.kind === 'sub' ? 'Group' : 'Hobby'}</span>
                <span class="name">{r.name}</span>
                <span class="ctx faint">{r.context}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <a class="me mono" href="#/me" class:on={router.route.view === 'me'} title="Your character sheet">
      LV {$character.level} · {$character.xp.toLocaleString()} XP
    </a>
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--line);
  }
  .inner {
    max-width: 980px;
    margin: 0 auto;
    padding: 0.6rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .brand {
    font-weight: 700;
    letter-spacing: -0.02em;
    text-decoration: none;
    font-size: 1.05rem;
  }
  nav {
    display: flex;
    gap: 0.9rem;
  }
  nav a,
  .me {
    text-decoration: none;
    color: var(--fg-muted);
    font-size: 0.9rem;
  }
  nav a.on,
  nav a:hover,
  .me:hover,
  .me.on {
    color: var(--fg);
  }
  nav a.on {
    text-decoration: underline;
    text-underline-offset: 6px;
    text-decoration-thickness: 2px;
    text-decoration-color: var(--accent);
  }
  .search {
    position: relative;
    flex: 1;
  }
  input {
    width: 100%;
    font: inherit;
    font-size: 0.9rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--fg);
  }
  input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: 0 8px 30px rgb(0 0 0 / 0.12);
    max-height: 60vh;
    overflow: auto;
  }
  .results button {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    width: 100%;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    text-align: left;
  }
  .results button.active {
    background: var(--accent-soft);
  }
  .kind {
    width: 5.5rem;
    flex: none;
    color: var(--fg-muted);
  }
  .ctx {
    margin-left: auto;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  @media (max-width: 720px) {
    .inner {
      flex-wrap: wrap;
      gap: 0.6rem 1rem;
    }
    .search {
      order: 5;
      flex-basis: 100%;
    }
  }
</style>
