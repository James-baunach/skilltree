<script lang="ts">
  import { router } from './lib/router.svelte';
  import Header from './ui/Header.svelte';
  import TreeView from './ui/TreeView.svelte';
  import HeatMap from './ui/HeatMap.svelte';
  import TraitExplorer from './ui/TraitExplorer.svelte';
  import Character from './ui/Character.svelte';
</script>

<Header />

<main class="page">
  {#if router.route.view === 'tree'}
    <TreeView hobby={router.route.hobby} node={router.route.node} />
  {:else if router.route.view === 'map'}
    <HeatMap a={router.route.a} b={router.route.b} />
  {:else if router.route.view === 'traits'}
    <TraitExplorer trait={router.route.trait} />
  {:else}
    <Character />
  {/if}
</main>
