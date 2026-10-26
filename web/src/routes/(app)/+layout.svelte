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
  const visible = $derived(
    sorted.filter((n) => {
      let p = n.parent;
      while (p) {
        if (!(open[p] ?? trail.has(p))) return false;
        p = byId.get(p)?.parent ?? '';
      }
      return true;
    })
  );
  const nav = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
</script>

<div class="shell">
  <aside class="sidebar" aria-label="Sidebar">
    <a class="brand" href="/"><span class="logo mono">#</span>Bins</a>
    <a class="searchbtn" href="/search"><Search size={14} />Search everything</a>
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
    <ul class="tree">
      {#each visible as n (n.id)}
        <li style:padding-left="{n.depth * 14}px">
          <button
            type="button"
            class="twist"
            class:hidden={!hasKids.has(n.id)}
            aria-label="Expand"
            onclick={() => (open[n.id] = !(open[n.id] ?? trail.has(n.id)))}
            ><span class:rot={open[n.id] ?? trail.has(n.id)}><ChevronRight size={12} /></span></button
          >
          <a href="/p/{n.code}" class:on={n.code === currentCode}
            ><TypeIcon type={typeById.get(n.type)} size={13} /><span class="nm">{n.name}</span><span class="code mono">{pad4(n.code)}</span></a
          >
        </li>
      {/each}
    </ul>
  </aside>

  <div class="main">
    {#if path.startsWith('/p/')}
      <header class="topbar">
        <a href="/search" class="fakesearch"
          ><Search size={15} /><span>Search everything</span><span class="mono key">/</span></a
        >
      </header>
    {/if}
    {#if wrongAddress}
      <p class="wrong-address" role="alert">
        You opened the app at <span class="mono">{location.origin}</span>, but it's set up for
        <a class="mono" href={data.baseUrl + location.pathname + location.search}>{data.baseUrl}</a>. Saving won't work from
        here; use that address.
      </p>
    {/if}
    <div class="content">
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
      location.href = '/search';
    }
  }}
/>

<style>
  .wrong-address { margin: 12px 14px 0; padding: 10px 12px; border: 1px solid var(--warn-border); border-radius: var(--r-md); background: var(--warn-bg); color: var(--warn); font-size: var(--fs-md); }
  .wrong-address a { color: var(--warn); text-decoration: underline; }
  .shell { min-height: 100dvh; display: flex; flex-direction: column; }
  .sidebar { display: none; }
  .main { flex-grow: 1; display: flex; flex-direction: column; min-width: 0; padding-bottom: calc(68px + env(safe-area-inset-bottom)); }
  .topbar { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .fakesearch {
    flex-grow: 1; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 10px;
    border-radius: var(--r-lg); background: var(--surface-2); border: 1px solid var(--border-strong);
    color: var(--text-3); font-size: var(--fs-md);
  }
  .fakesearch span:nth-child(2) { flex-grow: 1; }
  .key { font-size: var(--fs-xs); padding: 1px 6px; border: 1px solid #2a2a2f; border-radius: 4px; }
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
      display: flex; flex-direction: column; gap: 12px; width: 264px; flex-shrink: 0; height: 100dvh; position: sticky; top: 0;
      padding: 16px 12px; border-right: 1px solid var(--border); background: var(--bg-sunken); overflow-y: auto;
    }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text); padding: 0 6px; }
    .logo { width: 22px; height: 22px; border-radius: 6px; background: var(--accent-soft); color: var(--accent-text); display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-sm); }
    .searchbtn {
      display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border-radius: var(--r-md);
      background: var(--surface-2); border: 1px solid var(--border-strong); color: var(--text-3); font-size: var(--fs-md);
    }
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
  }
</style>
