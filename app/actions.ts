"use server";
import { revalidatePath } from "next/cache";
import { checkCredentials, endSession, isAdmin, startSession } from "@/lib/auth";
import * as store from "@/lib/store";
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
export async function addPersonAction(relation: Relation, targetId: string, input: PersonInput): Promise<Result> {
  return guard(() => store.addPerson(relation, targetId, input));
}
export async function updatePersonAction(id: string, input: PersonInput): Promise<Result> {
  return guard(() => store.updatePerson(id, input));
}
export async function deletePersonAction(id: string): Promise<Result> {
  return guard(() => store.deletePerson(id));
}
