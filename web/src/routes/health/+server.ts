import { newPb } from '$lib/server/pb';

// Liveness for Docker: web is up and PocketBase answers.
export async function GET() {
  try {
    const res = await fetch(`${newPb().baseURL}/api/health`);
    if (!res.ok) throw new Error(String(res.status));
    return new Response('ok');
  } catch {
    return new Response('pocketbase unreachable', { status: 503 });
  }
}
