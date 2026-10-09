<script lang="ts">
  import { enhance } from '$app/forms';
  import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down';
  import Camera from 'lucide-svelte/icons/camera';
  import PlacePicker from '$lib/components/PlacePicker.svelte';
  import Chips from '$lib/components/Chips.svelte';
  import { iconFor } from '$lib/icons';
  import { parseQuickEntry, splitDetails } from '$lib/search';
  import { pad4 } from '$lib/types';

  let { data, form } = $props();

  let typeId = $state(form?.type || data.defaultType);
  let name = $state(form?.name ?? '');
  let itemsText = $state(form?.itemsText ?? '');
  let parent = $state<{ id: string; name: string; path: string } | null>(data.parent ?? null);
  let labeledOverride = $state<boolean | null>(null);
  let print = $state(true);
  let another = $state(false);
  let picking = $state(false);
  let busy = $state(false);
  let photoName = $state('');
  let photoInput: HTMLInputElement | undefined = $state();

  const type = $derived(data.types.find((t) => t.id === typeId));
  const labeled = $derived(labeledOverride ?? type?.labeled_default ?? false);
  const preview = $derived(parseQuickEntry(itemsText));
  const items = $derived(parseQuickEntry(itemsText).length);
  const button = $derived(labeled && print ? 'Create and print label' : `Create ${type?.name.toLowerCase() ?? 'place'}`);

  // Re-sync when arriving via "Create another" with a new ?parent=
  $effect(() => {
    parent = data.parent ?? null;
  });
</script>

<svelte:head><title>New place · Bins</title></svelte:head>

<form
  method="post"
  enctype="multipart/form-data"
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update({ reset: false });
      busy = false;
    };
  }}
>
  <header>
    <a class="cancel" href="/" onclick={(e) => { e.preventDefault(); history.back(); }}>Cancel</a>
    <h1>New place</h1>
    <span class="spacer"></span>
  </header>

  <div class="body">
    <fieldset>
      <legend class="section-label">Type</legend>
      <div class="types">
        {#each data.types as t (t.id)}
          {@const Icon = iconFor(t.icon)}
          <button type="button" class="typebtn" class:on={typeId === t.id} aria-pressed={typeId === t.id} onclick={() => ((typeId = t.id), (labeledOverride = null))}>
            <Icon size={15} color={t.color} strokeWidth={1.6} />{t.name}
          </button>
        {/each}
        <a class="typebtn add" href="/types">+ Type</a>
      </div>
      <input type="hidden" name="type" value={typeId} />
    </fieldset>

    <div class="namefield">
      <label for="name" class="section-label">Name</label>
      <input id="name" name="name" bind:value={name} placeholder="e.g. Assorted metric screws" autocomplete="off" required />
    </div>

    <div class="panel rows">
      <button type="button" class="r pick" onclick={() => (picking = true)}>
        <span class="lbl">Inside</span>
        <span class="grow val">
          <span class="v1">{parent?.name ?? 'Top level'}</span>
          {#if parent?.path}<span class="v2">{parent.path}</span>{/if}
        </span>
        <ChevronsUpDown size={14} />
      </button>
      <input type="hidden" name="parent" value={parent?.id ?? ''} />
      <div class="r">
        <span class="lbl">Code</span>
        <span class="grow mono">{pad4(data.nextCode)}</span>
        <span class="hint">assigned on create</span>
      </div>
      <div class="r">
        <span class="lbl">Label</span>
        <span class="grow val">
          <span class="v1">{labeled ? 'Labeled' : 'No label'}</span>
          <span class="v2">{labeledOverride === null ? `Default for ${type?.name.toLowerCase() ?? 'this type'}s` : `Changed from the ${type?.name.toLowerCase()} type default`}</span>
        </span>
        <button type="button" class="switch" class:on={labeled} role="switch" aria-checked={labeled} aria-label="Labeled" onclick={() => (labeledOverride = !labeled)}><span></span></button>
        <input type="hidden" name="labeled" value={labeled ? '1' : '0'} />
      </div>
      <div class="r last">
        <span class="lbl">Photo</span>
        <button type="button" class="btn sm" onclick={() => photoInput?.click()}><Camera size={14} />{photoName || 'Take or choose'}</button>
        <input bind:this={photoInput} type="file" name="photo" accept="image/*" class="sr-only" tabindex="-1" onchange={(e) => (photoName = e.currentTarget.files?.[0]?.name.slice(0, 22) ?? '')} />
      </div>
    </div>

    <div class="itemsfield">
      <label for="items" class="section-label">Items <span class="opt">· optional</span></label>
      <textarea id="items" name="items" rows="5" bind:value={itemsText} placeholder={'Misc metric screws: M8×5, M8×10\nWashers: M8, M6\nNuts'}></textarea>
      <p class="hint">One item per line. Add details after a colon, separated by commas.</p>
    </div>

    {#if preview.length}
      <div class="previewbox">
        <span class="section-label">Preview</span>
        <ul class="panel prev">
          {#each preview as it}
            <li><span class="nm">{it.name}</span><Chips chips={splitDetails(it.details)} /></li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  </div>

  <footer>
    <div class="checks">
      {#if labeled}
        <label><input type="checkbox" name="print" bind:checked={print} />Print label</label>
      {/if}
      <label><input type="checkbox" name="another" bind:checked={another} />Create another</label>
    </div>
    <button class="btn primary" disabled={busy || !name.trim()}>{busy ? 'Creating…' : button}</button>
  </footer>
</form>

{#if picking}
  <PlacePicker
    title="Put it inside…"
    types={data.types}
    allowNone
    onpick={(r) => (parent = r ? { id: r.id, name: r.name, path: [r.path, r.name].filter(Boolean).join(' / ') } : null)}
    onclose={() => (picking = false)}
  />
{/if}

<style>
  form { display: flex; flex-direction: column; min-height: calc(100dvh - 68px); }
  header { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
  .cancel { min-width: 64px; height: 44px; display: flex; align-items: center; color: var(--text-3); }
  h1 { flex-grow: 1; text-align: center; font-size: var(--fs-base); font-weight: 500; }
  .spacer { min-width: 64px; }
  .body { flex-grow: 1; padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 20px; }
  fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  legend { padding: 0; margin-bottom: 8px; }
  .types { display: flex; flex-wrap: wrap; gap: 6px; }
  .typebtn {
    height: 36px; padding: 0 12px; border-radius: var(--r-md); border: 1px solid var(--border-strong); background: var(--surface-2);
    color: var(--text-2); font-size: var(--fs-md); display: inline-flex; align-items: center; gap: 6px;
  }
  .typebtn.on { border-color: var(--accent); background: var(--accent-soft); color: var(--text); font-weight: 500; }
  .typebtn.add { border-style: dashed; background: transparent; color: var(--text-3); }
  .namefield { display: flex; flex-direction: column; gap: 4px; }
  .namefield input { height: 48px; border: 0; border-bottom: 1px solid #2a2a2f; background: transparent; outline: none; font-size: var(--fs-xl); font-weight: 600; letter-spacing: -0.01em; border-radius: 0; }
  .namefield input:focus-visible { box-shadow: none; border-color: var(--accent) !important; }
  .rows { overflow: hidden; }
  .r { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 8px 12px; border-bottom: 1px solid var(--border); width: 100%; background: transparent; border-left: 0; border-right: 0; border-top: 0; text-align: left; color: var(--text); }
  .r.last { border-bottom: 0; }
  .pick:hover { background: var(--surface-hover); }
  .lbl { width: 64px; flex-shrink: 0; font-size: var(--fs-sm); color: var(--text-3); }
  .grow { flex-grow: 1; min-width: 0; }
  .val { display: flex; flex-direction: column; }
  .v1 { font-weight: 500; }
  .v2, .hint { font-size: var(--fs-sm); color: var(--text-3); }
  .switch { width: 44px; height: 26px; padding: 3px; border: 0; border-radius: 999px; background: #2a2a2f; display: flex; justify-content: flex-start; flex-shrink: 0; }
  .switch span { width: 20px; height: 20px; border-radius: 999px; background: #fff; display: block; }
  .switch.on { background: var(--accent); justify-content: flex-end; }
  .itemsfield { display: flex; flex-direction: column; gap: 6px; }
  .opt { font-weight: 400; color: var(--text-3); }
  textarea { padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-lg); background: var(--surface); outline: none; font-family: var(--mono); font-size: var(--fs-md); line-height: 1.7; resize: vertical; width: 100%; }
  .previewbox { display: flex; flex-direction: column; gap: 6px; }
  .prev li { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--border); }
  .prev li:last-child { border-bottom: 0; }
  .nm { font-weight: 500; }
  .error { color: var(--remove); font-size: var(--fs-md); }
  footer {
    display: flex; flex-direction: column; gap: 10px;
    padding: 12px 16px 16px; border-top: 1px solid var(--border); background: var(--bg);
  }
  .checks { display: flex; align-items: center; gap: 16px; font-size: var(--fs-md); color: var(--text-2); }
  .checks label { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  .checks input { width: 16px; height: 16px; accent-color: var(--accent); }
  @media (min-width: 900px) { form { min-height: 100dvh; } .body, footer { max-width: 560px; width: 100%; } header { max-width: 560px; } footer { border-top: 0; } }
</style>
