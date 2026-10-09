<script lang="ts">
  import { tick } from 'svelte';
  import Search from 'lucide-svelte/icons/search';
  import TypeIcon from './TypeIcon.svelte';
  import { normalize } from '$lib/search';
  import { pad4, type PlaceType } from '$lib/types';

  interface Row {
    id: string;
    code: number;
    name: string;
    type: string;
    parent: string;
    path: string;
  }

  let {
    title = 'Choose a place',
    types,
    exclude = '',
    allowNone = false,
    noneLabel = 'Top level (no parent)',
    onpick,
    onclose
  }: {
    title?: string;
    types: PlaceType[];
    /** Hide this place and everything inside it (no moving into yourself). */
    exclude?: string;
    allowNone?: boolean;
    noneLabel?: string;
    onpick: (row: Row | null) => void;
    onclose: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let rows = $state<Row[]>([]);
  let q = $state('');
  let loading = $state(true);
  const typeById = $derived(new Map(types.map((t) => [t.id, t])));

  const banned = $derived.by(() => {
    const s = new Set<string>();
    if (!exclude) return s;
    s.add(exclude);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of rows) if (r.parent && s.has(r.parent) && !s.has(r.id)) (s.add(r.id), (grew = true));
    }
    return s;
  });
  const shown = $derived.by(() => {
    const n = normalize(q);
    return rows
      .filter((r) => !banned.has(r.id))
      .filter((r) => !n || normalize(r.path + ' ' + r.name + ' ' + pad4(r.code)).includes(n))
      .slice(0, 100);
  });

  $effect(() => {
    dialog?.showModal();
    fetch('/api/places')
      .then((r) => r.json())
      .then((d) => (rows = d))
      .finally(() => (loading = false));
    tick().then(() => input?.focus());
  });
</script>

<dialog bind:this={dialog} onclose={onclose} onclick={(e) => e.target === dialog && dialog?.close()}>
  <div class="sheet">
    <header>
      <h2>{title}</h2>
      <button type="button" class="close" onclick={() => dialog?.close()}>Cancel</button>
    </header>
    <div class="search">
      <Search size={15} />
      <input bind:this={input} bind:value={q} type="search" placeholder="Search places" aria-label="Search places" />
    </div>
    <ul>
      {#if allowNone}
        <li>
          <button type="button" onclick={() => (onpick(null), dialog?.close())}><span class="nm">{noneLabel}</span></button>
        </li>
      {/if}
      {#each shown as r (r.id)}
        <li>
          <button type="button" onclick={() => (onpick(r), dialog?.close())}>
            <TypeIcon type={typeById.get(r.type)} size={15} />
            <span class="txt">
              <span class="nm">{r.name}</span>
              {#if r.path}<span class="path">{r.path}</span>{/if}
            </span>
            <span class="mono code">{pad4(r.code)}</span>
          </button>
        </li>
      {:else}
        <li class="none">{loading ? 'Loading…' : 'No places match.'}</li>
      {/each}
    </ul>
  </div>
</dialog>

<style>
  dialog {
    padding: 0; border: 1px solid var(--border-strong); border-radius: var(--r-xl); background: var(--bg);
    color: var(--text); width: min(560px, calc(100vw - 24px)); max-height: min(640px, calc(100dvh - 48px));
  }
  dialog::backdrop { background: rgba(0, 0, 0, .6); }
  .sheet { display: flex; flex-direction: column; max-height: inherit; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--border); }
  h2 { font-size: var(--fs-base); font-weight: 500; }
  .close { height: 44px; padding: 0 12px; border: 0; background: transparent; color: var(--text-3); }
  .search { display: flex; align-items: center; gap: 8px; margin: 12px 12px 4px; padding: 0 12px; height: 44px; border: 1px solid var(--border-strong); border-radius: var(--r-lg); background: var(--surface-2); color: var(--text-3); }
  .search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
  .search input { flex-grow: 1; border: 0; outline: none; background: transparent; color: var(--text); font-size: var(--fs-lg); }
  ul { overflow-y: auto; padding: 4px 8px 12px; }
  li button { width: 100%; min-height: 48px; display: flex; align-items: center; gap: 12px; padding: 6px 8px; border: 0; border-radius: var(--r-md); background: transparent; text-align: left; color: var(--text); }
  li button:hover { background: var(--surface-hover); }
  .txt { flex-grow: 1; min-width: 0; display: flex; flex-direction: column; }
  .nm { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .path { font-size: var(--fs-sm); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .code { font-size: var(--fs-sm); color: var(--text-3); }
  .none { padding: 16px; color: var(--text-3); text-align: center; }
</style>
