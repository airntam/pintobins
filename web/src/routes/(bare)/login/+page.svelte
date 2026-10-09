<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
  let busy = $state(false);
</script>

<svelte:head><title>Sign in · Bins</title></svelte:head>

<main>
  <form
    method="post"
    use:enhance={() => {
      busy = true;
      return async ({ update }) => {
        await update({ reset: false });
        busy = false;
      };
    }}
  >
    <div class="brand"><span class="logo mono">#</span>Bins</div>
    <h1>Sign in</h1>

    <label for="email" class="section-label">Email</label>
    <input id="email" name="email" type="email" class="field" autocomplete="username" required value={form?.email ?? ''} />

    <label for="password" class="section-label">Password</label>
    <input id="password" name="password" type="password" class="field" autocomplete="current-password" required />

    {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

    <button class="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>
</main>

<style>
  main { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 16px; }
  form { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 8px; }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 8px; }
  .logo { width: 24px; height: 24px; border-radius: 6px; background: var(--accent-soft); color: var(--accent-text); display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-sm); }
  h1 { font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; margin-bottom: 8px; }
  label { margin-top: 8px; }
  .btn { margin-top: 16px; }
  .error { color: var(--remove); font-size: var(--fs-md); margin-top: 4px; }
</style>
