import type { Person } from "./types";

export type Unit = { id: string; primary: Person; spouse?: Person; children: Unit[] };

export function buildUnits(people: Person[]): Unit[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const index = new Map(people.map((p, i) => [p.id, i]));
  const isPrimary = (p: Person) => {
    const sp = p.spouseId ? byId.get(p.spouseId) : undefined;
    if (!sp) return true;
    if (p.parentId && byId.has(p.parentId)) return true;
    if (sp.parentId && byId.has(sp.parentId)) return false;
    return index.get(p.id)! < index.get(sp.id)!;
  };
  const primaries = people.filter(isPrimary);
  const sortKey = (p: Person) => p.birth ?? "9999";
  const make = (p: Person): Unit => {
    const spouse = p.spouseId ? byId.get(p.spouseId) : undefined;
    const kids = primaries
      .filter((c) => c.parentId && (c.parentId === p.id || c.parentId === spouse?.id))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return { id: p.id, primary: p, spouse, children: kids.map(make) };
  };
  return primaries.filter((p) => !p.parentId || !byId.has(p.parentId)).map(make);
}

export function countDescendants(u: Unit): number {
  return u.children.reduce((n, c) => n + 1 + (c.spouse ? 1 : 0) + countDescendants(c), 0);
}
export function unitSize(u: Unit) { return u.spouse ? 2 : 1; }

export type Metrics = { W: number; H: number; GX: number; GY: number; TOP: number };
export const FULL: Metrics = { W: 320, H: 88, GX: 32, GY: 56, TOP: 76 };
export const COMPACT: Metrics = { W: 232, H: 64, GX: 14, GY: 34, TOP: 64 };

export type Node = { unit: Unit; x: number; y: number; w: number; kids: Node[] };
type Measured = { unit: Unit; w: number; kids: Measured[] };

function measure(u: Unit, expanded: Set<string>, M: Metrics): Measured {
  const kids = expanded.has(u.id) ? u.children.map((c) => measure(c, expanded, M)) : [];
  const kw = kids.reduce((s, k) => s + k.w, 0) + Math.max(0, kids.length - 1) * M.GX;
  return { unit: u, w: Math.max(M.W, kw), kids };
}
function place(m: Measured, left: number, depth: number, M: Metrics): Node {
  const y = M.TOP + depth * (M.H + M.GY);
  if (!m.kids.length) return { unit: m.unit, x: left + m.w / 2, y, w: m.w, kids: [] };
  const kw = m.kids.reduce((s, k) => s + k.w, 0) + (m.kids.length - 1) * M.GX;
  let cur = left + (m.w - kw) / 2;
  const kids = m.kids.map((k) => { const n = place(k, cur, depth + 1, M); cur += k.w + M.GX; return n; });
  return { unit: m.unit, x: (kids[0].x + kids[kids.length - 1].x) / 2, y, w: m.w, kids };
}

export function layout(roots: Unit[], expanded: Set<string>, M: Metrics = FULL) {
  let left = 0;
  const nodes = roots.map((r) => { const m = measure(r, expanded, M); const n = place(m, left, 0, M); left += m.w + M.GX; return n; });
  const flat: Node[] = [];
  const lines: string[] = [];
  const walk = (n: Node) => {
    flat.push(n);
    if (n.kids.length) {
      const y0 = n.y + M.H, mid = y0 + M.GY / 2;
      lines.push(`M${n.x} ${y0}V${mid}`);
      if (n.kids.length > 1) lines.push(`M${n.kids[0].x} ${mid}H${n.kids[n.kids.length - 1].x}`);
      n.kids.forEach((k) => { lines.push(`M${k.x} ${mid}V${k.y}`); walk(k); });
    }
  };
  nodes.forEach(walk);
  const width = Math.max(M.W, left - M.GX);
  const height = Math.max(...flat.map((n) => n.y)) + M.H;
  return { nodes: flat, lines, width, height };
}
