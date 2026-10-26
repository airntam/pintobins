<script lang="ts">
  import { iconFor } from '$lib/icons';
  import type { PlaceType } from '$lib/types';

  let { type, size = 14 }: { type: PlaceType | undefined; size?: number } = $props();
  const Icon = $derived(iconFor(type?.icon ?? 'box'));
</script>

<!-- flex-shrink: 0 keeps the icon at its set size next to long names in flex rows -->
<Icon {size} color={type?.color ?? '#8A8F98'} strokeWidth={1.6} aria-hidden="true" style="flex-shrink: 0" />
