<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import Plus from 'lucide-svelte/icons/plus';
  import GripVertical from 'lucide-svelte/icons/grip-vertical';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Download from 'lucide-svelte/icons/download';
  import Upload from 'lucide-svelte/icons/upload';
  import TypeTile from '$lib/components/TypeTile.svelte';
  import { iconFor } from '$lib/icons';
  import { toast } from '$lib/toast.svelte';

  let { data, form } = $props();

  interface T {
    id: string;
    name: string;
    icon: string;
    color: string;
    labeled_default: boolean;
    used: number;
  }
  let types = $state<T[]>(structuredClone($state.snapshot(data.typeList)) as T[]);
  let openIcons = $state<string | null>(null);
  let importing = $state(false);
  let fileName = $state('');

  const refresh = () => Promise.all([invalidate('app:layout'), invalidate('app:types')]);

  async function save(t: T, change: Partial<T>) {
    const before: Partial<T> = {};
    for (const k of Object.keys(change) as (keyof T)[]) (before as any)[k] = t[k];
    Object.assign(t, change);
    const res = await fetch(`/api/types/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change) });
    if (!res.ok) {
      Object.assign(t, before);
      return toast((await res.json()).error ?? 'Could not save', { error: true });
    }
    refresh();
    toast('Type saved', {
      undo: async () => {
        Object.assign(t, before);
        await fetch(`/api/types/${t.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(before) });
        refresh();
      }
    });
  }

  // ---- drag to reorder (display order only; types behave the same wherever they sit) ----
  let listEl: HTMLUListElement | undefined = $state();
  let dragId = $state<string | null>(null);
  let before: T[] = [];

  function moveTo(id: string, to: number) {
    const from = types.findIndex((t) => t.id === id);
    if (from === -1 || from === to) return;
    const [t] = types.splice(from, 1);
    types.splice(to, 0, t);
  }

  function dragStart(e: PointerEvent, t: T) {
    if (e.button > 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    openIcons = null;
    dragId = t.id;
    before = types.map((x) => ({ ...x }));
  }

  function dragMove(e: PointerEvent) {
    if (!dragId || !listEl) return;
    const rows = [...listEl.querySelectorAll<HTMLElement>('li[data-id]')];
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (e.clientY < r.top + Math.min(r.height / 2, 30)) {
        target = i;
        break;
      }
    }
    moveTo(dragId, target);
  }

  async function persistOrder(prev: T[]) {
    const changed = types.map((t, i) => ({ t, i })).filter(({ t, i }) => prev.findIndex((p) => p.id === t.id) !== i);
    if (!changed.length) return;
    const send = (list: { id: string; sort: number }[]) =>
      Promise.all(list.map((x) => fetch(`/api/types/${x.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sort: x.sort }) })));
    // write a sort for every type so the saved order is unambiguous
    const res = await send(types.map((t, i) => ({ id: t.id, sort: i })));
    if (res.some((r) => !r.ok)) {
      types = prev;
      return toast('Could not save the order', { error: true });
    }
    refresh();
    toast('Order saved', {
      undo: async () => {
        types = prev;
        await send(prev.map((t, i) => ({ id: t.id, sort: i })));
        refresh();
      }
    });
  }

  async function dragEnd() {
    if (!dragId) return;
    dragId = null;
    await persistOrder(before);
  }

  async function nudge(e: KeyboardEvent, t: T) {
    const dir = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const to = types.findIndex((x) => x.id === t.id) + dir;
    if (to < 0 || to >= types.length) return;
    const prev = types.map((x) => ({ ...x }));
    moveTo(t.id, to);
    await persistOrder(prev);
    (e.target as HTMLElement | null)?.focus();
  }

  async function add() {
    const res = await fetch('/api/types', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `New type ${types.length + 1}`, icon: 'box', color: '#8A8F98', labeled_default: false })
    });
    const out = await res.json();
    if (!res.ok) return toast(out.error ?? 'Could not add', { error: true });
    types.push({ id: out.id, name: `New type ${types.length + 1}`, icon: 'box', color: '#8A8F98', labeled_default: false, used: 0 });
    refresh();
    toast('Type added');
  }

  async function remove(t: T) {
    const res = await fetch(`/api/types/${t.id}`, { method: 'DELETE' });
    const out = await res.json();
    if (!res.ok) return toast(out.error ?? 'Could not delete', { error: true });
    types = types.filter((x) => x.id !== t.id);
    refresh();
    toast(`Deleted ${t.name}`);
  }
</script>

<svelte:head><title>Settings · Bins</title></svelte:head>

<div class="page">
  <h1>Settings</h1>

  <section>
    <div class="sechead">
      <h2 class="section-label">Place types</h2>
      <button type="button" class="btn sm" onclick={add}><Plus size={14} />Add type</button>
    </div>
    <p class="hint">Drag the handle to put the types in the order you like; it only changes how they are listed. The type sets a place's icon and colour, and whether it gets a printed label by default. It never limits what can go inside what.</p>
    <ul class="panel list" bind:this={listEl}>
      {#each types as t (t.id)}
        {@const Icon = iconFor(t.icon)}
        <li data-id={t.id} class:dragging={dragId === t.id}>
          <div class="row">
            <button
              type="button"
              class="grip"
              aria-label="Reorder {t.name}. Drag, or use the up and down arrow keys."
              onpointerdown={(e) => dragStart(e, t)}
              onpointermove={dragMove}
              onpointerup={dragEnd}
              onpointercancel={dragEnd}
              onkeydown={(e) => nudge(e, t)}><GripVertical size={16} /></button
            >
            <TypeTile type={{ ...t, sort: 0 }} />
            <label class="sr-only" for="n-{t.id}">Name</label>
            <input id="n-{t.id}" class="field name" value={t.name} onchange={(e) => e.currentTarget.value.trim() && save(t, { name: e.currentTarget.value.trim() })} />
            <button type="button" class="btn icon" aria-label="Choose icon" aria-expanded={openIcons === t.id} onclick={() => (openIcons = openIcons === t.id ? null : t.id)}><Icon size={16} /></button>
            <label class="color" title="Colour">
              <span class="sr-only">Colour</span>
              <input type="color" value={t.color} onchange={(e) => save(t, { color: e.currentTarget.value.toUpperCase() })} />
            </label>
            <label class="lab">
              <span class="sr-only">Labeled by default</span>
              <button type="button" class="switch" class:on={t.labeled_default} role="switch" aria-checked={t.labeled_default} aria-label="Labeled by default for {t.name}" onclick={() => save(t, { labeled_default: !t.labeled_default })}><span></span></button>
              <span class="muted small">Label</span>
            </label>
            <button type="button" class="btn icon danger" aria-label="Delete {t.name}" disabled={t.used > 0} title={t.used ? `${t.used} places use this type` : 'Delete type'} onclick={() => remove(t)}><Trash2 size={15} /></button>
          </div>
          {#if openIcons === t.id}
            <div class="icons" role="listbox" aria-label="Icons">
              {#each data.iconNames as n}
                {@const I = iconFor(n)}
                <button type="button" class="ic" class:on={t.icon === n} aria-label={n} aria-selected={t.icon === n} onclick={() => (save(t, { icon: n }), (openIcons = null))}><I size={18} color={t.icon === n ? t.color : undefined} /></button>
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h2 class="section-label">Data</h2>
    <div class="panel data">
      <div class="r">
        <div class="grow">
          <div>Export CSV</div>
          <div class="muted small">{data.counts.places} places and {data.counts.items} items in one file.</div>
        </div>
        <a class="btn sm" href="/api/export.csv" download><Download size={14} />Export</a>
      </div>
      <form
        class="r import"
        method="post"
        action="?/import"
        enctype="multipart/form-data"
        use:enhance={() => {
          importing = true;
          return async ({ update, result }) => {
            await update({ reset: true });
            importing = false;
            fileName = '';
            if (result.type === 'success') {
              await refresh();
              toast('Import finished');
            }
          };
        }}
      >
        <div class="grow">
          <div>Import CSV</div>
          <div class="muted small">Creates new places with new codes. Use a file exported from here.</div>
          {#if form?.error}<div class="err" role="alert">{form.error}</div>{/if}
          {#if form?.imported}<div class="ok">Imported {form.imported.places} places and {form.imported.items} items.</div>{/if}
        </div>
        <label class="btn sm"
          >{fileName || 'Choose file'}<input type="file" name="file" accept=".csv,text/csv" class="sr-only" onchange={(e) => (fileName = e.currentTarget.files?.[0]?.name.slice(0, 18) ?? '')} /></label
        >
        <button class="btn sm primary" disabled={importing || !fileName}><Upload size={14} />{importing ? 'Importing…' : 'Import'}</button>
      </form>
    </div>
  </section>

  <section>
    <h2 class="section-label">Account</h2>
    <div class="panel data">
      <form class="r" method="post" action="/logout">
        <div class="grow">
          <div>{data.user?.email}</div>
          <div class="muted small">Signed in for 30 days on this device.</div>
        </div>
        <button class="btn sm">Sign out</button>
      </form>
    </div>
  </section>
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 24px; }
  h1 { font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; }
  section { display: flex; flex-direction: column; gap: 8px; }
  .sechead { display: flex; align-items: center; justify-content: space-between; }
  .hint, .small { font-size: var(--fs-sm); }
  .hint { color: var(--text-3); }
  .list > li { border-bottom: 1px solid var(--border); }
  .list > li:last-child { border-bottom: 0; }
  .row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; flex-wrap: wrap; }
  .grip { width: 28px; height: 36px; border: 0; background: transparent; color: var(--text-3); display: flex; align-items: center; justify-content: center; cursor: grab; touch-action: none; }
  .grip:hover { color: var(--text); }
  li.dragging { background: var(--surface-hover); }
  li.dragging .grip { cursor: grabbing; color: var(--accent-text); }
  .name { flex: 1 1 140px; min-width: 120px; height: 36px; }
  .color input { width: 44px; height: 36px; padding: 2px; border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--surface-2); }
  .lab { display: flex; align-items: center; gap: 6px; }
  .switch { width: 44px; height: 26px; padding: 3px; border: 0; border-radius: 999px; background: #2a2a2f; display: flex; justify-content: flex-start; }
  .switch span { width: 20px; height: 20px; border-radius: 999px; background: #fff; display: block; }
  .switch.on { background: var(--accent); justify-content: flex-end; }
  .icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 4px; padding: 8px 12px 12px; background: var(--surface-2); }
  .ic { height: 44px; border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--bg); color: var(--text-2); display: flex; align-items: center; justify-content: center; }
  .ic.on { border-color: var(--accent); background: var(--accent-soft); }
  .data .r { display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .data .r:last-child { border-bottom: 0; }
  .grow { flex: 1 1 200px; min-width: 0; }
  .err { color: var(--remove); font-size: var(--fs-sm); margin-top: 4px; }
  .ok { color: var(--add); font-size: var(--fs-sm); margin-top: 4px; }
</style>
