// Data layer. To go SaaS later, replace this file with a database-backed version
// exposing the same functions (add a tenantId argument).
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { get, put } from "@vercel/blob";
import { site } from "@/config/site";
import type { FamilyData, Person, PersonInput, Relation } from "./types";

const file = () => path.resolve(process.cwd(), site.dataFile);
let queue: Promise<unknown> = Promise.resolve();

// Storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set (hosted), else the local JSON file (dev/VPS).
const blobToken = () =>
  process.env.BLOB_READ_WRITE_TOKEN ||
  Object.entries(process.env).find(([k, v]) => k.endsWith("READ_WRITE_TOKEN") && v)?.[1];
// Keyless mode: Vercel sets BLOB_STORE_ID and the SDK authenticates with the deployment OIDC token.
const useBlob = () => !!blobToken() || !!process.env.BLOB_STORE_ID;
const BLOB_NAME = "family.json";
const seed = async () => JSON.parse(await fs.readFile(path.resolve(process.cwd(), "data/family.json"), "utf8")) as FamilyData;

async function writeBlob(data: FamilyData) {
  await put(BLOB_NAME, JSON.stringify(data, null, 2), {
    token: blobToken(), access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
}

export async function readData(): Promise<FamilyData> {
  if (useBlob()) {
    const res = await get(BLOB_NAME, { token: blobToken(), access: "private", useCache: false });
    if (!res || res.statusCode !== 200) { const d = await seed(); await writeBlob(d); return d; }
    return JSON.parse(await new Response(res.stream).text()) as FamilyData;
  }
  return JSON.parse(await fs.readFile(file(), "utf8")) as FamilyData;
}

async function writeData(data: FamilyData) {
  if (!useBlob() && process.env.VERCEL) {
    const names = Object.keys(process.env).filter((k) => /blob|store/i.test(k));
    throw new Error(`No Blob token in this deployment (env=${process.env.VERCEL_ENV}, commit=${(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7)}). Blob-like env names: ${names.join(", ") || "none"}`);
  }
  if (useBlob()) return writeBlob(data);
  const tmp = file() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file());
}

function mutate<T>(fn: (d: FamilyData) => T): Promise<T> {
  const run = queue.then(async () => {
    const d = await readData();
    const r = fn(d);
    await writeData(d);
    return r;
  });
  queue = run.catch(() => undefined);
  return run;
}

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
function clean(input: PersonInput) {
  const nameEn = input.nameEn.trim();
  if (!nameEn) throw new Error("English name is required");
  for (const v of [input.birth, input.death]) {
    if (v && !DATE.test(v)) throw new Error("Dates must look like 2018, 2018-06 or 2018-06-27");
  }
  return {
    name: { en: nameEn, ...(input.nameGu?.trim() ? { gu: input.nameGu.trim() } : {}) },
    gender: input.gender,
    ...(input.birth ? { birth: input.birth } : {}),
    ...(input.death ? { death: input.death } : {}),
  };
}

export function addPerson(relation: Relation, targetId: string, input: PersonInput) {
  return mutate((d) => {
    const t = d.people.find((p) => p.id === targetId);
    if (!t) throw new Error("Person not found");
    const p: Person = { id: randomUUID().slice(0, 8), ...clean(input) };
    if (relation === "child") p.parentId = t.id;
    else if (relation === "spouse") {
      if (t.spouseId) throw new Error("This person already has a spouse");
      p.spouseId = t.id;
      t.spouseId = p.id;
    } else if (relation === "parent") {
      if (t.parentId) throw new Error("Parent already exists. Add a spouse to the existing parent instead");
      t.parentId = p.id;
    } else if (relation === "sibling") {
      if (!t.parentId) throw new Error("Add parents first, then siblings");
      p.parentId = t.parentId;
    }
    d.people.push(p);
    return p.id;
  });
}

export function updatePerson(id: string, input: PersonInput) {
  return mutate((d) => {
    const p = d.people.find((x) => x.id === id);
    if (!p) throw new Error("Person not found");
    const c = clean(input);
    p.name = c.name;
    p.gender = c.gender;
    if (c.birth) p.birth = c.birth; else delete p.birth;
    if (c.death) p.death = c.death; else delete p.death;
  });
}

export function deletePerson(id: string) {
  return mutate((d) => {
    const p = d.people.find((x) => x.id === id);
    if (!p) throw new Error("Person not found");
    if (d.people.length <= 1) throw new Error("Cannot delete the last person");
    const unitIds = [p.id, p.spouseId];
    if (d.people.some((x) => x.parentId && unitIds.includes(x.parentId) && x.id !== p.id)) {
      throw new Error("Remove their children first");
    }
    d.people = d.people.filter((x) => x.id !== id);
    for (const x of d.people) {
      if (x.spouseId === id) delete x.spouseId;
      if (x.parentId === id) delete x.parentId;
    }
  });
}

// ---- Photos: one WebP (max 800px) per person, in Blob (private) or data/photos locally ----
const photoDir = () => path.join(path.dirname(file()), "photos");
const photoKey = (id: string) => `photos/${id}.webp`;
export const validId = (id: string) => /^[a-z0-9-]{4,40}$/i.test(id);

export async function readPhoto(id: string): Promise<Buffer | null> {
  if (!validId(id)) return null;
  try {
    if (useBlob()) {
      const res = await get(photoKey(id), { token: blobToken(), access: "private" });
      if (!res || res.statusCode !== 200) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    }
    return await fs.readFile(path.join(photoDir(), `${id}.webp`));
  } catch { return null; }
}

export async function setPhoto(id: string, image: Buffer) {
  if (!validId(id)) throw new Error("Bad id");
  const sharp = (await import("sharp")).default;
  const webp = await sharp(image, { failOn: "none" }).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  if (useBlob()) {
    await put(photoKey(id), webp, { token: blobToken(), access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp" });
  } else {
    await fs.mkdir(photoDir(), { recursive: true });
    await fs.writeFile(path.join(photoDir(), `${id}.webp`), webp);
  }
  await mutate((d) => {
    const p = d.people.find((x) => x.id === id);
    if (!p) throw new Error("Person not found");
    p.photo = `/photo/${id}?v=${Date.now()}`;
  });
}

export async function removePhoto(id: string) {
  await mutate((d) => {
    const p = d.people.find((x) => x.id === id);
    if (!p) throw new Error("Person not found");
    delete p.photo;
  });
}
