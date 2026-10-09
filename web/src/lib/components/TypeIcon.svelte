<script lang="ts">
  import { iconFor } from '$lib/icons';
  import type { PlaceType } from '$lib/types';

  let { type, size = 14 }: { type: PlaceType | undefined; size?: number } = $props();
  const Icon = $derived(iconFor(type?.icon ?? 'box'));
</script>

<Icon {size} color={type?.color ?? '#8A8F98'} strokeWidth={1.6} aria-hidden="true" />
