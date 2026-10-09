<script lang="ts">
  import { toasts, dismiss } from '$lib/toast.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast" class:error={t.error}>
      <span class="msg">{t.message}</span>
      {#if t.undo}
        <button
          type="button"
          class="undo"
          onclick={async () => {
            dismiss(t.id);
            await t.undo?.();
          }}>Undo</button
        >
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed; left: 50%; transform: translateX(-50%);
    bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 50;
    display: flex; flex-direction: column; gap: 8px; width: min(92vw, 420px); pointer-events: none;
  }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 8px 8px 8px 16px;
    border-radius: var(--r-lg); background: var(--surface-hover); border: 1px solid var(--border-strong);
    font-size: var(--fs-md);
  }
  .toast.error { border-color: var(--warn-border); color: var(--remove); }
  .msg { flex-grow: 1; }
  .undo { height: 32px; padding: 0 12px; border: 0; border-radius: var(--r-md); background: var(--accent-soft); color: var(--accent-text); font-weight: 500; }
  @media (min-width: 900px) { .toasts { bottom: 24px; } }
</style>
