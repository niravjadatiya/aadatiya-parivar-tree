// Tiny visitor counter. Blob `visits.json` when hosted, else data/visits.json locally.
// Not transactional: two simultaneous visits can occasionally count once. Fine for a family site.
import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";

const token = () =>
  process.env.BLOB_READ_WRITE_TOKEN || Object.entries(process.env).find(([k, v]) => k.endsWith("READ_WRITE_TOKEN") && v)?.[1];
const useBlob = () => !!token() || !!process.env.BLOB_STORE_ID;
const local = () => path.resolve(process.cwd(), "data/visits.json");
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<number> {
  try {
    if (useBlob()) {
      const res = await get("visits.json", { token: token(), access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return 0;
      return Number(JSON.parse(await new Response(res.stream).text()).count) || 0;
    }
    return Number(JSON.parse(await fs.readFile(local(), "utf8")).count) || 0;
  } catch { return 0; }
}
async function write(count: number) {
  const body = JSON.stringify({ count });
  if (useBlob()) await put("visits.json", body, { token: token(), access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  else await fs.writeFile(local(), body);
}

export const getVisits = read;
export function addVisit(): Promise<number> {
  const run = queue.then(async () => { const n = (await read()) + 1; await write(n); return n; });
  queue = run.catch(() => undefined);
  return run;
}
