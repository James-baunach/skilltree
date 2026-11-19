<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nav } from '../lib/stores';

  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<aside class="panel glass" aria-label={label}>
  <button class="close" aria-label="Close panel" onclick={() => nav.home(false)}>×</button>
  <div class="panel__body scroll">
    {@render children()}
  </div>
</aside>

<style>
  .panel {
    position: absolute;
    top: 72px;
    right: var(--gutter);
    bottom: var(--gutter);
    width: calc(var(--panel-w) - var(--gutter));
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    animation: slide-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .panel__body {
    flex: 1;
    padding: 20px 22px 24px;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    width: 30px;
    height: 30px;
    border: 1px solid transparent;
    background: none;
    color: var(--ink-dim);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    color: #fff;
    border-color: var(--cyan-line);
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(18px);
    }
  }

  @media (max-width: 759.98px) {
    .panel {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      height: 44vh;
      border-left: 0;
      border-right: 0;
      border-bottom: 0;
      animation-name: slide-up;
    }

    .panel__body {
      padding: 16px 16px 24px;
    }

    @keyframes slide-up {
      from {
        opacity: 0;
        transform: translateY(24px);
      }
    }
  }
</style>
