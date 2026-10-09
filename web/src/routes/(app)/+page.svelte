<script lang="ts">
  import Plus from 'lucide-svelte/icons/plus';
  import PlaceCard from '$lib/components/PlaceCard.svelte';

  let { data } = $props();
  const typeById = $derived(new Map(data.types.map((t) => [t.id, t])));
</script>

<svelte:head><title>Browse · Bins</title></svelte:head>

<div class="page">
  <header>
    <h1>Browse</h1>
    <a class="btn primary" href="/new"><Plus size={16} />New place</a>
  </header>

  {#if data.places.length}
    <ul class="list">
      {#each data.places as { place, meta } (place.id)}
        <li><PlaceCard {place} type={typeById.get(place.type)} {meta} /></li>
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <p class="title">No places yet</p>
      <p>Start with where things live, like your home or garage, then add rooms, shelves and bins inside it.</p>
      <a class="btn primary" href="/new"><Plus size={16} />Add your first place</a>
    </div>
  {/if}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; }
  .list { display: flex; flex-direction: column; gap: 8px; }
</style>
