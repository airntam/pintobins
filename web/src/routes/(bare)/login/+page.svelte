<script lang="ts">
  import { enhance } from '$app/forms';

  let { form, data } = $props();
  let busy = $state(false);
  let failed = $state(false);
  // Login posts and the session cookie only work from the address set as PUBLIC_BASE_URL.
  let mismatch = $state(false);
  $effect(() => {
    mismatch = location.origin !== data.baseUrl;
  });
</script>

<svelte:head><title>Sign in · Bins</title></svelte:head>

<main>
  <form
    method="post"
    use:enhance={() => {
      busy = true;
      failed = false;
      return async ({ result, update }) => {
        // a rejected post (wrong address) comes back as an error, not a form message
        failed = result.type === 'error';
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

    {#if mismatch || failed}
      <p class="error" role="alert">
        You opened this page at <span class="mono">{location.origin}</span>, but the app is set up for
        <span class="mono">{data.baseUrl}</span>. Sign-in won't work from a different address. Open
        <span class="mono">{data.baseUrl}</span> instead, or change <span class="mono">PUBLIC_BASE_URL</span> in
        your <span class="mono">.env</span> and restart.
      </p>
    {/if}
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
