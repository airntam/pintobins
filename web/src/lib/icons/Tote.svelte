<script lang="ts">
  // Custom icon drawn in the same style as Lucide (24px grid, 1.6 stroke), from the design mockups.
  let { size = 24, color = 'currentColor', strokeWidth = 1.6, ...rest }: Record<string, any> = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" {...rest}><path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" /></svg>
