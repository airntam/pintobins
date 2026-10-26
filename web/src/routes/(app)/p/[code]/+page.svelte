<script lang="ts">
  import { untrack } from 'svelte';
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
  import TypeTile from '$lib/components/TypeTile.svelte';
  import PlaceCard from '$lib/components/PlaceCard.svelte';
  import ItemList from '$lib/components/ItemList.svelte';
  import PlacePicker from '$lib/components/PlacePicker.svelte';
  import Photo from '$lib/components/Photo.svelte';
  import { pad4, type ClientItem } from '$lib/types';
  import { toast } from '$lib/toast.svelte';

  let { data } = $props();
  const place = $derived(data.place);
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));
  const typeName = $derived((data.type?.name ?? 'place').toLowerCase());
  const parent = $derived(data.steps.at(-1));

  // Seeded from the server data so the name renders before hydration; the effect resets them on navigation.
  let name = $state(untrack(() => data.place.name));
  let notes = $state(untrack(() => data.place.notes));
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
  const changes = $derived(`${data.label.changes} change${data.label.changes === 1 ? '' : 's'}`);
  const status = $derived(data.label.status === 'new' ? 'Not printed yet' : data.label.status === 'changed' ? `Out of date · ${changes}` : 'Up to date');
  const updated = $derived.by(() => {
    const d = new Date(place.updated);
    if (isNaN(+d)) return '';
    const days = Math.floor((Date.now() - +d) / 86_400_000);
    if (days < 1 && new Date().getDate() === d.getDate()) return 'Today';
    if (days < 2) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });
</script>

<svelte:head><title>{place.name} · Bins</title></svelte:head>

{#snippet photoButton(cls: string, big: boolean)}
  <button type="button" class="addphoto {cls}" onclick={() => photoInput?.click()}>
    <Camera size={big ? 22 : 18} />
    {#if big}Add a photo of this {typeName}<span class="sub">Helps you spot it on the shelf</span>{:else}Photo{/if}
  </button>
{/snippet}

<div class="page">
  {#if data.steps.length}
    <Path steps={data.steps} />
  {/if}

  <div class="cols">
    <div class="maincol">
      <header class="head">
        <div class="idrow">
          {#if place.photo}
            <button type="button" class="photo-ph" aria-label="Change photo" onclick={() => photoInput?.click()}>
              <Photo collection="places" id={place.id} file={place.photo} thumb="200x200" alt={place.name} />
            </button>
          {:else}
            {@render photoButton('photo-ph', false)}
          {/if}
          <span class="tile-dt"><TypeTile type={data.type} size={56} /></span>
          <div class="ident">
            <span class="type" style:color={data.type?.color}><TypeIcon type={data.type} size={13} />{data.type?.name}</span>
            <span class="mono bigcode">{pad4(place.code)}</span>
          </div>
          <button type="button" class="btn sm move" title="Move this place and everything inside it" onclick={() => (picker = 'move-place')}
            ><ArrowRight size={14} />Move</button
          >
        </div>
        <label class="sr-only" for="place-name">Name</label>
        <!-- A one-row textarea so long names wrap instead of being cut off; Enter still saves -->
        <textarea
          id="place-name"
          class="title"
          rows="1"
          bind:value={name}
          onblur={saveName}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          autocomplete="off"
        ></textarea>
        {#if stale}
          <div class="banner" role="status">
            <CircleAlert size={14} />
            <span class="grow">{data.label.status === 'new' ? 'Label not printed yet' : `Label out of date · ${changes}`}</span>
            {#if data.label.status === 'changed'}<a class="dt" href="#label">See what changed</a>{/if}
            <a href="/print/sheet?codes={place.code}">{data.label.status === 'new' ? 'Print' : 'Reprint'}</a>
          </div>
        {/if}
      </header>

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

      {#if data.children.length}
        <section class="sec">
          <div class="sechead">
            <h2 class="section-label">Inside</h2>
            <a class="addlink" href="/new?parent={place.code}"><Plus size={14} />Add a place inside</a>
          </div>
          <ul class="list">
            {#each data.children as { place: c, meta } (c.id)}
              <li><PlaceCard place={c} type={typeById.get(c.type)} {meta} /></li>
            {/each}
          </ul>
        </section>
      {:else}
        <section class="inside-empty">
          <h2 class="section-label">Inside</h2>
          <span class="muted grow">No places inside this {typeName}.</span>
          <a class="addlink" href="/new?parent={place.code}">Add a place inside</a>
        </section>
      {/if}

      <section class="sec">
        <h2 class="section-label"><label for="notes">Notes</label></h2>
        <textarea id="notes" class="field" rows="2" placeholder="Add notes" bind:value={notes} onblur={saveNotes}></textarea>
      </section>
    </div>

    <aside class="rail" aria-label="Details">
      {#if place.photo}
        <button type="button" class="photo-dt" aria-label="Change photo" onclick={() => photoInput?.click()}>
          <Photo collection="places" id={place.id} file={place.photo} thumb="400x300" alt={place.name} />
        </button>
      {:else}
        {@render photoButton('photo-dt', true)}
      {/if}
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

      <section id="label" class="panel card-sec" aria-labelledby="label-h">
        <div class="lhead">
          <h2 id="label-h" class="cardtitle">Label</h2>
          {#if place.labeled}
            <span class="lstatus" class:warn={stale}><span class="dot"></span>{status}</span>
          {:else}
            <span class="lstatus">Off</span>
          {/if}
        </div>
        {#if place.labeled}
          {#if data.label.added.length || data.label.removed.length}
            <ul class="diff mono" aria-label="Changes since the last print">
              {#each data.label.added as l}<li class="add">+ {l}</li>{/each}
              {#each data.label.removed as l}<li class="rem"><s>− {l}</s></li>{/each}
            </ul>
          {/if}
          <a class="preview" href="/api/label/{place.code}.svg?v={data.label.version}" target="_blank" rel="noopener" aria-label="Open the full-size label">
            <img src="/api/label/{place.code}.svg?v={data.label.version}" alt="Label for {pad4(place.code)}" width="559" height="640" />
          </a>
          <div class="lacts">
            <a class="btn sm print grow" href="/print/sheet?codes={place.code}"><Printer size={14} />{data.label.status === 'ok' ? 'Print label' : data.label.status === 'new' ? 'Print label' : 'Reprint label'}</a>
            <a class="btn sm icon" href="/api/label/{place.code}.svg?v={data.label.version}" download="label-{pad4(place.code)}.svg" aria-label="Download SVG" title="Download SVG"><Download size={14} /></a>
            <a class="btn sm" href="/api/label/{place.code}.png" download="label-{pad4(place.code)}.png" title="Download PNG">PNG</a>
          </div>
        {:else}
          <p class="muted small">This {typeName} doesn't get a printed label.</p>
          <button type="button" class="btn sm" onclick={toggleLabeled}><Printer size={14} />Turn on label</button>
        {/if}
      </section>

      <section class="panel card-sec" aria-label="About this place">
        <dl>
          <dt>Type</dt>
          <dd><TypeIcon type={data.type} size={13} />{data.type?.name}</dd>
          <dt>Code</dt>
          <dd class="mono">{pad4(place.code)}</dd>
          <dt>Inside</dt>
          <dd>{#if parent}<a href="/p/{parent.code}">{parent.name}</a>{:else}<span class="muted">Top level</span>{/if}</dd>
          <dt>Labeled</dt>
          <dd class="sw">
            <span class="grow muted small">{place.labeled === !!data.type?.labeled_default ? 'Type default' : 'Changed from the type default'}</span>
            <button type="button" class="switch" role="switch" aria-checked={place.labeled} aria-label="Labeled" class:on={place.labeled} onclick={toggleLabeled}
              ><span></span></button
            >
          </dd>
          {#if updated}
            <dt>Updated</dt>
            <dd class="muted">{updated}</dd>
          {/if}
        </dl>
        <div class="danger-zone">
          {#if place.photo}
            <button type="button" class="btn sm" onclick={removePhoto}>Remove photo</button>
          {/if}
          {#if confirmDelete}
            <span class="grow muted small">Delete this place and its items?</span>
            <button type="button" class="btn sm danger" onclick={deletePlace}><Trash2 size={14} />Delete</button>
            <button type="button" class="btn sm" onclick={() => (confirmDelete = false)}>Keep</button>
          {:else}
            <span class="grow muted small">{data.children.length ? 'Move the places inside before deleting' : ''}</span>
            <button type="button" class="btn sm danger" disabled={data.children.length > 0} onclick={() => (confirmDelete = true)}><Trash2 size={14} />Delete {typeName}</button>
          {/if}
        </div>
      </section>
    </aside>
  </div>
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
  /* bottom room for the docked "Add item" field on phone */
  .page { padding: 16px 16px 84px; display: flex; flex-direction: column; gap: 16px; }
  .cols { display: flex; flex-direction: column; gap: 22px; }
  .maincol { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
  .rail { display: flex; flex-direction: column; gap: 16px; }
  .head { display: flex; flex-direction: column; gap: 12px; }
  .idrow { display: flex; align-items: center; gap: 14px; }
  .photo-ph { width: 84px; height: 84px; flex-shrink: 0; border-radius: 12px; overflow: hidden; padding: 0; border: 1px solid var(--border); background: var(--surface-2); }
  .addphoto { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1px dashed var(--chip-border); background: var(--bg-sunken); color: var(--text-3); font-size: var(--fs-xs); }
  .addphoto:hover { color: var(--text-2); border-color: var(--sep); }
  .addphoto.photo-ph { border-style: dashed; }
  .sub { font-size: var(--fs-sm); color: var(--text-3); }
  .tile-dt, .photo-dt { display: none; }
  .ident { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .type { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-md); }
  .bigcode { font-size: 30px; font-weight: 600; line-height: 1; color: var(--text); }
  .move { margin-left: auto; align-self: flex-start; }
  .title {
    width: 100%; min-height: 44px; padding: 6px; margin-left: -6px; border: 1px solid transparent; border-radius: var(--r-md);
    resize: none; field-sizing: content; overflow: hidden;
    background: transparent; font-size: var(--fs-xl); font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; color: var(--text);
  }
  .title:hover { border-color: var(--border); }
  .banner {
    display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 8px 12px; border-radius: var(--r-lg); border: 1px solid var(--warn-border);
    background: var(--warn-bg); font-size: var(--fs-md); color: var(--warn);
  }
  .banner a { color: var(--warn); font-weight: 500; min-height: 24px; display: inline-flex; align-items: center; }
  .banner a.dt { display: none; color: var(--text-2); font-weight: 400; }
  .grow { flex-grow: 1; }
  .small { font-size: var(--fs-sm); }
  .sec { display: flex; flex-direction: column; gap: 8px; }
  .sechead { display: flex; align-items: center; justify-content: space-between; }
  .addlink { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-sm); min-height: 24px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .inside-empty { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border: 1px dashed var(--border-strong); border-radius: var(--r-lg); font-size: var(--fs-sm); }

  .card-sec { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .lhead { display: flex; align-items: center; gap: 8px; }
  .cardtitle { font-size: var(--fs-md); font-weight: 500; }
  .lstatus { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); color: var(--text-3); }
  .lstatus .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--add); }
  .lstatus.warn { color: var(--warn); }
  .lstatus.warn .dot { background: var(--warn); }
  .diff { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-sm); }
  .diff li { padding: 2px 6px; border-radius: 4px; overflow-wrap: anywhere; }
  .diff .add { background: var(--add-bg); color: var(--add); }
  .diff .rem { background: var(--remove-bg); color: var(--remove); }
  .preview { display: block; padding: 10px; background: #fff; border-radius: var(--r-md); }
  .preview img { display: block; width: 100%; height: auto; max-width: 320px; margin: 0 auto; }
  .lacts { display: flex; gap: 8px; }
  .print { border-color: var(--accent-border); background: var(--accent-soft); color: var(--text); }
  .print:hover { background: #2B2F5A; color: var(--text); }

  dl { margin: 0; display: grid; grid-template-columns: 80px 1fr; row-gap: 10px; align-items: center; font-size: var(--fs-md); }
  dt { color: var(--text-3); font-size: var(--fs-sm); }
  dd { margin: 0; display: flex; align-items: center; gap: 6px; min-width: 0; }
  .sw { gap: 10px; }
  .switch { width: 44px; height: 26px; flex-shrink: 0; padding: 3px; border: 0; border-radius: 999px; background: #2a2a2f; display: flex; justify-content: flex-start; }
  .switch span { width: 20px; height: 20px; border-radius: 999px; background: #fff; display: block; }
  .switch.on { background: var(--accent); justify-content: flex-end; }
  .danger-zone { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); }

  @media (min-width: 900px) {
    .page { padding: 12px 0 24px; gap: 20px; }
    .photo-ph, .addphoto.photo-ph { display: none; }
    .tile-dt { display: flex; }
    .move { align-self: center; }
    .title { font-size: var(--fs-2xl); }
    .banner { align-self: flex-start; min-height: 36px; padding: 6px 12px; }
    .banner a.dt { display: inline-flex; }
    .photo-dt { display: flex; height: 168px; border-radius: var(--r-xl); overflow: hidden; padding: 0; border: 1px solid var(--border); background: var(--surface-2); font-size: var(--fs-md); }
    .addphoto.photo-dt { gap: 8px; }
  }
  @media (min-width: 1180px) {
    .cols { flex-direction: row; align-items: flex-start; gap: 32px; }
    .maincol { flex: 1; }
    .rail { flex: 0 0 320px; position: sticky; top: 16px; }
  }
</style>
