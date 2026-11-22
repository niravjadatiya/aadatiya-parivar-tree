import type { Lang } from "@/config/site";
import type { Person } from "./types";

export const fullName = (p: Person, lang: Lang) => (lang === "gu" && p.name.gu) || p.name.en;
export const shortName = (p: Person, lang: Lang) => fullName(p, lang).split(" ")[0];
export function formatDate(v: string | undefined, lang: Lang) {
  if (!v) return "";
  const parts = v.split("-").map(Number);
  const loc = lang === "gu" ? "gu-IN" : "en-GB";
  if (parts.length === 1) return String(parts[0]);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] ?? 1));
  return new Intl.DateTimeFormat(loc, parts.length === 2 ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
