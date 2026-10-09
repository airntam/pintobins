<script lang="ts">
  import { goto, invalidate, invalidateAll } from '$app/navigation';
  import Printer from 'lucide-svelte/icons/printer';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Camera from 'lucide-svelte/icons/camera';
  import CircleAlert from 'lucide-svelte/icons/circle-alert';
  import Plus from 'lucide-svelte/icons/plus';
  import Download from 'lucide-svelte/icons/download';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Path from '$lib/components/Path.svelte';
  import TypeIcon from '$lib/components/TypeIcon.svelte';
  import PlaceCard from '$lib/components/PlaceCard.svelte';
  import ItemList from '$lib/components/ItemList.svelte';
  import PlacePicker from '$lib/components/PlacePicker.svelte';
  import Photo from '$lib/components/Photo.svelte';
  import { pad4, type ClientItem } from '$lib/types';
  import { toast } from '$lib/toast.svelte';

  let { data } = $props();
  const place = $derived(data.place);
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));

  let name = $state('');
  let notes = $state('');
  let picker = $state<'move-place' | 'move-item' | null>(null);
  let movingItem = $state<ClientItem | null>(null);
  let itemsKey = $state(0);
  let photoInput: HTMLInputElement | undefined = $state();
  let confirmDelete = $state(false);

  // Reset local edit buffers when navigating to a different place.
  $effect(() => {
    name = place.name;
    notes = place.notes;
    confirmDelete = false;
  });

  async function api(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? 'Something went wrong');
    return out;
  }
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong', { error: true });
  const refresh = () => Promise.all([invalidate('app:place'), invalidate('app:layout')]);

  async function savePlace(change: Record<string, unknown>, before: Record<string, unknown>, message: string) {
    try {
      await api('PATCH', `/api/places/${place.id}`, change);
      await refresh();
      toast(message, {
        undo: async () => {
          try {
            await api('PATCH', `/api/places/${place.id}`, before);
            await invalidateAll();
          } catch (e) {
            fail(e);
          }
        }
      });
    } catch (e) {
      fail(e);
      name = place.name;
      notes = place.notes;
    }
  }

  function saveName() {
    const n = name.trim();
    if (!n) return (name = place.name);
    if (n !== place.name) savePlace({ name: n }, { name: place.name }, 'Name saved');
  }
  function saveNotes() {
    if (notes.trim() !== place.notes) savePlace({ notes: notes.trim() }, { notes: place.notes }, 'Notes saved');
  }

  async function movePlace(row: { id: string; name: string } | null) {
    const before = { parent: place.parent };
    await savePlace({ parent: row?.id ?? '' }, before, row ? `Moved to ${row.name}` : 'Moved to top level');
    await invalidateAll();
  }

  async function moveItem(row: { id: string; name: string } | null) {
    const item = movingItem;
    if (!row || !item) return;
    try {
      await api('PATCH', `/api/items/${item.id}`, { place: row.id });
      itemsKey++;
      await invalidateAll();
      toast(`Moved “${item.name}” to ${row.name}`, {
        undo: async () => {
          try {
            await api('PATCH', `/api/items/${item.id}`, { place: place.id });
            itemsKey++;
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

  async function toggleLabeled() {
    await savePlace({ labeled: !place.labeled }, { labeled: place.labeled }, place.labeled ? 'Label turned off' : 'Label turned on');
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append('photo', file);
    try {
      const res = await fetch(`/api/places/${place.id}/photo`, { method: 'POST', body });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      await refresh();
      toast('Photo saved');
    } catch (e) {
      fail(e);
    }
  }

  async function removePhoto() {
    try {
      await api('DELETE', `/api/places/${place.id}/photo`);
      await refresh();
      toast('Photo removed');
    } catch (e) {
      fail(e);
    }
  }

  async function deletePlace() {
    try {
      await api('DELETE', `/api/places/${place.id}`);
      await invalidate('app:layout');
      goto(place.parent ? `/p/${data.steps.at(-1)?.code}` : '/', { invalidateAll: true });
      toast(`Deleted “${place.name}”`);
    } catch (e) {
      fail(e);
      confirmDelete = false;
    }
  }

  const stale = $derived(place.labeled && data.label.status !== 'ok');
</script>

<svelte:head><title>{place.name} · Bins</title></svelte:head>

<div class="page">
  {#if data.steps.length}
    <Path steps={data.steps} />
  {/if}

  <section class="head">
    {#if place.photo}
      <div class="photo">
        <Photo collection="places" id={place.id} file={place.photo} thumb="400x300" alt={place.name} />
      </div>
    {/if}
    <div class="titles">
      <div class="meta">
        <span class="type"><TypeIcon type={data.type} size={13} /><span style:color={data.type?.color}>{data.type?.name}</span></span>
        <span class="mono code">{pad4(place.code)}</span>
      </div>
      <label class="sr-only" for="place-name">Name</label>
      <input
        id="place-name"
        class="title"
        bind:value={name}
        onblur={saveName}
        onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        autocomplete="off"
      />
    </div>

    {#if stale}
      <div class="banner" role="status">
        <CircleAlert size={14} />
        <span class="grow"
          >{data.label.status === 'new' ? 'Label not printed yet' : `Label out of date · ${data.label.changes} change${data.label.changes === 1 ? '' : 's'}`}</span
        >
        <a href="/print">Review →</a>
      </div>
    {/if}

    <div class="actions">
      {#if place.labeled}
        <a class="btn primary grow" href="/print/sheet?codes={place.code}"><Printer size={16} />Print label</a>
      {:else}
        <button type="button" class="btn primary grow" onclick={toggleLabeled}><Printer size={16} />Turn on label</button>
      {/if}
      <button type="button" class="btn" title="Move this place and everything inside it" onclick={() => (picker = 'move-place')}
        ><ArrowRight size={16} />Move</button
      >
      <button type="button" class="btn icon" aria-label={place.photo ? 'Change photo' : 'Add photo'} title="Add photo" onclick={() => photoInput?.click()}
        ><Camera size={16} /></button
      >
      <input
        bind:this={photoInput}
        type="file"
        accept="image/*"
        class="sr-only"
        tabindex="-1"
        onchange={(e) => {
          uploadPhoto(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
    </div>
  </section>

  <section class="sec">
    <div class="sechead">
      <h2 class="section-label">Inside</h2>
      <a class="addlink" href="/new?parent={place.code}"><Plus size={14} />Add place inside</a>
    </div>
    {#if data.children.length}
      <ul class="list">
        {#each data.children as { place: c, meta } (c.id)}
          <li><PlaceCard place={c} type={typeById.get(c.type)} {meta} /></li>
        {/each}
      </ul>
    {:else}
      <p class="hint">No places inside yet.</p>
    {/if}
  </section>

  {#key `${place.id}:${itemsKey}`}
    <ItemList
      placeId={place.id}
      initial={data.items}
      onchange={refresh}
      onmove={(item) => {
        movingItem = item;
        picker = 'move-item';
      }}
    />
  {/key}

  <section class="sec">
    <h2 class="section-label"><label for="notes">Notes</label></h2>
    <textarea id="notes" class="field" rows="2" placeholder="Add notes" bind:value={notes} onblur={saveNotes}></textarea>
  </section>

  {#if place.labeled}
    <section class="sec">
      <h2 class="section-label">Label</h2>
      <div class="preview panel">
        <img src="/api/label/{place.code}.svg?v={data.label.version}" alt="Label for {pad4(place.code)}" width="640" height="560" />
      </div>
      <div class="dl">
        <a class="btn sm" href="/api/label/{place.code}.svg?v={data.label.version}" download="label-{pad4(place.code)}.svg"><Download size={14} />Download SVG</a>
        <a class="btn sm" href="/api/label/{place.code}.png" download="label-{pad4(place.code)}.png"><Download size={14} />Download PNG</a>
      </div>
    </section>
  {/if}

  <section class="sec settings">
    <h2 class="section-label">Settings</h2>
    <div class="panel rows">
      <div class="r">
        <span class="lbl">Labeled</span>
        <span class="grow muted">{place.labeled ? 'Shows in the print queue' : 'No printed label'}</span>
        <button type="button" class="switch" role="switch" aria-checked={place.labeled} aria-label="Labeled" class:on={place.labeled} onclick={toggleLabeled}
          ><span></span></button
        >
      </div>
      <div class="r">
        <span class="lbl">Delete</span>
        {#if confirmDelete}
          <span class="grow muted">Delete this place and its items?</span>
          <button type="button" class="btn sm danger" onclick={deletePlace}><Trash2 size={14} />Delete</button>
          <button type="button" class="btn sm" onclick={() => (confirmDelete = false)}>Keep</button>
        {:else}
          <span class="grow muted">{data.children.length ? 'Move the places inside first' : 'Removes the place and its items'}</span>
          <button type="button" class="btn sm danger" disabled={data.children.length > 0} onclick={() => (confirmDelete = true)}><Trash2 size={14} />Delete</button>
        {/if}
      </div>
      {#if place.photo}
        <div class="r">
          <span class="lbl">Photo</span>
          <span class="grow"></span>
          <button type="button" class="btn sm" onclick={removePhoto}>Remove photo</button>
        </div>
      {/if}
    </div>
  </section>
</div>

{#if picker === 'move-place'}
  <PlacePicker
    title="Move {place.name} to…"
    types={data.types}
    exclude={place.id}
    allowNone
    onpick={movePlace}
    onclose={() => (picker = null)}
  />
{:else if picker === 'move-item'}
  <PlacePicker title="Move item to…" types={data.types} onpick={moveItem} onclose={() => (picker = null)} />
{/if}

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 22px; }
  .head { display: flex; flex-direction: column; gap: 14px; }
  .photo { height: 148px; border-radius: var(--r-xl); overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
  .titles { display: flex; flex-direction: column; gap: 2px; }
  .meta { display: flex; align-items: center; gap: 8px; font-size: var(--fs-sm); color: var(--text-3); }
  .type { display: inline-flex; align-items: center; gap: 5px; }
  .title {
    width: 100%; min-height: 44px; padding: 0 6px; margin-left: -6px; border: 1px solid transparent; border-radius: var(--r-md);
    background: transparent; font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; line-height: 1.2; color: var(--text);
  }
  .title:hover { border-color: var(--border); }
  .banner {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-lg); border: 1px solid var(--warn-border);
    background: var(--warn-bg); font-size: var(--fs-md); color: var(--warn);
  }
  .banner a { color: var(--warn); font-weight: 500; min-height: 24px; }
  .grow { flex-grow: 1; }
  .actions { display: flex; gap: 8px; }
  @media (min-width: 900px) { .actions { max-width: 420px; } }
  .sec { display: flex; flex-direction: column; gap: 8px; }
  .sechead { display: flex; align-items: center; justify-content: space-between; }
  .addlink { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-sm); min-height: 24px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .hint { font-size: var(--fs-sm); color: var(--text-3); }
  .preview { padding: 12px; background: #fff; border-radius: var(--r-lg); }
  .preview img { display: block; width: 100%; height: auto; }
  .dl { display: flex; gap: 8px; flex-wrap: wrap; }
  .rows { overflow: hidden; }
  .r { display: flex; align-items: center; gap: 12px; padding: 8px 12px; min-height: 52px; border-bottom: 1px solid var(--border); font-size: var(--fs-md); }
  .r:last-child { border-bottom: 0; }
  .lbl { width: 64px; flex-shrink: 0; font-size: var(--fs-sm); color: var(--text-3); }
  .switch { width: 44px; height: 26px; padding: 3px; border: 0; border-radius: 999px; background: #2a2a2f; display: flex; justify-content: flex-start; }
  .switch span { width: 20px; height: 20px; border-radius: 999px; background: #fff; display: block; }
  .switch.on { background: var(--accent); justify-content: flex-end; }
</style>
