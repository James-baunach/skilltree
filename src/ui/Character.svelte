<script lang="ts">
  import { character, exportProgress, importProgress, progress } from '../lib/progress';
  import { hobbyById, domainById } from '../lib/data';
  import { href } from '../lib/router.svelte';

  let message = $state('');
  let fileInput: HTMLInputElement;

  const rows = $derived(
    [...$character.byHobby.entries()]
      .map(([id, p]) => ({ id, h: hobbyById.get(id), ...p }))
      .filter((r) => r.h)
      .sort((x, y) => y.xp - x.xp || y.learning - x.learning),
  );

  function download() {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skilltree-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      message = `Imported ${importProgress(await f.text())} skills.`;
    } catch (err) {
      message = (err as Error).message;
    }
    fileInput.value = '';
  }

  function reset() {
    if (confirm('Reset all progress in this browser? This cannot be undone.')) progress.set({});
  }
</script>

<section class="intro">
  <p class="eyebrow">Character sheet</p>
  <h1>Level {$character.level}</h1>
  <div class="meter"><span style:width="{$character.fraction * 100}%"></span></div>
  <p class="mono muted">{$character.xp.toLocaleString()} XP · {($character.next - $character.xp).toLocaleString()} to level {$character.level + 1} · {$character.learned} learned · {$character.learning} in progress</p>
</section>

{#if rows.length}
  <ul class="tree root list">
    {#each rows as r}
      <li class="row">
        <span class="dot" style:--c={domainById.get(r.h!.domain)?.color}></span>
        <a class="grow" href={href({ view: 'tree', hobby: r.id })}>{r.h!.name}</a>
        <span class="mono muted">{r.learned}{r.h!.meta ? `/${r.h!.meta.nodes}` : ''} learned{r.learning ? ` · ${r.learning} learning` : ''}</span>
        <span class="mono xp">{r.xp.toLocaleString()} XP</span>
      </li>
    {/each}
  </ul>
{:else}
  <p class="muted">No skills tracked yet. Open a charted hobby in the <a href="#/">tree</a> and click the ◇ next to a skill to start learning it.</p>
{/if}

<section class="data">
  <h2 class="eyebrow">Your data</h2>
  <p class="muted small">Progress is saved in this browser only. Export it to move it somewhere else.</p>
  <div class="btns">
    <button class="btn" onclick={download}>Export</button>
    <button class="btn" onclick={() => fileInput.click()}>Import</button>
    <button class="btn danger" onclick={reset}>Reset</button>
    <input type="file" accept="application/json" bind:this={fileInput} onchange={onFile} hidden />
  </div>
  {#if message}<p class="small">{message}</p>{/if}
</section>

<style>
  .intro {
    margin: 1rem 0 2rem;
  }
  h1 {
    font-size: 2.4rem;
    letter-spacing: -0.03em;
    margin: 0.1rem 0 0.5rem;
  }
  .meter {
    height: 6px;
    background: var(--bg-sunken);
    border-radius: 3px;
    overflow: hidden;
    max-width: 420px;
    margin-bottom: 0.5rem;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--good);
  }
  .list .row {
    border-bottom: 1px solid var(--line);
  }
  .list a {
    text-decoration: none;
    font-weight: 550;
  }
  .xp {
    width: 6rem;
    text-align: right;
  }
  .data {
    margin-top: 3rem;
  }
  .data h2 {
    font-weight: 400;
    margin: 0;
  }
  .small {
    font-size: 0.88rem;
  }
  .btns {
    display: flex;
    gap: 0.5rem;
  }
  .danger:hover {
    border-color: var(--heat);
    color: var(--heat);
  }
</style>
