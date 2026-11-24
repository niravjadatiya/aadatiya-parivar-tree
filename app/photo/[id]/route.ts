import { readPhoto } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const size = new URL(req.url).searchParams.get("s") === "thumb" ? "thumb" : "full";
  const buf = await readPhoto(id, size);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
