<script lang="ts">
  import { onMount } from 'svelte';
  import { galaxy } from '../lib/data';
  import { loadNodeIndex, search, type SearchResult } from '../lib/search';
  import { nav, openMenu, searchHits } from '../lib/stores';
  import { TIER_NAMES } from '../lib/types';

  let input: HTMLInputElement;
  let query = $state('');
  let focused = $state(false);
  let active = $state(0);
  let indexVersion = $state(0); // bumped when skill nodes join the index, to re-run the search

  const results = $derived.by(() => {
    void indexVersion;
    return search(query);
  });
  const top = $derived(results.slice(0, 8));
  const open = $derived(focused && query.trim().length >= 2);

  // Light up every hobby the results touch, so the map answers the search too.
  $effect(() => {
    searchHits.set(query.trim().length >= 2 ? new Set(results.map((r) => r.hobby)) : null);
  });

  onMount(() => {
    const onSlash = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === '/' && t?.tagName !== 'INPUT' && t?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.focus();
      }
    };
    addEventListener('keydown', onSlash);
    return () => {
      removeEventListener('keydown', onSlash);
      searchHits.set(null);
    };
  });

  function onFocus() {
    focused = true;
    openMenu.set(null);
    loadNodeIndex().then(() => indexVersion++);
  }

  function choose(r: SearchResult) {
    nav.hobby(r.hobby, r.kind === 'node' ? (r.node ?? null) : null);
    query = '';
    input.blur();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      active = Math.min(active + 1, top.length - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      active = Math.max(active - 1, 0);
      e.preventDefault();
    } else if (e.key === 'Enter' && top[active]) {
      choose(top[active]);
    } else if (e.key === 'Escape') {
      query = '';
      input.blur();
    }
  }

  function subtitle(r: SearchResult) {
    const h = galaxy.hobbyById.get(r.hobby)!;
    return r.kind === 'hobby' ? galaxy.domains[h.domainIndex].name : `${h.name} · ${TIER_NAMES[(r.tier ?? 1) - 1]}`;
  }
</script>

<div class="search" class:is-focused={focused}>
  <span class="icon" aria-hidden="true">⌕</span>
  <input
    bind:this={input}
    bind:value={query}
    oninput={() => (active = 0)}
    onfocus={onFocus}
    onblur={() => (focused = false)}
    onkeydown={onKey}
    placeholder="Search hobbies & skills"
    aria-label="Search hobbies and skills"
    role="combobox"
    aria-expanded={open}
    aria-controls="search-results"
    aria-autocomplete="list"
    autocomplete="off"
    spellcheck="false"
  />
  {#if !focused && !query}<kbd aria-hidden="true">/</kbd>{/if}

  {#if open}
    <ul id="search-results" class="results glass" role="listbox">
      {#each top as r, i (r.kind + ':' + r.hobby + ':' + (r.node ?? ''))}
        {@const color = galaxy.domains[galaxy.hobbyById.get(r.hobby)!.domainIndex].color}
        <li role="option" aria-selected={i === active}>
          <button
            class:is-active={i === active}
            onmousedown={(e) => {
              e.preventDefault();
              choose(r);
            }}
            onmouseenter={() => (active = i)}>
            <span class="kind" style="--c: {color}">{r.kind === 'hobby' ? '◆' : '◇'}</span>
            <span class="text">
              <span class="name">{r.name}</span>
              <span class="sub">{subtitle(r)}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="note">Nothing yet. Many more hobbies arrive in the next content waves.</li>
      {/each}
      {#if results.length > top.length}
        <li class="note">+{results.length - top.length} more, lit up on the map</li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    display: flex;
    align-items: center;
    width: 260px;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--cyan-line);
    background: var(--glass);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    pointer-events: auto;
    transition: border-color 0.15s, width 0.2s;
  }

  .search.is-focused {
    border-color: var(--cyan);
    width: 320px;
  }

  .icon {
    color: var(--cyan);
    font-size: 17px;
    margin-right: 8px;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: 0;
    background: none;
    color: #fff;
    font: inherit;
    font-size: 14px;
  }

  input::placeholder {
    color: var(--ink-faint);
  }

  kbd {
    padding: 0 6px;
    border: 1px solid var(--cyan-line);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-dim);
  }

  .results {
    position: absolute;
    top: calc(100% + 6px);
    left: -1px;
    right: -1px;
    margin: 0;
    padding: 6px 0;
    list-style: none;
    z-index: 5;
    background: var(--glass-strong);
  }

  .results button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 12px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .results button.is-active {
    background: var(--cyan-soft);
  }

  .kind {
    color: var(--c);
    font-size: 12px;
    text-shadow: 0 0 6px var(--c);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-size: 14px;
    color: #fff;
  }

  .sub {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note {
    padding: 7px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-dim);
  }

  @media (max-width: 1099.98px) {
    .search {
      width: 200px;
    }

    .search.is-focused {
      width: 260px;
    }
  }

  @media (max-width: 759.98px) {
    .search,
    .search.is-focused {
      width: auto;
      flex: 1;
    }

    kbd {
      display: none;
    }
  }
</style>
