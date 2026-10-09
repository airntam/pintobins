<script lang="ts">
  import TypeIcon from './TypeIcon.svelte';
  import type { PlaceType } from '$lib/types';

  export interface Step {
    code: number;
    name: string;
    type: PlaceType | undefined;
  }
  let { steps, link = true, size = 13 }: { steps: Step[]; link?: boolean; size?: number } = $props();
</script>

<nav class="path" aria-label="Location">
  {#each steps as s, i}
    {#if i > 0}<span class="sep" aria-hidden="true">/</span>{/if}
    {#if link}
      <a href="/p/{s.code}"><TypeIcon type={s.type} {size} />{s.name}</a>
    {:else}
      <span class="step"><TypeIcon type={s.type} {size} />{s.name}</span>
    {/if}
  {/each}
</nav>

<style>
  .path { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--fs-sm); color: var(--text-3); }
  a, .step { display: inline-flex; align-items: center; gap: 5px; color: var(--text-3); }
  a { min-height: 24px; }
  a:hover { color: var(--text); }
  .sep { color: var(--sep); }
</style>
