<script lang="ts">
  import Printer from 'lucide-svelte/icons/printer';
  import Download from 'lucide-svelte/icons/download';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import { invalidateAll } from '$app/navigation';
  import { toast } from '$lib/toast.svelte';
  import TypeTile from '$lib/components/TypeTile.svelte';
  import { pad4 } from '$lib/types';

  let { data } = $props();
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));

  let selected = $state<number[]>([]);
  const all = $derived(data.queue.length > 0 && selected.length === data.queue.length);
  const codes = $derived(selected.join(','));

  function toggleAll() {
    selected = all ? [] : data.queue.map((q) => q.code);
  }
  async function post(body: unknown) {
    const res = await fetch('/api/printed', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? 'Something went wrong');
    return out;
  }
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong', { error: true });

  /** Keep the current label as is: accept the contents without printing, so the rows leave the queue. */
  async function skip() {
    const n = selected.length;
    try {
      const { previous } = await post({ codes: selected, skip: true });
      selected = [];
      await invalidateAll();
      toast(`Skipped ${n} label${n === 1 ? '' : 's'}`, {
        undo: async () => {
          try {
            await post({ restore: previous });
            await invalidateAll();
          } catch (e) {
            fail(e);
          }
        }
      });
    } catch (e) {
      fail(e);
    }
  }

  // drop selections for rows that left the queue
  $effect(() => {
    const live = new Set(data.queue.map((q) => q.code));
    if (selected.some((c) => !live.has(c))) selected = selected.filter((c) => live.has(c));
  });
</script>

<svelte:head><title>Print queue · Bins</title></svelte:head>

<div class="page">
  <header>
    <div>
      <h1>Print queue</h1>
      <p class="muted sub">
        {#if data.queue.length}{data.queue.length} label{data.queue.length === 1 ? '' : 's'} never printed or changed since the last print{:else}Nothing to print{/if}
      </p>
    </div>
    {#if data.queue.length}
      <div class="actions">
        <button type="button" class="btn sm" class:primary={!selected.length} onclick={toggleAll}>{all ? 'Clear selection' : 'Select all'}</button>
        <button type="button" class="btn sm" disabled={!selected.length} title="Keep the current label and take these off the list without printing" onclick={skip}
          ><EyeOff size={14} />Skip</button
        >
        <a class="btn sm" class:disabled={!selected.length} aria-disabled={!selected.length} href={selected.length ? `/api/labels.zip?codes=${codes}` : undefined} download="labels.zip"
          ><Download size={14} />Download zip</a
        >
        <a class="btn sm" class:primary={selected.length > 0} class:disabled={!selected.length} aria-disabled={!selected.length} href={selected.length ? `/print/sheet?codes=${codes}&next=/print` : undefined}
          ><Printer size={14} />Print {selected.length || ''} label{selected.length === 1 ? '' : 's'}</a
        >
      </div>
    {/if}
  </header>

  {#if data.queue.length}
    <ul class="panel list">
      {#each data.queue as q (q.code)}
        <li class:sel={selected.includes(q.code)}>
          <label class="check">
            <input type="checkbox" value={q.code} bind:group={selected} aria-label="Select {q.name}" />
          </label>
          <div class="main">
            <div class="top">
              <TypeTile type={typeById.get(q.type)} size={28} />
              <a class="nm" href="/p/{q.code}">{q.name}</a>
              <span class="mono code">{pad4(q.code)}</span>
              <span class="status" class:new={q.status === 'new'}><i></i>{q.status === 'new' ? 'New' : 'Changed'}</span>
            </div>
            {#if q.path}<div class="path">{q.path}</div>{/if}
            {#if q.status === 'changed'}
              <ul class="changes mono">
                {#each q.removed as l}<li class="rm"><span aria-hidden="true">−</span><s>{l}</s><span class="sr-only"> removed</span></li>{/each}
                {#each q.added as l}<li class="add"><span aria-hidden="true">+</span>{l}<span class="sr-only"> added</span></li>{/each}
              </ul>
            {:else}
              <p class="path">Never printed</p>
            {/if}
          </div>
          <a class="thumb" href="/p/{q.code}" tabindex="-1" aria-hidden="true"><img src="/api/label/{q.code}.svg?v={q.v}" alt="" loading="lazy" /></a>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <p class="title">All labels are up to date</p>
      <p>Labeled places show up here when they have never been printed or their contents change.</p>
    </div>
  {/if}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
  h1 { font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; }
  .sub { font-size: var(--fs-md); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn.disabled, .btn:disabled { opacity: .45; pointer-events: none; }
  .list { overflow: hidden; }
  .list > li { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); align-items: flex-start; }
  .list > li:last-child { border-bottom: 0; }
  .list > li.sel { background: var(--surface-2); }
  .check { width: 44px; height: 44px; margin: -8px -8px -8px -8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .check input { width: 16px; height: 16px; accent-color: var(--accent); }
  .main { flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .nm { font-weight: 500; color: var(--text); }
  .code { font-size: var(--fs-sm); color: var(--text-3); }
  .status { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); color: var(--warn); }
  .status i { width: 6px; height: 6px; border-radius: 999px; background: var(--warn); }
  .status.new { color: var(--accent-text); }
  .status.new i { background: var(--accent); }
  .path { font-size: var(--fs-sm); color: var(--text-3); }
  .changes { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-sm); }
  .changes li { display: flex; gap: 8px; padding: 1px 8px; border-radius: var(--r-sm); overflow-wrap: anywhere; }
  .changes .add { background: var(--add-bg); color: var(--add); }
  .changes .rm { background: var(--remove-bg); color: var(--remove); }
  .thumb { width: 112px; flex-shrink: 0; border: 1px solid var(--border-strong); border-radius: var(--r-md); overflow: hidden; background: #fff; display: none; }
  .thumb img { display: block; width: 100%; }
  @media (min-width: 640px) { .thumb { display: block; } }
</style>
