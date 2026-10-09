import { one } from "@/lib/db";
import { streamRecording } from "@/lib/vaani";

export const runtime = "nodejs";

/** Plays a call recording without exposing the Vaani key or the storage URL to the browser. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const call = await one<{ vaani_call_id: string; recording_url: string | null }>("select vaani_call_id, recording_url from calls where id = $1", [id]);
  if (!call) return new Response("Not found", { status: 404 });
  let upstream: Response | null = null;
  try { upstream = await streamRecording(call.vaani_call_id); } catch { upstream = null; }
  if ((!upstream || !upstream.ok) && call.recording_url) upstream = await fetch(call.recording_url);
  if (!upstream || !upstream.ok || !upstream.body) return new Response("Recording not available yet", { status: 404 });
  return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("content-type") || "audio/mpeg", "Cache-Control": "private, max-age=300" } });
}
