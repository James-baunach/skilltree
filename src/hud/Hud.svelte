<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { focus, openMenu } from '../lib/stores';
  import CharacterChip from './CharacterChip.svelte';
  import DomainPanel from './DomainPanel.svelte';
  import FilterMenu from './FilterMenu.svelte';
  import Hints from './Hints.svelte';
  import HobbyPanel from './HobbyPanel.svelte';
  import PartyMenu from './PartyMenu.svelte';
  import Search from './Search.svelte';
  import Tooltip from './Tooltip.svelte';
  import TopBar from './TopBar.svelte';

  onMount(() => {
    // Close popovers on any press outside them, and let Escape close a popover
    // before it's treated as "go up a level".
    const onPress = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('.menu-wrap')) openMenu.set(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && get(openMenu)) {
        openMenu.set(null);
        e.stopImmediatePropagation();
      }
    };
    addEventListener('pointerdown', onPress, true);
    addEventListener('keydown', onKey, true);
    return () => {
      removeEventListener('pointerdown', onPress, true);
      removeEventListener('keydown', onKey, true);
    };
  });
</script>

<div class="hud">
  <header class="hud-top">
    <TopBar />
    <div class="tools">
      <Search />
      <FilterMenu />
      <PartyMenu />
    </div>
    <CharacterChip />
  </header>

  {#if $focus.level === 'domain' && $focus.domain}
    {#key $focus.domain}
      <DomainPanel id={$focus.domain} />
    {/key}
  {:else if $focus.level === 'hobby' && $focus.hobby}
    {#key $focus.hobby}
      <HobbyPanel id={$focus.hobby} node={$focus.node} />
    {/key}
  {/if}
  <Tooltip />
  <Hints />
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  /* Fade the map out behind the header so labels passing under it don't clash with it */
  .hud::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 92px;
    background: linear-gradient(to bottom, rgba(3, 4, 10, 0.92), rgba(3, 4, 10, 0));
  }

  @media (max-width: 759.98px) {
    .hud::before {
      height: 150px;
    }
  }

  .hud-top {
    position: absolute;
    top: var(--gutter);
    left: var(--gutter);
    right: var(--gutter);
    display: flex;
    align-items: flex-start;
    gap: 14px;
    z-index: 3;
  }

  .tools {
    display: flex;
    gap: 6px;
    flex: none;
  }

  /* Narrow desktops: icon-only tool buttons so the brand keeps its room. */
  @media (max-width: 1099.98px) {
    .tools :global(.btn .label) {
      display: none;
    }
  }

  @media (max-width: 759.98px) {
    .hud-top {
      top: 12px;
      left: 12px;
      right: 12px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'bar chip'
        'tools tools';
      gap: 8px 10px;
    }

    .hud-top > :global(.topbar) {
      grid-area: bar;
    }

    .hud-top > :global(.char-wrap) {
      grid-area: chip;
    }

    .tools {
      grid-area: tools;
    }
  }
</style>
