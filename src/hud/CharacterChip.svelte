<script lang="ts">
  import { galaxy } from '../lib/data';
  import { character, exportProgress, importProgress, progress } from '../lib/progress';
  import { nav, openMenu } from '../lib/stores';

  let fileInput = $state<HTMLInputElement>();
  let message = $state('');

  const inProgress = $derived(
    [...$character.byHobby.entries()]
      .map(([id, p]) => ({ h: galaxy.hobbyById.get(id), p }))
      .filter((x) => x.h !== undefined)
      .sort((a, b) => b.p.xp - a.p.xp || b.p.learning - a.p.learning)
      .slice(0, 6),
  );

  function download() {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skillnet-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    message = 'Progress file saved.';
  }

  async function upload(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    if (!file) return;
    try {
      const n = importProgress(await file.text());
      message = `Imported ${n} skill${n === 1 ? '' : 's'}.`;
    } catch {
      message = "That file isn't a Skillnet progress export.";
    }
    el.value = '';
  }

  function reset() {
    if (confirm('Reset all progress? This clears every skill you have marked in this browser.')) {
      progress.set({});
      message = 'Progress reset.';
    }
  }
</script>

<div class="menu-wrap char-wrap">
  <button
    class="char glass"
    aria-expanded={$openMenu === 'character'}
    aria-label="Level {$character.level}, {$character.xp} XP. Open character sheet"
    onclick={() => {
      message = '';
      openMenu.update((m) => (m === 'character' ? null : 'character'));
    }}>
    <span class="lvl">
      <span class="eyebrow">LVL</span>
      <b>{$character.level}</b>
    </span>
    <span class="meta">
      <span class="bar" aria-hidden="true"><span style="width: {Math.round($character.fraction * 100)}%"></span></span>
      <span class="nums">
        {$character.xp.toLocaleString()} / {$character.next.toLocaleString()} XP
        <span class="sep">·</span>
        {$character.learned} learned
      </span>
    </span>
  </button>

  {#if $openMenu === 'character'}
    <div class="menu glass sheet" role="dialog" aria-label="Character sheet">
      <p class="eyebrow">Character sheet</p>
      <div class="totals">
        <div><b>{$character.level}</b><span>Level</span></div>
        <div><b>{$character.xp.toLocaleString()}</b><span>XP</span></div>
        <div><b>{$character.learned}</b><span>Learned</span></div>
        <div><b>{$character.learning}</b><span>Learning</span></div>
      </div>

      {#if inProgress.length}
        <p class="eyebrow">Your hobbies</p>
        <ul class="hobbies">
          {#each inProgress as { h, p } (h!.id)}
            <li>
              <button
                onclick={() => {
                  nav.hobby(h!.id);
                  openMenu.set(null);
                }}>
                <span class="swatch" style="--c: {galaxy.domains[h!.domainIndex].color}"></span>
                <span class="name">{h!.name}</span>
                <span class="count">{p.learned}/{h!.meta?.nodes ?? '?'}{p.learning ? ` · ${p.learning} in progress` : ''}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">Open any skill and press <b>Start learning</b> or <b>Mark learned</b> to begin levelling up.</p>
      {/if}

      <p class="eyebrow">Your data</p>
      <p class="hint">Progress is saved in this browser only. Export a file to back it up or move it to another device.</p>
      <div class="actions">
        <button class="btn" onclick={download}>Export</button>
        <button class="btn" onclick={() => fileInput?.click()}>Import</button>
        <button class="btn is-ghost" onclick={reset}>Reset</button>
        <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={upload} />
      </div>
      {#if message}<p class="message" role="status">{message}</p>{/if}
    </div>
  {/if}
</div>

<style>
  .char-wrap {
    flex: none;
  }

  .char {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 14px 7px 12px;
    cursor: pointer;
    text-align: left;
  }

  .char:hover {
    border-color: var(--cyan);
  }

  .lvl {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
  }

  .lvl .eyebrow {
    font-size: 9px;
    color: var(--gold);
  }

  .lvl b {
    margin-top: 3px;
    font-size: 22px;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 0 10px rgba(255, 198, 92, 0.7);
  }

  .meta {
    display: block;
    width: 168px;
  }

  .bar {
    display: block;
    height: 5px;
    background: rgba(255, 198, 92, 0.12);
    border: 1px solid rgba(255, 198, 92, 0.25);
  }

  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #ff9b3c, var(--gold));
    box-shadow: 0 0 8px var(--gold);
    transition: width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .nums {
    display: block;
    margin-top: 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--ink-dim);
    white-space: nowrap;
  }

  .sep {
    color: var(--ink-faint);
  }

  @media (min-width: 760px) {
    .sheet {
      width: 320px;
    }
  }

  .sheet .eyebrow {
    margin: 0 0 8px;
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    margin-bottom: 16px;
    background: var(--cyan-line);
    border: 1px solid var(--cyan-line);
  }

  .totals div {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    background: rgba(5, 9, 20, 0.95);
  }

  .totals b {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .totals span {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }

  .hobbies {
    list-style: none;
    margin: 0 -14px 14px;
    padding: 0;
  }

  .hobbies button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 14px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .hobbies button:hover {
    background: var(--cyan-soft);
  }

  .swatch {
    width: 6px;
    height: 6px;
    background: var(--c);
    box-shadow: 0 0 6px var(--c);
  }

  .name {
    flex: 1;
    font-size: 14px;
    color: #fff;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--gold);
  }

  .hint {
    margin: 0 0 14px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-dim);
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .message {
    margin: 10px 0 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--cyan);
  }

  @media (max-width: 1099.98px) {
    .meta {
      width: 120px;
    }
  }

  @media (max-width: 759.98px) {
    .meta {
      width: 74px;
    }

    .nums {
      display: none;
    }
  }
</style>
