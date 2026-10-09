<script lang="ts">
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
  <span class="grow name">{place.name}</span>
  <span class="mono code">{pad4(place.code)}</span>
  {#if meta}<span class="meta">{meta}</span>{/if}
</a>

<style>
  .thumb { width: 32px; height: 32px; border-radius: 7px; overflow: hidden; flex-shrink: 0; background: var(--surface-2); }
  .code { font-size: var(--fs-sm); color: var(--text-3); }
  .meta { font-size: var(--fs-sm); color: var(--text-3); min-width: 12px; text-align: right; }
</style>
