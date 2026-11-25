import { isAdmin } from "@/lib/auth";
import { addVisit, getVisits } from "@/lib/visits";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  return Response.json({ count: await getVisits() }, { headers });
}

// Called once per browser session; the admin's own visits and obvious bots are not counted.
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if ((await isAdmin()) || /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|curl/i.test(ua)) {
    return Response.json({ count: await getVisits() }, { headers });
  }
  try { return Response.json({ count: await addVisit() }, { headers }); }
  catch { return Response.json({ count: await getVisits() }, { headers }); }
}
