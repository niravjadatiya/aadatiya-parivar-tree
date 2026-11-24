// Draws the family as a tree with a trunk, branches and leaves (SVG string).
// Couples with children are branches; people without children are leaves.
import type { Lang } from "@/config/site";
import { fullName, shortName } from "./format";
import type { Unit } from "./tree";

type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const f = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const GREENS = ["#3F7F32", "#4C8B3B", "#5A9A42", "#366F2B"];

function rngFor(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function curve(x0: number, y0: number, x1: number, y1: number, bA: number, bB: number): Pt[] {
  const dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
  const c1: Pt = [x0 + dx * 0.3 + nx * m * bA, y0 + dy * 0.3 + ny * m * bA];
  const c2: Pt = [x0 + dx * 0.7 + nx * m * bB, y0 + dy * 0.7 + ny * m * bB];
  const pts: Pt[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, u = 1 - t;
    pts.push([u * u * u * x0 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y1]);
  }
  return pts;
}
function ribbon(pts: Pt[], w0: number, w1: number, off = 0, frac = 1) {
  const L: Pt[] = [], R: Pt[] = [], n = pts.length;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
    const t = i / (n - 1), base = w0 + (w1 - w0) * Math.pow(t, 0.85), w = (base * frac) / 2, o = (off * (w0 + (w1 - w0) * t)) / 2;
    L.push([p[0] + nx * (w + o), p[1] + ny * (w + o)]); R.push([p[0] + nx * (o - w), p[1] + ny * (o - w)]);
  });
  return "M" + L.map((p) => f(p[0]) + " " + f(p[1])).join("L") + "L" + R.reverse().map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z";
}
const line = (pts: Pt[]) => "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join("L");
const leafPath = (L: number, W: number) => `M0 0C${f(L * 0.15)} ${f(-W * 0.9)} ${f(L * 0.55)} ${f(-W * 1.05)} ${L} 0C${f(L * 0.55)} ${f(W * 1.05)} ${f(L * 0.15)} ${f(W * 0.9)} 0 0Z`;

const leafCount = (u: Unit): number => (u.children.length ? u.children.reduce((s, c) => s + leafCount(c), 0) : 1);

export function paintTree(roots: Unit[], lang: Lang, rootLabel: string) {
  let defs = "", twigs = "", bark = "", hi = "", joints = "", deco = "", labels = "", named = "", uid = 0;
  let minX = 0, maxX = 0, minY = 0;
  const ext = (x: number, y: number, pad = 0) => { minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad); minY = Math.min(minY, y - pad); };
  const label = (u: Unit) => (u.spouse ? `${shortName(u.primary, lang)} & ${shortName(u.spouse, lang)}` : fullName(u.primary, lang));

  function nameLeaf(x: number, y: number, a: number, u: Unit, rnd: () => number) {
    const text = u.spouse ? label(u) : shortName(u.primary, lang), L = Math.max(78, Math.round(text.length * 6.3) + 28), W = 28;
    const c = GREENS[Math.floor(rnd() * 3)], flip = (a > 90 && a < 270) || a < -90;
    const tip: Pt = [x + Math.cos(rad(a)) * L, y + Math.sin(rad(a)) * L];
    ext(tip[0], tip[1], W); ext(x, y, W);
    named += `<g data-pid="${esc(u.primary.id)}" style="cursor:pointer" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="${leafPath(L, W)}" fill="${c}" stroke="#2C5A22" stroke-width="1.1"/><path d="M3 0H${L - 8}" stroke="#2C5A22" stroke-width="1" opacity=".55"/><text transform="translate(${f(L * 0.5)} 0)${flip ? " rotate(180)" : ""}" text-anchor="middle" dominant-baseline="central" font-size="11.5" fill="#fff" font-weight="600">${esc(text)}</text></g>`;
  }
  function decoLeaf(x: number, y: number, a: number, s: number, rnd: () => number) {
    const c = GREENS[Math.floor(rnd() * GREENS.length)];
    ext(x, y, 30);
    deco += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)}) scale(${f(s)})"><path d="${leafPath(40, 15)}" fill="${c}" stroke="#2C5A22" stroke-width=".8"/><path d="M2 0H34" stroke="#2C5A22" stroke-width=".8" opacity=".5"/></g>`;
  }

  function branch(x: number, y: number, ang: number, len: number, w0: number, d: number, u: Unit, text: string, kids: Unit[]): Pt {
    const rnd = rngFor(u.id);
    const x1 = x + Math.sin(rad(ang)) * len, y1 = y - Math.cos(rad(ang)) * len;
    const w1 = Math.max(7, w0 * 0.68);
    const trunk = d < 0;
    const pts = curve(x, y, x1, y1, trunk ? 0 : (rnd() - 0.5) * 0.22, trunk ? 0 : (rnd() - 0.5) * 0.3);
    const end = pts[pts.length - 1];
    pts.forEach((p) => ext(p[0], p[1], w0 / 2));
    const pid = esc(u.primary.id);
    bark += `<path data-pid="${pid}" style="cursor:pointer" d="${ribbon(pts, w0, w1)}" fill="#4A2D20"/>`;
    hi += `<path d="${ribbon(pts, w0, w1, -0.35, 0.34)}" fill="#6B4533" opacity=".55" pointer-events="none"/>`;
    joints += `<circle cx="${f(end[0])}" cy="${f(end[1])}" r="${f(w1 / 2)}" fill="#4A2D20"/>`;
    for (const g of [-1, 1]) {
      const sub: Pt[] = pts.map((p, i, arr) => {
        const a = arr[Math.max(0, i - 1)], b = arr[Math.min(arr.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
        const t = i / (arr.length - 1), w = (w0 + (w1 - w0) * t) * 0.22 * g;
        return [p[0] - (dy / m) * w, p[1] + (dx / m) * w];
      });
      bark += `<path d="${line(sub.slice(2, -2))}" stroke="#2E1A12" stroke-width="1.3" fill="none" opacity=".45" pointer-events="none"/>`;
    }
    if (text) {
      const lid = "p" + uid++, lr = x1 >= x, ps = lr ? pts : pts.slice().reverse();
      defs += `<path id="${lid}" d="${line(ps)}"/>`;
      const fs = Math.max(9.5, Math.min(trunk ? 20 : 14, (len * 0.92) / (text.length * 0.56)));
      labels += `<text data-pid="${pid}" style="cursor:pointer" font-size="${f(fs)}" fill="#F7E9DC" font-weight="700"><textPath href="#${lid}" startOffset="50%" text-anchor="middle" dy="${f(fs * 0.35)}">${esc(text)}</textPath></text>`;
    }
    if (d >= 1) for (let i = 0; i < 3; i++) {
      const p = pts[8 + Math.floor(rnd() * 9)], side = rnd() < 0.5 ? -1 : 1;
      decoLeaf(p[0], p[1], ang - 90 + side * (40 + rnd() * 40), 0.8 + rnd() * 0.4, rnd);
    }
    const weights = kids.map((k) => leafCount(k)), total = weights.reduce((s, v) => s + v, 0);
    const maxSpread = d > 0 ? 125 : 170, spread = Math.min(maxSpread, 34 * Math.max(kids.length, Math.sqrt(total) * 1.6));
    let acc = 0;
    kids.forEach((k, i) => {
      const share = weights[i] / total;
      const center = kids.length === 1 ? (d % 2 === 0 ? 1 : -1) * 24 : -spread / 2 + spread * (acc + share / 2);
      acc += share;
      const ka = ang + center + (rnd() - 0.5) * 8;
      if (k.children.length) branch(end[0], end[1], ka, Math.max(95, len * (kids.length === 1 ? 0.8 : 0.88)), w1 * 0.96, d + 1, k, label(k), k.children);
      else {
        const sx = end[0] + Math.sin(rad(ka)) * 16, sy = end[1] - Math.cos(rad(ka)) * 16;
        twigs += `<path d="${ribbon(curve(end[0], end[1], sx, sy, 0.06, -0.06), 6, 2.5)}" fill="#4A2D20"/>`;
        nameLeaf(sx, sy, ka - 90, k, rnd);
      }
    });
    return end;
  }

  const top: Unit = roots.length === 1 ? roots[0] : { id: "__root", primary: { id: "__root", name: { en: rootLabel }, gender: "male" }, children: roots };
  const topText = roots.length === 1 ? label(roots[0]) : rootLabel;
  const trunkLen = 300, base = 140;
  branch(0, 0, 0, trunkLen, base, -1, top, topText, top.children);
  ext(0, 0, base);
  // root flare + ground drawn behind everything
  const flare = `<path d="M${-base - 12} 14C${-base / 2 - 20} -14 ${-base / 2 + 4} -50 ${-base / 2 + 8} -100L${base / 2 - 8} -100C${base / 2 - 4} -50 ${base / 2 + 20} -14 ${base + 12} 14Z" fill="#4A2D20"/>`;
  const gw = Math.max(330, (maxX - minX) * 0.25);
  const ground = `<ellipse cx="0" cy="12" rx="${f(gw)}" ry="34" fill="#9C6B3F"/><ellipse cx="0" cy="8" rx="${f(gw * 0.78)}" ry="22" fill="#B27B4A"/>`;
  const pad = 60, y = minY - pad, h = 50 - y;
  let x = minX - pad - gw * 0.2, w = maxX - minX + pad * 2 + gw * 0.4;
  const minW = h * 1.2;
  if (w < minW) { x -= (minW - w) / 2; w = minW; }
  const vb = { x: f(x), y: f(y), w: f(w), h: f(h) };
  const inner = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D7B6"/><stop offset="1" stop-color="#EFB98C"/></linearGradient>${defs}</defs><rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" rx="14" fill="url(#sky)"/>${ground}${flare}${twigs}${bark}${hi}${joints}${deco}${labels}${named}`;
  return { inner, vb };
}
