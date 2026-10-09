<script lang="ts">
  let {
    collection,
    id,
    file,
    thumb = '',
    alt = '',
    cover = true
  }: { collection: string; id: string; file: string; thumb?: string; alt?: string; cover?: boolean } = $props();
  const src = $derived(`/img/${collection}/${id}/${encodeURIComponent(file)}${thumb ? `?thumb=${thumb}` : ''}`);
</script>

<img {src} {alt} loading="lazy" style:object-fit={cover ? 'cover' : 'contain'} />

<style>
  img { width: 100%; height: 100%; display: block; }
</style>
