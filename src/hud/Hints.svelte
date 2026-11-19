<script lang="ts">
  import { focus } from '../lib/stores';

  const hints = {
    map: 'Scroll to zoom into any district · Drag to pan · Click for details',
    domain: 'Keep scrolling into a hobby to see its skill tree · Esc closes',
    hobby: 'Click a skill for details · Esc steps back',
  };
</script>

<p class="hints" class:has-panel={$focus.level !== 'map'}>{hints[$focus.level]}</p>

<style>
  .hints {
    position: absolute;
    left: var(--gutter);
    bottom: var(--gutter);
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  @media (max-width: 759.98px) {
    .hints.has-panel {
      display: none;
    }
  }
</style>
