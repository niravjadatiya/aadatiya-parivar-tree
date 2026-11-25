// Bulk export / import of the family data as JSON (same shape as data/family.json).
// Each person in an uploaded file replaces that person (matched by id); new ids are added.
// People missing from the file are kept unless the admin explicitly asks to remove them.
import { randomUUID } from "crypto";
import { clean, validId } from "./store";
import type { FamilyData, Person, PersonInput } from "./types";

export const exportJson = (d: FamilyData) => JSON.stringify(d, null, 2) + "\n";

export type Report = { errors: string[]; added: string[]; updated: string[]; removed: string[]; unchanged: number; rows: number };

// Stable JSON (sorted keys) so key order never looks like a change.
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// Applies the JSON to `d` (mutates it). Callers run it on a clone for a preview.
export function applyJson(d: FamilyData, text: string, remove = false): Report {
  const rep: Report = { errors: [], added: [], updated: [], removed: [], unchanged: 0, rows: 0 };
  let data: unknown;
  try { data = JSON.parse(text.replace(/^﻿/, "")); } catch (e) { rep.errors.push(`This is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`); return rep; }
  const list = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.people) ? data.people : null;
  if (!list) { rep.errors.push('Expected {"people": [ ... ]} like the exported file.'); return rep; }
  if (list.length > 5000) { rep.errors.push("Too many people (limit 5000)."); return rep; }
  rep.rows = list.length;

  const before = new Map(d.people.map((p) => [p.id, canon(p)]));
  const byId = new Map(d.people.map((p) => [p.id, p]));
  const entries: { raw: Record<string, unknown>; p: Person; isNew: boolean; label: string }[] = [];
  const seen = new Set<string>();

  // pass 1: validate and write each person's own fields
  list.forEach((raw: unknown, i: number) => {
    const where = `Person ${i + 1}`;
    if (!isObj(raw)) { rep.errors.push(`${where}: not an object.`); return; }
    let id = str(raw.id).trim();
    if (id && !byId.has(id) && !validId(id)) { rep.errors.push(`${where}: id "${id}" is not valid for a new person (letters, digits and dashes, 4 to 40 characters, or leave it out).`); return; }
    if (id && seen.has(id)) { rep.errors.push(`${where}: id "${id}" appears more than once.`); return; }
    const name = isObj(raw.name) ? raw.name : {};
    const label = `${where} (${str(name.en) || "no name"})`;
    const g = str(raw.gender).toLowerCase();
    if (g !== "male" && g !== "female") { rep.errors.push(`${label}: gender must be "male" or "female".`); return; }
    const businesses = Array.isArray(raw.businesses) ? raw.businesses.filter(isObj).map((b) => ({ name: str(b.name), about: str(b.about), phone: str(b.phone), email: str(b.email), website: str(b.website), city: str(b.city), public: b.public === true })) : undefined;
    const input: PersonInput = {
      nameEn: str(name.en), nameGu: str(name.gu), gender: g, birth: str(raw.birth) || undefined, death: str(raw.death) || undefined,
      city: str(raw.city) || undefined, phone: str(raw.phone) || undefined, phonePublic: raw.phonePublic === true, businesses,
    };
    let c: ReturnType<typeof clean>;
    try { c = clean(input); } catch (e) { rep.errors.push(`${label}: ${e instanceof Error ? e.message : "invalid"}`); return; }
    let p = id ? byId.get(id) : undefined;
    const isNew = !p;
    if (!p) { id = id || randomUUID().slice(0, 8); p = { id, ...c } as Person; d.people.push(p); byId.set(id, p); }
    else {
      p.name = c.name; p.gender = c.gender;
      for (const k of ["birth", "death", "city", "phone"] as const) { if (c[k]) p[k] = c[k]; else delete p[k]; }
      if (c.phone && c.phonePublic) p.phonePublic = true; else delete p.phonePublic;
      if (c.businesses) p.businesses = c.businesses; else delete p.businesses;
    }
    seen.add(p.id);
    entries.push({ raw, p, isNew, label });
  });

  // pass 2: relationships (ids must exist in the final data)
  const spouseWant = new Map<string, string>();
  for (const { raw, p, label } of entries) {
    const par = str(raw.parentId).trim(), sp = str(raw.spouseId).trim();
    if (par) {
      if (par === p.id) rep.errors.push(`${label}: cannot be their own parent.`);
      else if (!byId.has(par)) rep.errors.push(`${label}: parentId "${par}" does not exist.`);
      else p.parentId = par;
    } else delete p.parentId;
    if (sp) {
      if (sp === p.id) rep.errors.push(`${label}: cannot be their own spouse.`);
      else if (!byId.has(sp)) rep.errors.push(`${label}: spouseId "${sp}" does not exist.`);
      else spouseWant.set(p.id, sp);
    }
  }
  // spouses must agree both ways (a partner outside the file is set to match)
  const inFile = new Set(entries.map((e) => e.p.id));
  const final = new Map<string, string | undefined>();
  for (const { p } of entries) final.set(p.id, spouseWant.get(p.id));
  for (const [a, b] of spouseWant) {
    if (inFile.has(b)) {
      if (spouseWant.get(b) !== a) rep.errors.push(`${byId.get(a)!.name.en} lists ${byId.get(b)!.name.en} as spouse, but ${byId.get(b)!.name.en} does not list them back.`);
    } else {
      const other = byId.get(b)!;
      if (other.spouseId && other.spouseId !== a && !inFile.has(other.spouseId) && !remove) rep.errors.push(`${other.name.en} already has a different spouse. Clear that first.`);
      else final.set(b, a);
    }
  }
  // a person left out of a pair that used to point at someone in the file loses the link
  for (const p of d.people) if (!inFile.has(p.id) && p.spouseId && inFile.has(p.spouseId) && final.get(p.spouseId) !== p.id) delete p.spouseId;
  for (const [id, s] of final) { const p = byId.get(id)!; if (s) p.spouseId = s; else delete p.spouseId; }

  if (remove) {
    const gone = d.people.filter((p) => !inFile.has(p.id));
    for (const p of gone) rep.removed.push(p.name.en);
    d.people = d.people.filter((p) => inFile.has(p.id));
    const ids = new Set(d.people.map((p) => p.id));
    for (const p of d.people) { if (p.parentId && !ids.has(p.parentId)) delete p.parentId; if (p.spouseId && !ids.has(p.spouseId)) delete p.spouseId; }
  }
  if (!d.people.length) rep.errors.push("The result would have no people.");

  // parent loops
  for (const p of d.people) {
    const walk = new Set<string>([p.id]);
    for (let a = p.parentId ? byId.get(p.parentId) : undefined; a; a = a.parentId ? byId.get(a.parentId) : undefined) {
      if (walk.has(a.id)) { if (!rep.errors.some((e) => e.includes("parents form a loop"))) rep.errors.push(`${p.name.en}: parents form a loop (a person is their own ancestor).`); break; }
      walk.add(a.id);
    }
  }

  // report
  for (const p of d.people) {
    const b = before.get(p.id);
    if (b === undefined) rep.added.push(p.name.en);
    else if (b !== canon(p)) {
      const o = JSON.parse(b) as Record<string, unknown>, n = p as unknown as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => canon(o[k]) !== canon(n[k]));
      rep.updated.push(`${p.name.en}: ${keys.join(", ")}`);
    } else rep.unchanged++;
  }
  return rep;
}
