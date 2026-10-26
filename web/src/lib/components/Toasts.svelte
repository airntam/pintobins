<script lang="ts">
  import { toasts, dismiss } from '$lib/toast.svelte';

  // Ctrl+Z (Cmd+Z) undoes the newest toast's change, unless you're typing in a field.
  function onkeydown(e: KeyboardEvent) {
    if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
    const last = toasts.findLast((x) => x.undo);
    if (!last) return;
    e.preventDefault();
    dismiss(last.id);
    last.undo?.();
  }
</script>

<svelte:window {onkeydown} />
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
        ><span class="mono kbd" aria-hidden="true">Ctrl Z</span>
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
  /* Sit above the docked "Add item" field on a place page */
  :global(body:has(.add-dock)) .toasts { bottom: calc(136px + env(safe-area-inset-bottom)); }
  .kbd { display: none; font-size: var(--fs-xs); color: var(--text-3); }
  @media (min-width: 900px) {
    .toasts, :global(body:has(.add-dock)) .toasts { bottom: 24px; }
    .kbd { display: inline; padding-right: 6px; }
  }
</style>
