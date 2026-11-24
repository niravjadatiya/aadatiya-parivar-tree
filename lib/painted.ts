// Draws the family as a tree with a trunk, arching branches, twigs and leaves (SVG string).
// Couples with children are branches; people without children are leaves.
import type { Lang } from "@/config/site";
import { fullName, shortName } from "./format";
import type { Unit } from "./tree";

type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const f = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const GREENS = ["#2F6B26", "#3F7F32", "#4C8B3B", "#5A9A42", "#6AA84A"];
const BARK = "#4A2D20", BARK_DARK = "#33201A", BARK_LIGHT = "#6E4836";

function rngFor(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const dir = (a: number): Pt => [Math.sin(rad(a)), -Math.cos(rad(a))];

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return pts;
}

// Width profile: thick base that flares into the parent, tapering to the tip.
const widthAt = (w0: number, w1: number, t: number, flare: number, decay = 11) => (w0 + (w1 - w0) * Math.pow(t, 0.8)) * (1 + flare * Math.exp(-t * decay));

function ribbon(pts: Pt[], w0: number, w1: number, flare = 0, off = 0, frac = 1, decay = 11) {
  const L: Pt[] = [], R: Pt[] = [], n = pts.length;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
    const t = i / (n - 1), full = widthAt(w0, w1, t, flare, decay), w = (full * frac) / 2, o = (off * full) / 2;
    L.push([p[0] + nx * (w + o), p[1] + ny * (w + o)]); R.push([p[0] + nx * (o - w), p[1] + ny * (o - w)]);
  });
  return "M" + L.map((p) => f(p[0]) + " " + f(p[1])).join("L") + "L" + R.reverse().map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z";
}
const polyline = (pts: Pt[]) => "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join("L");
function offsetLine(pts: Pt[], w0: number, w1: number, flare: number, k: number, decay = 11): Pt[] {
  return pts.map((p, i, arr) => {
    const a = arr[Math.max(0, i - 1)], b = arr[Math.min(arr.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    const t = i / (arr.length - 1), w = (widthAt(w0, w1, t, flare, decay) * k) / 2;
    return [p[0] - (dy / m) * w, p[1] + (dx / m) * w];
  });
}

const leafBody = (L: number, W: number) => `M0 0C${f(L * 0.18)} ${f(-W * 0.95)} ${f(L * 0.62)} ${f(-W * 1.05)} ${L} 0C${f(L * 0.62)} ${f(W * 0.8)} ${f(L * 0.2)} ${f(W * 0.95)} 0 0Z`;
const leafHalf = (L: number, W: number) => `M0 0C${f(L * 0.18)} ${f(-W * 0.95)} ${f(L * 0.62)} ${f(-W * 1.05)} ${L} 0Z`;
const leafVeins = (L: number, W: number) => {
  let d = `M2 0H${f(L - 4)}`;
  for (const t of [0.28, 0.5, 0.72]) d += `M${f(L * t)} 0L${f(L * (t + 0.14))} ${f(-W * 0.55 * (1 - t * 0.6))}M${f(L * t)} 0L${f(L * (t + 0.14))} ${f(W * 0.5 * (1 - t * 0.6))}`;
  return d;
};

const leafCount = (u: Unit): number => (u.children.length ? u.children.reduce((s, c) => s + leafCount(c), 0) : 1);

export function paintTree(roots: Unit[], lang: Lang, rootLabel: string) {
  let defs = "", twigs = "", bark = "", shade = "", hi = "", deco = "", labels = "", named = "", uid = 0;
  let minX = 0, maxX = 0, minY = 0;
  const ext = (x: number, y: number, pad = 0) => { minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad); minY = Math.min(minY, y - pad); };
  const label = (u: Unit) => (u.spouse ? `${shortName(u.primary, lang)} & ${shortName(u.spouse, lang)}` : fullName(u.primary, lang));

  // A small leaf on a short stem that grows from the edge of a branch, pointing outward and toward the tip.
  function decoLeaf(x: number, y: number, a: number, s: number, rnd: () => number) {
    const c = GREENS[Math.floor(rnd() * GREENS.length)], sd = dir(a + 90), st = 7 * s;
    const ox = x + Math.cos(rad(a)) * st, oy = y + Math.sin(rad(a)) * st;
    ext(ox, oy, 34);
    deco += `<path d="M${f(x)} ${f(y)}L${f(ox)} ${f(oy)}" stroke="#3A5A28" stroke-width="2" stroke-linecap="round" fill="none"/><g transform="translate(${f(ox)} ${f(oy)}) rotate(${f(a)}) scale(${f(s)})"><path d="${leafBody(44, 15)}" fill="${c}" stroke="#244F1D" stroke-width=".9"/><path d="${leafHalf(44, 15)}" fill="#fff" opacity=".12"/><path d="M2 0H40" stroke="#244F1D" stroke-width=".8" opacity=".5"/></g>`;
    void sd;
  }

  function nameLeaf(x: number, y: number, a: number, u: Unit, rnd: () => number) {
    const text = u.spouse ? label(u) : shortName(u.primary, lang);
    const L = Math.max(70, Math.round(text.length * 5.9) + 24), W = 25;
    const c = GREENS[1 + Math.floor(rnd() * 3)], flip = (a > 90 && a < 270) || a < -90;
    ext(x + Math.cos(rad(a)) * L, y + Math.sin(rad(a)) * L, W); ext(x, y, W);
    named += `<g data-pid="${esc(u.primary.id)}" style="cursor:pointer" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><path d="${leafBody(L, W)}" fill="${c}" stroke="#244F1D" stroke-width="1.2"/><path d="${leafHalf(L, W)}" fill="#fff" opacity=".13"/><path d="${leafVeins(L, W)}" stroke="#244F1D" stroke-width=".9" opacity=".45" fill="none"/><text transform="translate(${f(L * 0.5)} 0)${flip ? " rotate(180)" : ""}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#fff" font-weight="600" stroke="#244F1D" stroke-width="2.2" paint-order="stroke" stroke-linejoin="round">${esc(text)}</text></g>`;
  }

  function branch(start: Pt, ang: number, len: number, w0: number, d: number, u: Unit, text: string, kids: Unit[], inAng = 0): void {
    const rnd = rngFor(u.id);
    const trunk = d < 0;
    // arch upward: the branch bends toward vertical as it grows (like a bough)
    const lean = kids.length === 1 && kids[0].children.length ? -1 : 0; // trunk leans toward its only branch so they join smoothly
    const aEnd = trunk ? lean * 0 : ang * (0.6 + rnd() * 0.12);
    const aMid = trunk ? lean * 0 : ang * 0.92;
    const p0 = start;
    const bAng = trunk ? 0 : inAng; // start tangent = parent end tangent (smooth joint), then bend toward `ang`
    const p1: Pt = [p0[0] + dir(bAng)[0] * len * 0.4, p0[1] + dir(bAng)[1] * len * 0.4];
    const p3: Pt = [p0[0] + dir(aMid)[0] * len, p0[1] + dir(aMid)[1] * len];
    const p2: Pt = [p3[0] - dir(aEnd)[0] * len * 0.34, p3[1] - dir(aEnd)[1] * len * 0.34];
    const pts = bez(p0, p1, p2, p3);
    const end = pts[pts.length - 1];
    const w1 = trunk ? 84 : Math.max(5, w0 * 0.58), flare = trunk ? 0.6 : 0.3, decay = trunk ? 7 : 11;
    pts.forEach((p, i) => ext(p[0], p[1], i === 0 ? w0 : w0 * 0.4));

    const pid = esc(u.primary.id);
    bark += `<path data-pid="${pid}" style="cursor:pointer" d="${ribbon(pts, w0, w1, flare, 0, 1, decay)}" fill="${BARK}"/>`;
    shade += `<path d="${ribbon(pts, w0, w1, flare, 0.4, 0.28, decay)}" fill="${BARK_DARK}" opacity=".55" pointer-events="none"/>`;
    hi += `<path d="${ribbon(pts, w0, w1, flare, -0.34, 0.26, decay)}" fill="${BARK_LIGHT}" opacity=".6" pointer-events="none"/>`;
    for (const k of [-0.18, 0.12]) hi += `<path d="${polyline(offsetLine(pts, w0, w1, flare, k, decay).slice(2, -3))}" stroke="${BARK_DARK}" stroke-width="1.2" fill="none" opacity=".4" pointer-events="none"/>`;

    bark += `<circle cx="${f(end[0])}" cy="${f(end[1])}" r="${f((w1 * 0.5) * 0.98)}" fill="${BARK}"/>`;
    if (text) {
      const lid = "p" + uid++, lr = p3[0] >= p0[0], ps = lr ? pts : pts.slice().reverse();
      defs += `<path id="${lid}" d="${polyline(ps)}"/>`;
      const approx = len * 0.9, fs = Math.max(10, Math.min(trunk ? 22 : 15, approx / (text.length * 0.55)));
      labels += `<text data-pid="${pid}" style="cursor:pointer" font-size="${f(fs)}" fill="#FBEFE3" font-weight="700" stroke="${BARK_DARK}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round"><textPath href="#${lid}" startOffset="50%" text-anchor="middle" dy="${f(fs * 0.35)}">${esc(text)}</textPath></text>`;
    }

    // foliage grows from the edge of the outer bough, on stems, pointing outward and toward the tip
    if (d >= 0) {
      const n = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor((0.45 + rnd() * 0.5) * (pts.length - 1)), p = pts[idx];
        const q = pts[Math.min(pts.length - 1, idx + 1)], r0 = pts[Math.max(0, idx - 1)];
        const tx = q[0] - r0[0], ty = q[1] - r0[1], tm = Math.hypot(tx, ty) || 1;
        const side = i % 2 ? 1 : -1, wHere = widthAt(w0, w1, idx / (pts.length - 1), flare, decay);
        const ex = p[0] + (-ty / tm) * side * wHere * 0.42, ey = p[1] + (tx / tm) * side * wHere * 0.42;
        const tang = (Math.atan2(ty, tx) * 180) / Math.PI;
        decoLeaf(ex, ey, tang + side * (38 + rnd() * 26), 0.6 + rnd() * 0.45, rnd);
      }
    }

    const weights = kids.map((k) => leafCount(k)), total = weights.reduce((s, v) => s + v, 0);
    const leafKids = kids.filter((k) => !k.children.length).length;
    const maxSpread = d > 0 ? 150 : 190;
    const spread = Math.min(maxSpread, Math.max(34 * Math.sqrt(total) * 1.5, 44 * kids.length, leafKids > 1 ? 40 * kids.length : 0));
    let acc = 0;
    kids.forEach((k, i) => {
      const share = weights[i] / total;
      const center = kids.length === 1 ? (d % 2 === 0 ? 1 : -1) * 22 : -spread / 2 + spread * (acc + share / 2);
      acc += share;
      const ka = aEnd + center + (rnd() - 0.5) * 8;
      if (k.children.length) {
        const dn = dir(aEnd), s2: Pt = [end[0] - dn[0] * 1, end[1] - dn[1] * 1];
        branch(s2, ka, Math.max(140, len * (kids.length === 1 ? 0.84 : 0.92)), Math.max(9, w1 / (1 + 0.3)), d + 1, k, label(k), k.children, aEnd);
      } else {
        const tl = 30 + rnd() * 14, sd = dir(ka), tip: Pt = [end[0] + sd[0] * tl, end[1] + sd[1] * tl];
        const tw = bez(end, [end[0] + sd[0] * tl * 0.4, end[1] + sd[1] * tl * 0.4 - 3], [tip[0] - sd[0] * tl * 0.3, tip[1] - sd[1] * tl * 0.3 + 3], tip, 8);
        twigs += `<path d="${ribbon(tw, 6.5, 2.6)}" fill="${BARK}"/>`;
        nameLeaf(tip[0], tip[1], ka - 90 + (rnd() - 0.5) * 16, k, rnd);
      }
    });
  }

  const top: Unit = roots.length === 1 ? roots[0] : { id: "__root", primary: { id: "__root", name: { en: rootLabel }, gender: "male" }, children: roots };
  const topText = roots.length === 1 ? label(roots[0]) : rootLabel;
  const base = 128;
  branch([0, 0], 0, 320, base, -1, top, topText, top.children);
  ext(0, 0, base);

  // root lobes and ground drawn behind the tree
  const flare = `<path d="M-92 -26C-108 4 -150 16 -214 18C-160 28 -112 24 -84 10Z" fill="${BARK}"/><path d="M92 -26C108 4 150 16 214 18C160 28 112 24 84 10Z" fill="${BARK}"/>`;
  const gw = Math.max(420, (maxX - minX) * 0.5);
  const ground = `<ellipse cx="0" cy="14" rx="${f(gw)}" ry="36" fill="#A06E40"/><ellipse cx="0" cy="9" rx="${f(gw * 0.8)}" ry="23" fill="#B88350"/>`;
  const pad = 70, y = minY - pad, h = 56 - y;
  let x = minX - pad - gw * 0.2, w = maxX - minX + pad * 2 + gw * 0.4;
  const minW = h * 1.25;
  if (w < minW) { x -= (minW - w) / 2; w = minW; }
  const vb = { x: f(x), y: f(y), w: f(w), h: f(h) };
  const sun = `<circle cx="${f(vb.x + vb.w * 0.82)}" cy="${f(vb.y + vb.h * 0.16)}" r="${f(Math.min(vb.w, vb.h) * 0.2)}" fill="url(#glow)"/>`;
  const inner = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7DABA"/><stop offset="1" stop-color="#EDB487"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#FFF3DC" stop-opacity=".85"/><stop offset="1" stop-color="#FFF3DC" stop-opacity="0"/></radialGradient>${defs}</defs>${sun}${ground}${flare}${twigs}${bark}${shade}${hi}${deco}${labels}${named}`;
  return { inner, vb };
}
