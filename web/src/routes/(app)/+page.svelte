<script lang="ts">
  import Plus from 'lucide-svelte/icons/plus';
  import Search from 'lucide-svelte/icons/search';
  import ScanLine from 'lucide-svelte/icons/scan-line';
  import Printer from 'lucide-svelte/icons/printer';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import TypeTile from '$lib/components/TypeTile.svelte';
  import TypeIcon from '$lib/components/TypeIcon.svelte';
  import Photo from '$lib/components/Photo.svelte';
  import { pad4 } from '$lib/types';

  let { data } = $props();
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));
  const KIDS_SHOWN = 4;
</script>

<svelte:head><title>Browse · Bins</title></svelte:head>

<div class="page">
  <header class="top">
    <h1>Browse</h1>
    <form class="search" action="/search" method="get" role="search">
      <Search size={16} />
      <input name="q" data-search-input aria-label="Search everything" placeholder="Search items, places or codes" autocomplete="off" enterkeyhint="search" />
      <span class="mono key" aria-hidden="true">/</span>
    </form>
    <a class="btn primary scan" href="/scan"><ScanLine size={18} />Scan</a>
    <a class="btn icon new-ph" href="/new" aria-label="New place"><Plus size={18} /></a>
    <a class="btn primary new-dt" href="/new"><Plus size={16} />New place</a>
  </header>

  {#if data.outdated.length}
    <a class="stale" href="/print">
      <Printer size={15} />
      <span class="grow"
        >{data.outdated.length === 1
          ? `1 label is out of date: ${data.outdated[0].name} changed since it was printed`
          : `${data.outdated.length} labels are out of date`}</span
      >
      <span>Review</span>
    </a>
  {/if}

  {#if data.recent.length}
    <section class="sec" aria-labelledby="recent">
      <h2 id="recent" class="section-label">Recently opened</h2>
      <ul class="recent">
        {#each data.recent as r (r.place.id)}
          {@const type = typeById.get(r.place.type)}
          <li>
            <a class="rcard" href="/p/{r.place.code}">
              <span class="rthumb" style:background="{type?.color ?? '#8A8F98'}24">
                {#if r.place.photo}
                  <Photo collection="places" id={r.place.id} file={r.place.photo} thumb="400x300" />
                {:else}
                  <span class="ricon"><TypeIcon {type} size={28} /></span>
                {/if}
              </span>
              <span class="rbody">
                <span class="rtop"><span class="rname">{r.place.name}</span><span class="mono code">{pad4(r.place.code)}</span></span>
                <span class="meta">{[r.parent, r.rollup].filter(Boolean).join(' · ')}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#each data.groups as g (g.place.id)}
    <section class="sec" aria-labelledby="g-{g.place.id}">
      <div class="ghead">
        <TypeTile type={typeById.get(g.place.type)} size={24} />
        <h2 id="g-{g.place.id}"><a href="/p/{g.place.code}">{g.place.name}</a></h2>
        <span class="mono code">{pad4(g.place.code)}</span>
        {#if g.rollup}<span class="meta gsum">{g.rollup}</span>{/if}
      </div>
      {#if g.children.length}
        <ul class="rooms">
          {#each g.children as c (c.place.id)}
            <li>
              <a class="room" href="/p/{c.place.code}">
                <span class="rhead">
                  {#if c.place.photo}
                    <span class="thumb"><Photo collection="places" id={c.place.id} file={c.place.photo} thumb="96x96" /></span>
                  {:else}
                    <TypeTile type={typeById.get(c.place.type)} />
                  {/if}
                  <span class="rcol">
                    <span class="rname">{c.place.name}</span>
                    <span class="mono code dt">{pad4(c.place.code)}</span>
                    {#if c.rollup}<span class="meta ph">{c.rollup}</span>{/if}
                  </span>
                  <span class="mono code ph">{pad4(c.place.code)}</span>
                  <span class="chev ph" aria-hidden="true"><ChevronRight size={14} /></span>
                </span>
                {#if c.kids.length}
                  <span class="kids dt">
                    {#each c.kids.slice(0, KIDS_SHOWN) as k (k.code)}
                      <span class="kid"><TypeIcon type={typeById.get(k.type)} size={13} /><span class="kname">{k.name}</span></span>
                    {/each}
                    {#if c.kids.length > KIDS_SHOWN}<span class="kid more">+ {c.kids.length - KIDS_SHOWN} more</span>{/if}
                  </span>
                {/if}
                {#if c.rollup}<span class="meta dt">{c.rollup}</span>{/if}
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">Nothing inside yet. <a href="/new?parent={g.place.code}">Add a place inside</a></p>
      {/if}
    </section>
  {:else}
    <div class="empty">
      <p class="title">No places yet</p>
      <p>Start with where things live, like your home or garage, then add rooms, shelves and bins inside it.</p>
      <a class="btn primary" href="/new"><Plus size={16} />Add your first place</a>
    </div>
  {/each}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
  .top { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'h new' 'search scan'; gap: 12px 8px; align-items: center; }
  h1 { grid-area: h; font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; }
  .search {
    grid-area: search; display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 12px; min-width: 0;
    border: 1px solid var(--border-strong); border-radius: var(--r-xl); background: var(--surface-2); color: var(--text-3);
  }
  .search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
  .search input { flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; outline: none; color: var(--text); font-size: 15px; }
  .search input:focus-visible { box-shadow: none; }
  .key { display: none; font-size: var(--fs-xs); padding: 1px 6px; border: 1px solid #2a2a2f; border-radius: 4px; }
  .scan { grid-area: scan; height: 48px; border-radius: var(--r-xl); }
  .new-ph { grid-area: new; justify-self: end; }
  .new-dt { display: none; }

  .stale {
    display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 12px; border-radius: var(--r-lg);
    border: 1px solid var(--warn-border); background: var(--warn-bg); color: var(--warn); font-size: var(--fs-md);
  }
  .stale:hover { color: var(--warn); border-color: #5A4720; }
  .grow { flex-grow: 1; }
  .sec { display: flex; flex-direction: column; gap: 8px; }
  .code { font-size: var(--fs-sm); color: var(--text-3); }
  .meta { font-size: var(--fs-sm); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint { font-size: var(--fs-sm); color: var(--text-3); }

  /* Recently opened: a swipeable row on phone, a grid of photo cards on desktop */
  .recent { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; margin: 0 -16px; padding: 0 16px 4px; scrollbar-width: none; }
  .recent li { flex: 0 0 148px; min-width: 0; scroll-snap-align: start; }
  .rcard {
    height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 12px; color: var(--text);
    border: 1px solid var(--border); border-radius: var(--r-xl); background: var(--surface);
  }
  .rcard:hover { background: var(--surface-hover); color: var(--text); }
  .rthumb { width: 32px; height: 32px; border-radius: 7px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ricon { display: flex; transform: scale(.6); }
  .rbody { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .rtop { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rname { font-weight: 500; font-size: var(--fs-md); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }

  /* A top-level place and what's in it */
  .ghead { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .ghead h2 { font-size: var(--fs-md); font-weight: 500; color: var(--text-2); }
  .ghead h2 a { color: inherit; }
  .gsum { margin-left: auto; padding-left: 8px; }
  .rooms { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--r-xl); background: var(--surface); overflow: hidden; }
  .rooms li + li { border-top: 1px solid var(--border); }
  .room { display: flex; flex-direction: column; gap: 12px; padding: 0 12px; color: var(--text); }
  .room:hover { background: var(--surface-hover); color: var(--text); }
  .rhead { display: flex; align-items: center; gap: 12px; min-height: 60px; }
  .rcol { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .thumb { width: 32px; height: 32px; border-radius: 7px; overflow: hidden; flex-shrink: 0; background: var(--surface-2); }
  .chev { display: flex; color: var(--text-4); }
  .dt { display: none !important; }
  .kids { flex-direction: column; gap: 6px; }
  .kid { display: flex; align-items: center; gap: 6px; font-size: var(--fs-md); color: var(--text-2); min-width: 0; }
  .kname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kid.more { color: var(--text-3); padding-left: 19px; }

  @media (min-width: 900px) {
    .page { padding: 16px 0; gap: 28px; }
    .top { display: flex; flex-wrap: wrap; gap: 12px; }
    h1 { flex-grow: 1; }
    .search { flex: 0 1 380px; height: 36px; border-radius: var(--r-lg); }
    .search input { font-size: var(--fs-md); }
    .key { display: inline; }
    .scan, .new-ph { display: none; }
    .new-dt { display: inline-flex; }

    /* one row only: extra cards go into zero-height rows */
    .recent { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); grid-template-rows: auto; grid-auto-rows: 0; column-gap: 12px; row-gap: 0; margin: 0; padding: 0; overflow: hidden; }
    .rcard { padding: 0; gap: 0; overflow: hidden; }
    .rthumb { width: 100%; height: 96px; border-radius: 0; border-bottom: 1px solid var(--border); }
    .ricon { transform: none; }
    .rbody { padding: 10px 12px; }
    .rtop { flex-direction: row; align-items: center; gap: 6px; }
    .rtop .code { margin-left: auto; font-size: var(--fs-xs); }
    .rname { display: block; text-overflow: ellipsis; white-space: nowrap; }

    .ghead h2 { font-size: var(--fs-lg); font-weight: 600; color: var(--text); }
    .rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; border: 0; background: transparent; overflow: visible; }
    .rooms li + li { border-top: 0; }
    .room { height: 100%; padding: 14px; border: 1px solid var(--border); border-radius: var(--r-xl); background: var(--surface); }
    .rhead { min-height: 0; }
    .ph { display: none !important; }
    .dt { display: flex !important; }
    .room > .meta.dt { display: block !important; margin-top: auto; }
  }
</style>
