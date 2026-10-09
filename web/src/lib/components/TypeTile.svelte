<script lang="ts">
  import { iconFor } from '$lib/icons';
  import type { PlaceType } from '$lib/types';

  let { type, size = 32 }: { type: PlaceType | undefined; size?: number } = $props();
  const Icon = $derived(iconFor(type?.icon ?? 'box'));
  const color = $derived(type?.color ?? '#8A8F98');
</script>

<span class="tile" style:width="{size}px" style:height="{size}px" style:background="{color}24">
  <Icon size={Math.round(size * 0.56)} {color} strokeWidth={1.6} aria-hidden="true" />
</span>

<style>
  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    flex-shrink: 0;
  }
</style>
