import { isAdmin } from "@/lib/auth";
import { exportJson } from "@/lib/bulk";
import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new Response("Not authorised", { status: 401 });
  const json = exportJson(await readData());
  const day = new Date().toISOString().slice(0, 10);
  return new Response(json, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="family-${day}.json"`, "Cache-Control": "no-store" },
  });
}
