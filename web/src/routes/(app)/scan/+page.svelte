<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import jsQR from 'jsqr';
  import ScanLine from 'lucide-svelte/icons/scan-line';

  let video: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | null = null;
  let frame = 0;
  let canvas: HTMLCanvasElement | null = null;
  let status = $state<'starting' | 'scanning' | 'blocked' | 'unsupported'>('starting');
  let notOurs = $state('');
  let code = $state('');

  /** "https://bin.clevernaut.com/p/42" (or any host) → 42 */
  function codeFrom(text: string): number | null {
    const m = /\/p\/#?(\d+)\/?(?:[?#].*)?$/.exec(text.trim());
    return m ? parseInt(m[1], 10) : null;
  }

  function tick() {
    if (!video || video.readyState < 2) return (frame = requestAnimationFrame(tick));
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas ??= document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    if (hit) {
      const c = codeFrom(hit.data);
      if (c) {
        stop();
        goto(`/p/${c}`);
        return;
      }
      notOurs = hit.data;
    }
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return (status = 'unsupported');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      status = 'scanning';
      frame = requestAnimationFrame(tick);
    } catch {
      status = 'blocked';
    }
  }
  // onMount only runs in the browser; its cleanup stops the camera when leaving the page.
  onMount(() => {
    start();
    return stop;
  });

  function openCode(e: SubmitEvent) {
    e.preventDefault();
    const n = parseInt(code.replace(/\D/g, ''), 10);
    if (n > 0) goto(`/p/${n}`);
  }
</script>

<svelte:head><title>Scan · Bins</title></svelte:head>

<div class="page">
  <h1>Scan a label</h1>
  <div class="viewer">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted></video>
    {#if status === 'scanning'}
      <span class="frame" aria-hidden="true"></span>
    {:else}
      <div class="msg">
        <ScanLine size={28} />
        {#if status === 'starting'}
          Starting the camera…
        {:else if status === 'blocked'}
          Camera access was blocked. Allow it for this site, or type the code below.
        {:else}
          This browser can't use the camera here. Type the code below, or scan with the phone's camera app.
        {/if}
      </div>
    {/if}
  </div>
  <p class="hint" role="status">
    {notOurs ? 'That QR code isn’t a Bins label.' : 'Point the camera at the QR code on a label.'}
  </p>

  <form class="manual" onsubmit={openCode}>
    <label for="code" class="section-label">Or type a code</label>
    <div class="row">
      <input id="code" class="field mono" inputmode="numeric" placeholder="#0042" bind:value={code} autocomplete="off" />
      <button type="submit" class="btn">Open</button>
    </div>
  </form>
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  h1 { font-size: var(--fs-2xl); font-weight: 600; letter-spacing: -0.015em; }
  .viewer { position: relative; aspect-ratio: 3 / 4; max-height: 60vh; border-radius: var(--r-xl); overflow: hidden; background: var(--bg-sunken); border: 1px solid var(--border); }
  video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .frame { position: absolute; inset: 22%; border: 2px solid rgba(255, 255, 255, .85); border-radius: 14px; }
  .msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center; color: var(--text-3); font-size: var(--fs-md); }
  .hint { font-size: var(--fs-md); color: var(--text-3); }
  .manual { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; gap: 8px; }
  @media (min-width: 900px) { .viewer { max-width: 420px; } }
</style>
