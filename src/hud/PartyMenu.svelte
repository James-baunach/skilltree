<script lang="ts">
  import { galaxy } from '../lib/data';
  import { nav, openMenu, partyMode } from '../lib/stores';

  // Every quick-win skill across the charted trees, fastest first.
  const tricks = galaxy.hobbies
    .flatMap((h) => (h.meta?.party ?? []).map((p) => ({ ...p, hobby: h })))
    .sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name));

  function toggle() {
    const on = !$partyMode;
    partyMode.set(on);
    openMenu.set(on ? 'party' : null);
  }
</script>

<div class="menu-wrap">
  <button class="btn is-gold" class:is-on={$partyMode} aria-label="Party tricks" aria-pressed={$partyMode} onclick={toggle}>
    <span aria-hidden="true">✦</span><span class="label">Party tricks</span>
  </button>

  {#if $openMenu === 'party'}
    <div class="menu glass" role="dialog" aria-label="Party tricks">
      <p class="eyebrow gold">Learn it in under an hour</p>
      <ul>
        {#each tricks as t (t.hobby.id + '/' + t.id)}
          <li>
            <button
              onclick={() => {
                nav.hobby(t.hobby.id, t.id);
                openMenu.set(null);
              }}>
              <span class="text">
                <span class="name">{t.name}</span>
                <span class="sub" style="--c: {galaxy.domains[t.hobby.domainIndex].color}">{t.hobby.name}</span>
              </span>
              <span class="min">{t.minutes} min</span>
            </button>
          </li>
        {/each}
      </ul>
      <p class="note">Hobbies with quick wins glow on the map. Turn the layer off with the same button.</p>
    </div>
  {/if}
</div>

<style>
  .gold {
    margin: 0 0 8px;
    color: var(--gold);
  }

  ul {
    list-style: none;
    margin: 0 -14px;
    padding: 0;
  }

  li button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 7px 14px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  li button:hover {
    background: var(--gold-soft);
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .name {
    font-size: 14px;
    color: #fff;
  }

  .sub {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--c);
  }

  .min {
    flex: none;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--gold);
  }

  .note {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink-dim);
  }
</style>
