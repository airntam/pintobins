<script lang="ts">
  import { tick } from 'svelte';
  import Plus from 'lucide-svelte/icons/plus';
  import Pin from 'lucide-svelte/icons/pin';
  import Pencil from 'lucide-svelte/icons/pencil';
  import GripVertical from 'lucide-svelte/icons/grip-vertical';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Camera from 'lucide-svelte/icons/camera';
  import X from 'lucide-svelte/icons/x';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Chips from './Chips.svelte';
  import Photo from './Photo.svelte';
  import ListFilter from 'lucide-svelte/icons/list-filter';
  import { joinDetails, normalize, parseQuickEntry, splitDetails } from '$lib/search';
  import { toast } from '$lib/toast.svelte';
  import type { ClientItem } from '$lib/types';

  let {
    placeId,
    initial,
    onchange,
    onmove
  }: {
    placeId: string;
    initial: ClientItem[];
    onchange: () => void;
    onmove: (item: ClientItem) => void;
  } = $props();

  let items = $state<ClientItem[]>(structuredClone($state.snapshot(initial)));
  let editingId = $state<string | null>(null);
  let draftName = $state('');
  let chips = $state<string[]>([]);
  let chipDraft = $state('');
  let newName = $state('');
  let newInput: HTMLInputElement | undefined = $state();
  let nameInput: HTMLInputElement | undefined = $state();
  let chipInput: HTMLInputElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();

  async function api(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
    return data;
  }

  // ---- drag to reorder (pointer events, so it works with touch and mouse) ----
  let listEl: HTMLUListElement | undefined = $state();
  let dragId = $state<string | null>(null);
  let orderBefore: ClientItem[] = [];

  function moveTo(id: string, to: number) {
    const from = items.findIndex((i) => i.id === id);
    if (from === -1 || from === to) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
  }

  function dragStart(e: PointerEvent, item: ClientItem) {
    if (e.button > 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    editingId = null;
    dragId = item.id;
    orderBefore = items.map((i) => ({ ...i }));
  }

  function dragMove(e: PointerEvent) {
    if (!dragId || !listEl) return;
    const rows = [...listEl.querySelectorAll<HTMLElement>('li[data-id]')];
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    moveTo(dragId, target);
  }

  async function persistOrder(before: ClientItem[]) {
    const changed = items.map((it, i) => ({ it, i })).filter(({ it, i }) => it.sort !== i);
    if (!changed.length) return;
    const prev = new Map(before.map((b) => [b.id, b.sort]));
    try {
      await Promise.all(changed.map(({ it, i }) => ((it.sort = i), api('PATCH', `/api/items/${it.id}`, { sort: i }))));
      onchange();
      toast('Order saved', {
        undo: async () => {
          try {
            const ids = new Map(items.map((x) => [x.id, x]));
            for (const [id, sort] of prev) if (ids.has(id)) ids.get(id)!.sort = sort;
            items.sort((a, b) => a.sort - b.sort);
            await Promise.all(changed.map(({ it }) => api('PATCH', `/api/items/${it.id}`, { sort: prev.get(it.id) ?? 0 })));
            onchange();
          } catch (e) {
            fail(e);
          }
        }
      });
    } catch (e) {
      items = before;
      fail(e);
    }
  }

  async function dragEnd() {
    if (!dragId) return;
    dragId = null;
    await persistOrder(orderBefore);
  }

  async function nudge(e: KeyboardEvent, item: ClientItem) {
    const dir = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const from = items.findIndex((i) => i.id === item.id);
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    const before = items.map((i) => ({ ...i }));
    moveTo(item.id, to);
    await persistOrder(before);
    (e.target as HTMLElement | null)?.focus();
  }

  // ---- swipe a row left on touch screens to reveal Pin, Move and Delete ----
  const SWIPE_W = 192; // three 64 px actions
  let swipedId = $state<string | null>(null);
  let swipe = $state<{ id: string; x0: number; y0: number; base: number; dx: number; active: boolean } | null>(null);
  let swallowClick = false;

  function swipeStart(e: PointerEvent, item: ClientItem) {
    if (e.pointerType !== 'touch') return;
    swipe = { id: item.id, x0: e.clientX, y0: e.clientY, base: swipedId === item.id ? -SWIPE_W : 0, dx: 0, active: false };
  }
  function swipeMove(e: PointerEvent) {
    if (!swipe) return;
    const dx = e.clientX - swipe.x0;
    const dy = e.clientY - swipe.y0;
    if (!swipe.active) {
      if (Math.abs(dy) > 10) return (swipe = null); // scrolling, not swiping
      if (Math.abs(dx) < 10) return;
      swipe.active = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {} // the pointer may already be gone
    }
    swipe.dx = Math.min(0, Math.max(-SWIPE_W, swipe.base + dx));
  }
  function swipeEnd() {
    if (!swipe) return;
    if (swipe.active) {
      swipedId = swipe.dx < -SWIPE_W / 2 ? swipe.id : null;
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
    }
    swipe = null;
  }
  function offset(id: string) {
    if (swipe?.active && swipe.id === id) return swipe.dx;
    return swipedId === id ? -SWIPE_W : 0;
  }
  function tapRow(item: ClientItem) {
    if (swallowClick) return;
    if (swipedId) return (swipedId = null); // the first tap closes an open row
    startEdit(item);
  }

  // ---- filter, for long lists ----
  const FILTER_AT = 9;
  let filter = $state('');
  const shown = $derived.by(() => {
    const q = normalize(filter);
    if (!q) return items;
    return items.filter((i) => normalize(`${i.name} ${i.details}`).includes(q));
  });

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong', { error: true });

  async function patch(item: ClientItem, change: Partial<ClientItem>, message: string) {
    const before: Partial<ClientItem> = {};
    for (const k of Object.keys(change) as (keyof ClientItem)[]) (before as any)[k] = item[k];
    Object.assign(item, change);
    try {
      await api('PATCH', `/api/items/${item.id}`, change);
      onchange();
      toast(message, {
        undo: async () => {
          Object.assign(item, before);
          try {
            await api('PATCH', `/api/items/${item.id}`, before);
            onchange();
          } catch (e) {
            fail(e);
          }
        }
      });
    } catch (e) {
      Object.assign(item, before);
      fail(e);
    }
  }

  function startEdit(item: ClientItem) {
    if (editingId === item.id) return;
    editingId = item.id;
    draftName = item.name;
    chips = splitDetails(item.details);
    chipDraft = '';
    tick().then(() => nameInput?.focus());
  }

  async function commit() {
    const item = items.find((i) => i.id === editingId);
    editingId = null;
    if (!item) return;
    const name = draftName.trim();
    const details = joinDetails([...chips, chipDraft]);
    if (!name) {
      draftName = item.name; // an item needs a name; keep the old one
      return;
    }
    const change: Partial<ClientItem> = {};
    if (name !== item.name) change.name = name;
    if (details !== item.details) change.details = details;
    if (Object.keys(change).length) await patch(item, change, `Saved “${name}”`);
  }

  function rowFocusOut(e: FocusEvent) {
    const row = e.currentTarget as HTMLElement;
    if (!row.contains(e.relatedTarget as Node | null)) commit();
  }

  function onChipInput() {
    if (!chipDraft.includes(',')) return;
    const parts = chipDraft.split(',');
    const last = parts.pop() ?? '';
    for (const p of parts) if (p.trim()) chips.push(p.trim());
    chipDraft = last.trimStart();
  }

  function onChipKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (chipDraft.trim()) {
        chips.push(chipDraft.trim());
        chipDraft = '';
      } else {
        commit().then(() => newInput?.focus());
      }
    } else if (e.key === 'Backspace' && !chipDraft && chips.length) {
      chipDraft = chips.pop() ?? '';
    } else if (e.key === 'Escape') {
      editingId = null;
    }
  }

  function onNameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      chipInput?.focus();
    } else if (e.key === 'Escape') {
      editingId = null;
    }
  }

  async function addItem() {
    const typed = newName.trim();
    // "Washers: M4, M5" adds the item with its details, like quick entry.
    const parsed = parseQuickEntry(typed)[0];
    if (!parsed?.name) return;
    newName = '';
    try {
      const rec = await api('POST', '/api/items', { place: placeId, name: parsed.name, details: parsed.details });
      items.push({ id: rec.id, name: rec.name, details: rec.details, pinned: rec.pinned, photo: '', sort: rec.sort });
      onchange();
      toast(`Added “${rec.name}”`, {
        undo: async () => {
          try {
            await api('DELETE', `/api/items/${rec.id}`);
            items = items.filter((i) => i.id !== rec.id);
            onchange();
          } catch (e) {
            fail(e);
          }
        }
      });
    } catch (e) {
      newName = typed;
      fail(e);
    }
  }

  async function remove(item: ClientItem) {
    editingId = null;
    swipedId = null;
    try {
      await api('DELETE', `/api/items/${item.id}`);
      items = items.filter((i) => i.id !== item.id);
      onchange();
      toast(`Deleted “${item.name}”`, {
        undo: async () => {
          try {
            const rec = await api('POST', '/api/items', {
              place: placeId,
              name: item.name,
              details: item.details,
              pinned: item.pinned,
              sort: item.sort
            });
            items = [...items, { ...item, id: rec.id, photo: '' }].sort((a, b) => a.sort - b.sort);
            onchange();
          } catch (e) {
            fail(e);
          }
        }
      });
    } catch (e) {
      fail(e);
    }
  }

  async function uploadPhoto(item: ClientItem, file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append('photo', file);
    try {
      const res = await fetch(`/api/items/${item.id}/photo`, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      item.photo = data.photo;
      toast('Photo added');
    } catch (e) {
      fail(e);
    }
  }

  async function removePhoto(item: ClientItem) {
    try {
      await api('DELETE', `/api/items/${item.id}/photo`);
      item.photo = '';
      toast('Photo removed');
    } catch (e) {
      fail(e);
    }
  }
</script>

<section class="items">
  <div class="head">
    <h2 class="section-label">Items</h2>
    <span class="count">{items.length}{#if items.some((i) => i.pinned)} · {items.filter((i) => i.pinned).length} pinned{/if}</span>
    {#if items.length >= FILTER_AT}
      <label class="filter">
        <ListFilter size={13} />
        <input bind:value={filter} placeholder="Filter items" aria-label="Filter items" autocomplete="off" />
      </label>
    {:else if items.length}
      <span class="hint touch">Tap to edit · swipe for more</span>
    {/if}
  </div>
  <ul class="panel list" bind:this={listEl}>
    {#each shown as item (item.id)}
      <li data-id={item.id} class:dragging={dragId === item.id}>
        {#if editingId === item.id}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div class="row editing" onfocusout={rowFocusOut} role="group" aria-label="Edit {item.name}">
            <label class="field-label" for="item-name-{item.id}">Name</label>
            <input
              id="item-name-{item.id}"
              class="name-input"
              bind:this={nameInput}
              bind:value={draftName}
              onkeydown={onNameKey}
              placeholder="Item name"
            />
            <label class="field-label" for="item-details-{item.id}">Details</label>
            <div class="chip-edit">
              {#each chips as c, i}
                <span class="chip edit-chip"
                  >{c}<button type="button" aria-label="Remove {c}" onclick={() => chips.splice(i, 1)}><X size={11} /></button
                  ></span
                >
              {/each}
              <input
                id="item-details-{item.id}"
                class="chip-input"
                bind:this={chipInput}
                bind:value={chipDraft}
                oninput={onChipInput}
                onkeydown={onChipKey}
                aria-label="Details, separated by commas"
                placeholder={chips.length ? 'Add detail' : 'Details, separated by commas'}
              />
            </div>
            <div class="tools">
              <button type="button" class="tool" class:on={item.pinned} onclick={() => patch(item, { pinned: !item.pinned }, item.pinned ? 'Unpinned' : 'Pinned to label')}
                ><Pin size={15} />{item.pinned ? 'Pinned' : 'Pin to label'}</button
              >
              {#if item.photo}
                <button type="button" class="tool" onclick={() => removePhoto(item)}><X size={15} />Remove photo</button>
              {:else}
                <button type="button" class="tool" onclick={() => fileInput?.click()}><Camera size={15} />Photo</button>
              {/if}
              <button type="button" class="tool" onclick={() => onmove(item)}><ArrowRight size={15} />Move</button>
              <button type="button" class="tool danger" onclick={() => remove(item)}><Trash2 size={15} />Delete</button>
              <input
                bind:this={fileInput}
                type="file"
                accept="image/*"
                class="sr-only"
                tabindex="-1"
                onchange={(e) => {
                  uploadPhoto(item, e.currentTarget.files?.[0]);
                  e.currentTarget.value = '';
                }}
              />
            </div>
          </div>
        {:else}
          <div
            class="swipe-acts"
            class:sliding={swipe?.active && swipe.id === item.id}
            hidden={!offset(item.id)}
            style:transform="translateX({SWIPE_W + offset(item.id)}px)"
          >
            <button
              type="button"
              class="sa pin-sa"
              onclick={() => ((swipedId = null), patch(item, { pinned: !item.pinned }, item.pinned ? 'Unpinned' : 'Pinned to label'))}
              ><Pin size={16} />{item.pinned ? 'Unpin' : 'Pin'}</button
            >
            <button type="button" class="sa move-sa" onclick={() => ((swipedId = null), onmove(item))}><ArrowRight size={16} />Move</button>
            <button type="button" class="sa del-sa" onclick={() => remove(item)}><Trash2 size={16} />Delete</button>
          </div>
          <div class="row">
            <button
              type="button"
              class="view"
              onclick={() => tapRow(item)}
              onpointerdown={(e) => swipeStart(e, item)}
              onpointermove={swipeMove}
              onpointerup={swipeEnd}
              onpointercancel={swipeEnd}
              aria-label="Edit {item.name}"
            >
              {#if item.photo}
                <span class="thumb"><Photo collection="items" id={item.id} file={item.photo} thumb="96x96" /></span>
              {/if}
              <span class="txt">
                <span class="nm"
                  >{item.name}{#if item.pinned}<span class="pinned" title="Pinned to the label"><Pin size={13} aria-label="Pinned" /></span>{/if}</span
                >
                {#if item.details.trim()}
                  <Chips chips={splitDetails(item.details)} />
                {:else}
                  <span class="adddetails">+ Add details</span>
                {/if}
              </span>
              <span class="edit" aria-hidden="true"><Pencil size={14} /></span>
            </button>
            {#if !filter}<button
              type="button"
              class="grip"
              aria-label="Reorder {item.name}. Drag, or use the up and down arrow keys."
              onpointerdown={(e) => dragStart(e, item)}
              onpointermove={dragMove}
              onpointerup={dragEnd}
              onpointercancel={dragEnd}
              onkeydown={(e) => nudge(e, item)}><GripVertical size={16} /></button
            >{/if}
            <button type="button" class="hov" aria-label="Move {item.name}" title="Move" onclick={() => onmove(item)}><ArrowRight size={14} /></button>
            <button
              type="button"
              class="pin hov"
              class:on={item.pinned}
              aria-pressed={item.pinned}
              aria-label={item.pinned ? 'Unpin from label' : 'Pin to label'}
              onclick={() => patch(item, { pinned: !item.pinned }, item.pinned ? 'Unpinned' : 'Pinned to label')}
              ><Pin size={14} /></button
            >
          </div>
        {/if}
      </li>
    {/each}
    {#if filter && !shown.length}
      <li class="nomatch">No items match “{filter}”</li>
    {/if}
    <li class="add add-dock">
      <label for="new-item" class="sr-only">Add item</label>
      <span class="plus"><Plus size={15} /></span>
      <input
        id="new-item"
        bind:this={newInput}
        bind:value={newName}
        placeholder="Add item · name: detail, detail"
        autocomplete="off"
        enterkeyhint="next"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
          }
        }}
        onblur={addItem}
      />
      <span class="mono key" aria-hidden="true">Enter</span>
      <button type="button" class="addgo" aria-label="Add item" onmousedown={(e) => e.preventDefault()} onclick={addItem}><Plus size={18} /></button>
    </li>
  </ul>
  {#if !items.length}
    <p class="hint">Nothing here yet. Type a name above and press Enter. Tap an item afterwards to edit its name and add details.</p>
  {/if}
</section>

<style>
  .items { display: flex; flex-direction: column; gap: 8px; }
  .head { display: flex; align-items: center; gap: 8px; min-height: 28px; }
  .head .touch { margin-left: auto; }
  .filter {
    margin-left: auto; display: flex; align-items: center; gap: 6px; width: 200px; height: 32px; padding: 0 8px;
    border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-sm);
  }
  .filter:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
  .filter input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; color: var(--text); }
  .filter input:focus-visible { box-shadow: none; }
  .nomatch { padding: 12px; font-size: var(--fs-sm); color: var(--text-3); }
  .count { font-size: var(--fs-sm); color: var(--text-3); }
  .list { overflow: hidden; }
  li { position: relative; overflow: hidden; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: 0; }
  .row { display: flex; align-items: stretch; }
  .view { touch-action: pan-y; }
  /* The actions slide in over the right of the row, so the item's name stays readable */
  .swipe-acts { position: absolute; z-index: 1; top: 0; right: 0; bottom: 0; width: 192px; display: flex; transition: transform .18s ease; }
  .swipe-acts.sliding { transition: none; }
  .swipe-acts[hidden] { display: none; }
  .sa { width: 64px; border: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: var(--fs-xs); }
  .pin-sa { background: var(--accent-soft); color: var(--accent-text); }
  .move-sa { background: var(--border-strong); color: var(--text); }
  .del-sa { background: #3A1C1C; color: var(--remove); }
  .pinned { display: inline-flex; vertical-align: -1px; margin-left: 6px; color: var(--accent-text); }
  .hov { display: none; }
  .key, .addgo { display: none; }
  .view {
    flex-grow: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px 4px 10px 12px; min-height: 44px;
    border: 0; background: transparent; text-align: left; color: var(--text);
  }
  .view:hover { background: var(--surface-hover); }
  .txt { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .nm { font-weight: 500; overflow-wrap: anywhere; }
  .thumb { width: 40px; height: 40px; border-radius: var(--r-md); overflow: hidden; flex-shrink: 0; background: var(--surface-2); }
  .edit { margin-left: auto; color: var(--text-3); display: none; padding: 0 4px; }
  @media (min-width: 900px) { .edit { display: flex; } }
  .view:hover .edit { color: var(--text); }
  .adddetails { align-self: flex-start; padding: 1px 8px; border-radius: var(--r-sm); border: 1px dashed var(--chip-border); font-size: var(--fs-sm); color: var(--text-3); }
  .grip { width: 40px; border: 0; background: transparent; color: var(--text-3); display: flex; align-items: center; justify-content: center; cursor: grab; touch-action: none; }
  .grip:hover { color: var(--text-2); }
  li.dragging { background: var(--surface-hover); }
  li.dragging .grip { cursor: grabbing; color: var(--accent-text); }
  .pin { width: 44px; border: 0; background: transparent; color: var(--text-4); align-items: center; justify-content: center; }
  .pin:hover { color: var(--text-2); }
  .pin.on { color: #7C86E8; }
  .editing { flex-direction: column; gap: 8px; padding: 10px 12px; background: var(--surface-2); }
  .field-label { font-size: var(--fs-sm); color: var(--text-3); margin-bottom: -4px; }
  .chip-input { border: 0; background: transparent; outline: none; min-width: 0; }
  .name-input {
    width: 100%; min-width: 0; height: 40px; padding: 0 10px; font-weight: 500; color: var(--text);
    border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--bg); outline: none;
  }
  .name-input:hover, .chip-edit:hover { border-color: var(--sep); }
  .name-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
  .chip-edit { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; padding: 4px 6px; border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--bg); min-height: 36px; }
  .chip-edit:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
  .chip-input { flex: 1 1 120px; height: 28px; font-size: var(--fs-md); }
  .edit-chip { display: inline-flex; align-items: center; gap: 4px; padding-right: 2px; }
  .edit-chip button { width: 20px; height: 20px; border: 0; background: transparent; color: var(--text-3); display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; }
  .tools { display: flex; flex-wrap: wrap; gap: 6px; }
  .tool {
    height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-md);
    border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-2); font-size: var(--fs-md);
  }
  .tool.on { border-color: var(--accent-border); background: var(--accent-soft); color: var(--accent-text); }
  .tool.danger { color: var(--remove); }
  .add { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 44px; color: var(--text-3); }
  .add input { flex-grow: 1; height: 100%; border: 0; background: transparent; outline: none; color: var(--text); }
  .add input:focus-visible { box-shadow: none; }
  .plus { display: flex; }

  /* Phone: the add field docks in the thumb zone, above the tab bar */
  @media (max-width: 899px) {
    .head .filter { width: 160px; }
    li:nth-last-child(2) { border-bottom: 0; }
    .add-dock {
      position: fixed; z-index: 15; left: 12px; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom));
      height: 52px; padding: 0 6px 0 14px; border: 1px solid var(--accent-border); border-radius: 12px; background: var(--surface-2);
    }
    .add-dock .plus { display: none; }
    .add-dock input { font-size: 15px; }
    .addgo { display: flex; width: 40px; height: 40px; flex-shrink: 0; border: 0; border-radius: 9px; background: var(--accent); color: #fff; align-items: center; justify-content: center; }
  }
  /* Desktop: row actions show on hover or focus; swiping is for touch */
  @media (min-width: 900px) {
    .swipe-acts, .touch { display: none !important; }
    .grip, .hov { opacity: 0; }
    li:hover .grip, li:hover .hov, li:focus-within .grip, li:focus-within .hov, li.dragging .grip { opacity: 1; }
    .hov { display: flex; width: 36px; border: 0; background: transparent; color: var(--text-3); align-items: center; justify-content: center; }
    .hov:hover { color: var(--text); }
    .key { display: inline; font-size: var(--fs-xs); padding: 1px 6px; border: 1px solid #2a2a2f; border-radius: 4px; }
  }
  .hint { font-size: var(--fs-sm); color: var(--text-3); }
</style>
