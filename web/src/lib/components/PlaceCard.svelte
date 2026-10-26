<script lang="ts">
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import TypeTile from './TypeTile.svelte';
  import Photo from './Photo.svelte';
  import { pad4, type Place, type PlaceType } from '$lib/types';

  let {
    place,
    type,
    meta = ''
  }: { place: Omit<Place, 'label_snapshot'>; type: PlaceType | undefined; meta?: string } = $props();
</script>

<a class="card" href="/p/{place.code}">
  {#if place.photo}
    <span class="thumb"><Photo collection="places" id={place.id} file={place.photo} thumb="96x96" /></span>
  {:else}
    <TypeTile {type} />
  {/if}
  <span class="grow txt">
    <span class="name">{place.name}</span>
    {#if meta}<span class="meta">{meta}</span>{/if}
  </span>
  <span class="mono code">{pad4(place.code)}</span>
  <span class="chev" aria-hidden="true"><ChevronRight size={14} /></span>
</a>

<style>
  .thumb { width: 32px; height: 32px; border-radius: 7px; overflow: hidden; flex-shrink: 0; background: var(--surface-2); }
  .txt { display: flex; flex-direction: column; gap: 2px; }
  .code { font-size: var(--fs-sm); color: var(--text-3); }
  .meta { font-size: var(--fs-sm); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chev { display: flex; color: var(--text-4); }
</style>
