<script lang="ts">
  import { goto } from '$app/navigation';
  import Search from 'lucide-svelte/icons/search';
  import X from 'lucide-svelte/icons/x';
  import Chips from '$lib/components/Chips.svelte';
  import Path from '$lib/components/Path.svelte';
  import TypeTile from '$lib/components/TypeTile.svelte';
  import { pad4 } from '$lib/types';

  let { data } = $props();
  let value = $state(data.q);
  let timer: ReturnType<typeof setTimeout>;
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));
  const total = $derived(data.items.length + data.places.length);

  // keep the box in sync when navigating back/forward
  $effect(() => {
    value = data.q;
  });

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      goto(value.trim() ? `/search?q=${encodeURIComponent(value)}` : '/search', {
        replaceState: true,
        keepFocus: true,
        noScroll: true
      });
    }, 150);
  }
  function clear() {
    value = '';
    onInput();
    document.getElementById('q')?.focus();
  }
</script>

<svelte:head><title>{data.q ? `${data.q} · ` : ''}Search · Bins</title></svelte:head>

<header>
  <label for="q" class="sr-only">Search</label>
  <div class="box">
    <Search size={16} />
    <!-- svelte-ignore a11y_autofocus -->
    <input id="q" type="search" bind:value oninput={onInput} placeholder="Search places, items, details" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus />
    {#if value}
      <button type="button" aria-label="Clear search" onclick={clear}><X size={14} /></button>
    {/if}
  </div>
  {#if data.q}
    <p class="summary">
      {total} result{total === 1 ? '' : 's'}{#if data.also.length}
        · also matches {#each data.also as v, i}{i ? ' and ' : ''}“{v}”{/each}{/if}
    </p>
  {/if}
</header>

<main>
  {#if !data.q}
    <div class="empty">
      <p class="title">Search everything</p>
      <p>Place names, notes, item names and details. “m8x10” finds “M8 × 10”.</p>
    </div>
  {:else if !total}
    <div class="empty">
      <p class="title">Nothing matches “{data.q}”</p>
      <p>Check the spelling, or try fewer words.</p>
    </div>
  {:else}
    {#if data.items.length}
      <section>
        <h2 class="section-label">Items</h2>
        <ul class="panel">
          {#each data.items as it (it.id)}
            <li>
              <a href="/p/{it.code}" class="res">
                <span class="nm">{it.name}</span>
                <Chips chips={it.chips} hit={data.q} max={5} />
                <span class="where"><Path steps={it.path} link={false} size={12} /></span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    {#if data.places.length}
      <section>
        <h2 class="section-label">Places</h2>
        <ul class="plist">
          {#each data.places as { place, note } (place.id)}
            <li>
              <a class="card" href="/p/{place.code}">
                <TypeTile type={typeById.get(place.type)} />
                <span class="grow">
                  <span class="name">{place.name}</span>
                  {#if note}<span class="note">{note}</span>{/if}
                </span>
                <span class="mono code">{pad4(place.code)}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</main>

<style>
  header { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--border); }
  .box {
    height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 12px; border-radius: var(--r-lg);
    background: var(--surface-2); border: 1px solid var(--border-strong); color: var(--text-2);
  }
  .box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 106, 210, .18); }
  .box input { flex-grow: 1; border: 0; background: transparent; outline: none; font-size: var(--fs-lg); box-shadow: none; }
  .box input::-webkit-search-cancel-button { display: none; }
  .box button { width: 32px; height: 32px; border: 0; border-radius: var(--r-md); background: transparent; color: var(--text-3); display: flex; align-items: center; justify-content: center; }
  .summary { font-size: var(--fs-sm); color: var(--text-3); }
  main { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
  section { display: flex; flex-direction: column; gap: 8px; }
  .panel li { border-bottom: 1px solid var(--border); }
  .panel li:last-child { border-bottom: 0; }
  .res { display: flex; flex-direction: column; gap: 6px; padding: 12px; color: var(--text); }
  .res:hover { background: var(--surface-hover); }
  .nm { font-weight: 500; }
  .where { font-size: var(--fs-sm); }
  .plist { display: flex; flex-direction: column; gap: 8px; }
  .name { display: block; }
  .note { display: block; font-size: var(--fs-sm); color: var(--text-3); }
  .code { font-size: var(--fs-sm); color: var(--text-3); }
</style>
