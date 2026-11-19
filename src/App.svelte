<script lang="ts">
  import { onMount } from 'svelte';
  import { Engine } from './engine/Engine';
  import { initRouting } from './lib/stores';
  import Hud from './hud/Hud.svelte';

  let stage: HTMLDivElement;
  let labelLayer: HTMLDivElement;
  let failed = $state(false);

  onMount(() => {
    let engine: Engine | null = null;
    try {
      engine = new Engine(stage, labelLayer);
      engine.start();
    } catch (e) {
      console.error(e);
      failed = true;
    }
    const stopRouting = initRouting();
    return () => {
      stopRouting();
      engine?.dispose();
    };
  });
</script>

<div class="stage" bind:this={stage}></div>
<div class="labels" bind:this={labelLayer}></div>

{#if failed}
  <div class="fallback glass">
    <p class="eyebrow">Signal lost</p>
    <p>Your browser couldn't start WebGL, which the galaxy needs. Try a recent Chrome, Edge, Firefox or Safari, or turn on hardware acceleration.</p>
  </div>
{:else}
  <Hud />
{/if}

<style>
  .stage {
    position: fixed;
    inset: 0;
    touch-action: none;
  }

  .stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .stage :global(canvas:active) {
    cursor: grabbing;
  }

  .fallback {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100% - 32px));
    padding: 20px 22px;
    line-height: 1.5;
  }
</style>
