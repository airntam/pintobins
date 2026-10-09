<script lang="ts">
  import { normalize } from '$lib/search';

  let {
    chips,
    hit = '',
    max = 0
  }: { chips: string[]; hit?: string; max?: number } = $props();

  const q = $derived(normalize(hit));
  const shown = $derived(max && chips.length > max ? chips.slice(0, max) : chips);
  const rest = $derived(chips.length - shown.length);
</script>

{#if chips.length}
  <div class="chips">
    {#each shown as c}
      <span class="chip" class:hit={q && normalize(c).includes(q)}>{c}</span>
    {/each}
    {#if rest > 0}<span class="chip more">+{rest}</span>{/if}
  </div>
{/if}

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
</style>
