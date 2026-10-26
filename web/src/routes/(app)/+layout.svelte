<script lang="ts">
  import { page } from '$app/state';
  import House from 'lucide-svelte/icons/house';
  import Search from 'lucide-svelte/icons/search';
  import Printer from 'lucide-svelte/icons/printer';
  import Settings from 'lucide-svelte/icons/settings';
  import Plus from 'lucide-svelte/icons/plus';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ArrowDownAZ from 'lucide-svelte/icons/arrow-down-a-z';
  import ArrowDown01 from 'lucide-svelte/icons/arrow-down-0-1';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ListFilter from 'lucide-svelte/icons/list-filter';
  import X from 'lucide-svelte/icons/x';
  import TypeIcon from '$lib/components/TypeIcon.svelte';
  import { pad4 } from '$lib/types';

  let { data, children } = $props();
  // Saving forms only works from the address set as PUBLIC_BASE_URL; say so instead of failing silently.
  let wrongAddress = $state(false);
  $effect(() => {
    wrongAddress = location.origin !== data.baseUrl;
  });

  const path = $derived(page.url.pathname);
  const currentCode = $derived(path.startsWith('/p/') ? parseInt(path.slice(3), 10) : NaN);
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));

  // Sidebar width, dragged from its right edge; remembered per browser.
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 520;
  const SIDEBAR_DEFAULT = 264;
  let sidebarW = $state(SIDEBAR_DEFAULT);
  $effect(() => {
    try {
      const w = parseInt(localStorage.getItem('sidebarWidth') ?? '', 10);
      if (w) sidebarW = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));
    } catch {}
  });
  function setSidebarW(w: number) {
    sidebarW = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)));
    try {
      localStorage.setItem('sidebarWidth', String(sidebarW));
    } catch {}
  }
  function startResize(e: PointerEvent) {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = sidebarW;
    const move = (ev: PointerEvent) => setSidebarW(w0 + ev.clientX - x0);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      document.body.classList.remove('resizing');
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    document.body.classList.add('resizing');
  }
  function resizeKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    if (e.key === 'ArrowLeft') setSidebarW(sidebarW - step);
    else if (e.key === 'ArrowRight') setSidebarW(sidebarW + step);
    else if (e.key === 'Home') setSidebarW(SIDEBAR_DEFAULT);
    else return;
    e.preventDefault();
  }

  // Sidebar tree sort, by name or by code; remembered per browser.
  let sortBy = $state<'name' | 'code'>('name');
  $effect(() => {
    try {
      if (localStorage.getItem('treeSort') === 'code') sortBy = 'code';
    } catch {}
  });
  function toggleSort() {
    sortBy = sortBy === 'name' ? 'code' : 'name';
    try {
      localStorage.setItem('treeSort', sortBy);
    } catch {}
  }
  const sorted = $derived.by(() => {
    const kids = new Map<string, typeof data.tree>();
    for (const n of data.tree) (kids.get(n.parent) ?? kids.set(n.parent, []).get(n.parent)!).push(n);
    const cmp =
      sortBy === 'code'
        ? (a: (typeof data.tree)[0], b: (typeof data.tree)[0]) => a.code - b.code
        : (a: (typeof data.tree)[0], b: (typeof data.tree)[0]) =>
            a.name.localeCompare(b.name, undefined, { numeric: true });
    const out: typeof data.tree = [];
    const walk = (parent: string) => {
      for (const n of (kids.get(parent) ?? []).sort(cmp)) {
        out.push(n);
        walk(n.id);
      }
    };
    walk('');
    return out;
  });

  // Sidebar tree: expand the chain leading to the current place.
  let open = $state<Record<string, boolean>>({});
  const byId = $derived(new Map(data.tree.map((n) => [n.id, n])));
  const hasKids = $derived(new Set(data.tree.map((n) => n.parent).filter(Boolean)));
  const trail = $derived.by(() => {
    const s = new Set<string>();
    let cur = data.tree.find((n) => n.code === currentCode);
    while (cur && cur.parent) {
      s.add(cur.parent);
      cur = byId.get(cur.parent);
    }
    return s;
  });
  // Sidebar filter: matching places plus the chain above them, all expanded.
  let filter = $state('');
  const matches = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return null;
    const keep = new Set<string>();
    for (const n of data.tree) {
      const digits = q.replace(/^#?0*/, '');
      if (!n.name.toLowerCase().includes(q) && !(/^\d+$/.test(digits) && pad4(n.code).includes(digits))) continue;
      let cur: (typeof data.tree)[0] | undefined = n;
      while (cur && !keep.has(cur.id)) {
        keep.add(cur.id);
        cur = byId.get(cur.parent);
      }
    }
    return keep;
  });
  const visible = $derived(
    sorted.filter((n) => {
      if (matches) return matches.has(n.id);
      let p = n.parent;
      while (p) {
        if (!(open[p] ?? trail.has(p))) return false;
        p = byId.get(p)?.parent ?? '';
      }
      return true;
    })
  );
  const nav = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  const wide = $derived(path === '/' || path.startsWith('/p/'));
  // Phone header on a place page: back to the place it lives in.
  const back = $derived((page.data as { steps?: { code: number; name: string }[] }).steps?.at(-1));
</script>

<div class="shell">
  <aside class="sidebar" aria-label="Sidebar" style:--sidebar-w="{sidebarW}px">
    <a class="brand" href="/"><span class="logo mono">#</span>Bins</a>
    <nav class="links" aria-label="Main">
      <a href="/" class:on={nav('/')}><House size={15} />Browse</a>
      <a href="/search" class:on={nav('/search')}><Search size={15} />Search</a>
      <a href="/print" class:on={nav('/print')}
        ><Printer size={15} />Print queue{#if data.queueCount}<span class="count">{data.queueCount}</span>{/if}</a
      >
      <a href="/types" class:on={nav('/types')}><Settings size={15} />Settings</a>
    </nav>
    <div class="treehead">
      <span class="section-label">Places</span>
      <span class="treeacts">
        <button
          type="button"
          class="addbtn"
          onclick={toggleSort}
          aria-label={sortBy === 'name' ? 'Sorted by name; sort by number' : 'Sorted by number; sort by name'}
          title={sortBy === 'name' ? 'Sorted by name' : 'Sorted by number'}
          >{#if sortBy === 'name'}<ArrowDownAZ size={14} />{:else}<ArrowDown01 size={14} />{/if}</button
        >
        <a class="addbtn" href="/new" aria-label="New place"><Plus size={14} /></a>
      </span>
    </div>
    <label class="filter">
      <ListFilter size={13} />
      <input bind:value={filter} placeholder="Filter places" aria-label="Filter places" autocomplete="off" onkeydown={(e) => e.key === 'Escape' && (filter = '')} />
      {#if filter}<button type="button" aria-label="Clear filter" onclick={() => (filter = '')}><X size={12} /></button>{/if}
    </label>
    <ul class="tree">
      {#each visible as n (n.id)}
        <li style:padding-left="{n.depth * 14}px">
          <button
            type="button"
            class="twist"
            class:hidden={!hasKids.has(n.id)}
            aria-label="Expand"
            onclick={() => (open[n.id] = !(open[n.id] ?? trail.has(n.id)))}
            ><span class:rot={matches ? true : (open[n.id] ?? trail.has(n.id))}><ChevronRight size={12} /></span></button
          >
          <a href="/p/{n.code}" class:on={n.code === currentCode}
            ><TypeIcon type={typeById.get(n.type)} size={13} /><span class="nm">{n.name}</span><span class="code mono">{pad4(n.code)}</span></a
          >
        </li>
      {:else}
        {#if matches}<li class="nomatch">No places match</li>{/if}
      {/each}
    </ul>
  </aside>
  <!-- A focusable separator is a resize control (ARIA window splitter pattern). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="resizer"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    aria-valuenow={sidebarW}
    aria-valuemin={SIDEBAR_MIN}
    aria-valuemax={SIDEBAR_MAX}
    tabindex="0"
    title="Drag to resize; double-click to reset"
    onpointerdown={startResize}
    ondblclick={() => setSidebarW(SIDEBAR_DEFAULT)}
    onkeydown={resizeKey}
  ></div>

  <div class="main">
    {#if path.startsWith('/p/')}
      <header class="topbar">
        <a href={back ? `/p/${back.code}` : '/'} class="back" aria-label="Back to {back?.name ?? 'Browse'}"><ChevronLeft size={20} /></a>
        <span class="backname">{back?.name ?? 'Browse'}</span>
        <a href="/search" class="iconlink" aria-label="Search"><Search size={18} /></a>
      </header>
    {/if}
    {#if wrongAddress}
      <p class="wrong-address" role="alert">
        You opened the app at <span class="mono">{location.origin}</span>, but it's set up for
        <a class="mono" href={data.baseUrl + location.pathname + location.search}>{data.baseUrl}</a>. Saving won't work from
        here; use that address.
      </p>
    {/if}
    <div class="content" class:wide>
      {@render children()}
    </div>
  </div>

  <nav class="bottombar" aria-label="Main">
    <a href="/" class:on={nav('/')}><House size={20} />Browse</a>
    <a href="/search" class:on={nav('/search')}><Search size={20} />Search</a>
    <a href="/print" class:on={nav('/print')} class="rel"
      ><Printer size={20} />Print{#if data.queueCount}<span class="badge">{data.queueCount}</span>{/if}</a
    >
    <a href="/types" class:on={nav('/types')}><Settings size={20} />Settings</a>
  </nav>
</div>

<svelte:window
  onkeydown={(e) => {
    const t = e.target as HTMLElement;
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
      e.preventDefault();
      const field = document.querySelector<HTMLInputElement>('[data-search-input]');
      if (field) field.focus();
      else location.href = '/search';
    }
  }}
/>

<style>
  .wrong-address { margin: 12px 14px 0; padding: 10px 12px; border: 1px solid var(--warn-border); border-radius: var(--r-md); background: var(--warn-bg); color: var(--warn); font-size: var(--fs-md); }
  .wrong-address a { color: var(--warn); text-decoration: underline; }
  .shell { min-height: 100dvh; display: flex; flex-direction: column; }
  .sidebar, .resizer { display: none; }
  .main { flex-grow: 1; display: flex; flex-direction: column; min-width: 0; padding-bottom: calc(68px + env(safe-area-inset-bottom)); }
  .topbar { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--border); }
  .back, .iconlink { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--text-2); flex-shrink: 0; }
  .backname { flex-grow: 1; min-width: 0; font-size: var(--fs-md); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .content { width: 100%; max-width: 720px; margin: 0 auto; flex-grow: 1; }

  .bottombar {
    position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-around;
    padding: 6px 16px calc(10px + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1px solid var(--border); z-index: 20;
  }
  .bottombar a {
    display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 56px; min-height: 44px; padding: 6px 0;
    color: var(--text-3); font-size: var(--fs-xs);
  }
  .bottombar a.on { color: var(--text); font-weight: 500; }
  .rel { position: relative; }
  .badge {
    position: absolute; top: 2px; right: 10px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
    background: var(--accent); color: #fff; font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center;
  }

  @media (min-width: 900px) {
    .shell { flex-direction: row; }
    .sidebar {
      display: flex; flex-direction: column; gap: 12px; width: var(--sidebar-w, 264px); flex-shrink: 0; height: 100dvh; position: sticky; top: 0;
      padding: 16px 12px; border-right: 1px solid var(--border); background: var(--bg-sunken); overflow-y: auto;
    }
    .resizer { display: block; flex-shrink: 0; width: 6px; margin: 0 -3px; height: 100dvh; position: sticky; top: 0; cursor: col-resize; z-index: 5; touch-action: none; }
    .resizer:hover, .resizer:focus-visible, :global(body.resizing) .resizer { background: var(--accent-border); outline: none; }
    :global(body.resizing) { cursor: col-resize; user-select: none; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text); padding: 0 6px; }
    .logo { width: 22px; height: 22px; border-radius: 6px; background: var(--accent-soft); color: var(--accent-text); display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-sm); }
    .filter {
      display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 4px 0 8px; margin: 0 2px; border-radius: var(--r-md);
      background: var(--surface-2); border: 1px solid var(--border-strong); color: var(--text-3); font-size: var(--fs-sm);
    }
    .filter:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
    .filter input { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; color: var(--text); }
    .filter input:focus-visible { box-shadow: none; }
    .filter button { width: 22px; height: 22px; border: 0; border-radius: 4px; background: transparent; color: var(--text-3); display: flex; align-items: center; justify-content: center; }
    .nomatch { padding: 4px 8px; font-size: var(--fs-sm); color: var(--text-3); }
    .links { display: flex; flex-direction: column; gap: 2px; }
    .links a { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px; border-radius: var(--r-md); color: var(--text-2); font-size: var(--fs-md); }
    .links a:hover { background: var(--surface-hover); color: var(--text); }
    .links a.on { background: var(--surface-hover); color: var(--text); font-weight: 500; }
    .count { margin-left: auto; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--accent); color: #fff; font-size: var(--fs-xs); font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
    .treehead { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 0; }
    .treeacts { display: flex; gap: 2px; }
    .addbtn { border: 0; padding: 0; background: transparent; cursor: pointer; }
    .addbtn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); color: var(--text-3); }
    .addbtn:hover { background: var(--surface-hover); color: var(--text); }
    .tree li { display: flex; align-items: center; }
    .tree a { flex-grow: 1; min-width: 0; display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px; border-radius: var(--r-sm); color: var(--text-2); font-size: var(--fs-md); }
    .tree a:hover { background: var(--surface-hover); }
    .tree a.on { background: var(--accent-soft); color: var(--text); }
    .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code { margin-left: auto; padding-left: 8px; flex-shrink: 0; color: var(--text-4); font-size: var(--fs-xs); }
    .tree a.on .code { color: var(--text-3); }
    .twist { width: 18px; height: 18px; flex-shrink: 0; border: 0; padding: 0; background: transparent; color: var(--text-3); display: flex; align-items: center; justify-content: center; }
    .twist.hidden { visibility: hidden; }
    .twist .rot { display: inline-flex; transform: rotate(90deg); }
    .main { padding-bottom: 0; }
    .topbar { display: none; }
    .bottombar { display: none; }
    .content { max-width: 880px; padding: 8px 24px 48px; }
    .content.wide { max-width: 1180px; padding: 8px 40px 48px; }
  }
</style>
