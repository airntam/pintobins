<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Printer from 'lucide-svelte/icons/printer';
  import Check from 'lucide-svelte/icons/check';
  import { pad4 } from '$lib/types';

  let { data } = $props();
  let printed = $state(false);
  let marking = $state(false);
  let error = $state('');

  const codes = $derived(data.labels.map((l) => l.code));
  const back = $derived(data.next ?? (data.labels.length === 1 ? `/p/${data.labels[0].code}` : '/print'));

  async function waitForImages() {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('.label img')];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = i.onerror = r), 0)))));
  }

  async function print() {
    await waitForImages();
    window.print();
  }

  async function markPrinted() {
    marking = true;
    error = '';
    try {
      const res = await fetch('/api/printed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codes })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not mark as printed');
      await goto(back, { invalidateAll: true });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not mark as printed';
      marking = false;
    }
  }

  // The dialog opens by itself, as soon as the label images are ready.
  onMount(() => {
    print();
  });
</script>

<svelte:head>
  <title>Print {data.labels.length} label{data.labels.length === 1 ? '' : 's'} · Bins</title>
  {@html '<style>@page { size: 80mm 70mm; margin: 0 }</style>'}
</svelte:head>

<svelte:window onafterprint={() => (printed = true)} />

<div class="toolbar">
  <div class="info">
    <strong>{data.labels.length} label{data.labels.length === 1 ? '' : 's'}</strong>
    <span class="muted">80 × 70 mm · {data.labels.map((l) => pad4(l.code)).join(' ')}</span>
  </div>
  {#if error}<span class="err" role="alert">{error}</span>{/if}
  <a class="btn" href={back}>Back</a>
  <button type="button" class="btn" class:primary={!printed} onclick={print}><Printer size={16} />Print again</button>
  <button type="button" class="btn" class:primary={printed} disabled={marking} onclick={markPrinted}
    ><Check size={16} />{marking ? 'Saving…' : 'Mark as printed'}</button
  >
</div>

{#if printed}
  <p class="tip">Once the labels came out right, choose “Mark as printed” so they leave the print queue.</p>
{/if}

<div class="sheet">
  {#each data.labels as l (l.code)}
    <div class="label">
      <img src="/api/label/{l.code}.svg?v={l.v}" alt="Label {pad4(l.code)} {l.name}" />
    </div>
  {/each}
</div>

<style>
  .toolbar {
    position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 16px;
    background: var(--bg); border-bottom: 1px solid var(--border);
  }
  .info { display: flex; flex-direction: column; margin-right: auto; font-size: var(--fs-md); }
  .err { color: var(--remove); font-size: var(--fs-md); }
  .tip { padding: 12px 16px 0; font-size: var(--fs-md); color: var(--text-2); }
  .sheet { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; justify-content: center; }
  .label { width: 80mm; height: 70mm; background: #fff; flex-shrink: 0; }
  .label img { display: block; width: 80mm; height: 70mm; }

  @media print {
    :global(body) { background: #fff !important; }
    .toolbar, .tip { display: none !important; }
    .sheet { display: block; padding: 0; gap: 0; }
    .label { break-after: page; page-break-after: always; }
    .label:last-child { break-after: auto; page-break-after: auto; }
  }
</style>
