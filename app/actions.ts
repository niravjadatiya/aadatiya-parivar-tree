"use server";
import { revalidatePath } from "next/cache";
import { checkCredentials, endSession, isAdmin, startSession } from "@/lib/auth";
import * as store from "@/lib/store";
import { applyJson, type Report } from "@/lib/bulk";
import type { PersonInput, Relation } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

async function guard(fn: () => Promise<unknown>): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorised" };
  try { await fn(); revalidatePath("/"); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }; }
}

export async function loginAction(username: string, password: string): Promise<Result> {
  await new Promise((r) => setTimeout(r, 600)); // slow down guessing
  if (!checkCredentials(username, password)) return { ok: false, error: "wrong" };
  await startSession();
  return { ok: true };
}
export async function logoutAction() { await endSession(); revalidatePath("/"); }
export async function addPersonAction(relation: Relation, targetId: string, input: PersonInput): Promise<Result & { id?: string }> {
  let id: string | undefined;
  const r = await guard(async () => { id = await store.addPerson(relation, targetId, input); });
  return r.ok ? { ok: true, id } : r;
}
export async function setPhotoAction(id: string, form: FormData): Promise<Result> {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No photo" };
  if (file.size > 4_000_000) return { ok: false, error: "Photo too large" };
  return guard(async () => store.setPhoto(id, Buffer.from(await file.arrayBuffer())));
}
export async function removePhotoAction(id: string): Promise<Result> {
  return guard(() => store.removePhoto(id));
}
export async function updatePersonAction(id: string, input: PersonInput): Promise<Result> {
  return guard(() => store.updatePerson(id, input));
}
export async function deletePersonAction(id: string): Promise<Result> {
  return guard(() => store.deletePerson(id));
}

export type ImportResult = { ok: boolean; error?: string; report?: Report; applied?: boolean };
async function runImport(text: string, apply: boolean, remove: boolean): Promise<ImportResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorised" };
  if (typeof text !== "string" || text.length > 2_000_000) return { ok: false, error: "File too large" };
  try {
    const preview = applyJson(structuredClone(await store.readData()), text, remove);
    if (!apply || preview.errors.length) return { ok: !preview.errors.length, report: preview };
    const report = await store.mutate((d) => applyJson(d, text, remove));
    revalidatePath("/");
    return { ok: true, report, applied: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }; }
}
export async function importPreviewAction(text: string, remove = false) { return runImport(text, false, !!remove); }
export async function importApplyAction(text: string, remove = false) { return runImport(text, true, !!remove); }
