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

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 56): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return pts;
}

// Width profile: thick base that flares into the parent, tapering to the tip.
const widthAt = (w0: number, w1: number, t0: number, flare: number, decay = 11, plat = 0) => {
  const t = Math.max(0, (t0 - plat) / (1 - plat)); // constant width while overlapping the parent, then taper
  return (w0 + (w1 - w0) * Math.pow(t, flare ? 0.8 : 1.15)) * (1 + flare * Math.exp(-t * decay)); // flare-free branches taper gently, no neck at the joint
};

// position along the path as a 0..1 fraction of its length
function arcT(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = c[c.length - 1] || 1;
  return c.map((v) => v / L);
}
const plen = (a: Pt[]) => a.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0);

function ribbon(pts: Pt[], w0: number, w1: number, flare = 0, off = 0, frac = 1, decay = 11, fade = false, plat = 0) {
  const L: Pt[] = [], R: Pt[] = [], n = pts.length, T = arcT(pts);
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
    const t = T[i], tf = fade ? Math.pow(Math.sin(Math.PI * t), 0.7) : 1, full = widthAt(w0, w1, t, flare, decay, plat), w = (full * frac * tf) / 2, o = (off * full * tf) / 2;
    L.push([p[0] + nx * (w + o), p[1] + ny * (w + o)]); R.push([p[0] + nx * (o - w), p[1] + ny * (o - w)]);
  });
  return "M" + L.map((p) => f(p[0]) + " " + f(p[1])).join("L") + "L" + R.reverse().map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z";
}
const polyline = (pts: Pt[]) => "M" + pts.map((p) => f(p[0]) + " " + f(p[1])).join("L");
function offsetLine(pts: Pt[], w0: number, w1: number, flare: number, k: number, decay = 11, plat = 0): Pt[] {
  const T = arcT(pts);
  return pts.map((p, i, arr) => {
    const a = arr[Math.max(0, i - 1)], b = arr[Math.min(arr.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    const t = T[i], w = (widthAt(w0, w1, t, flare, decay, plat) * k) / 2;
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

  // Wind sway: CSS-animated wrapper around a leaf (rotates about the leaf base). Every 2nd decorative leaf only, to stay light.
  let swayN = 0, swayOpen = false;
  const sw = (close = 0, force = false) => {
    if (close) return swayOpen ? "</g>" : "";
    swayN++; swayOpen = force || swayN % 2 === 0;
    return swayOpen ? `<g class="sw sw${swayN % 5}">` : "";
  };

  // A small leaf on a short stem that grows from the edge of a branch, pointing outward and toward the tip.
  function decoLeaf(x: number, y: number, a: number, s: number, rnd: () => number) {
    const c = GREENS[Math.floor(rnd() * GREENS.length)], sd = dir(a + 90), st = 7 * s;
    const ox = x + Math.cos(rad(a)) * st, oy = y + Math.sin(rad(a)) * st;
    ext(ox, oy, 34);
    deco += `<path d="M${f(x)} ${f(y)}L${f(ox)} ${f(oy)}" stroke="#3A5A28" stroke-width="2" stroke-linecap="round" fill="none"/><g transform="translate(${f(ox)} ${f(oy)}) rotate(${f(a)}) scale(${f(s)})">${sw()}<path d="${leafBody(44, 15)}" fill="${c}" stroke="#244F1D" stroke-width=".9"/><path d="${leafHalf(44, 15)}" fill="#fff" opacity=".12"/><path d="M2 0H40" stroke="#244F1D" stroke-width=".8" opacity=".5"/>${sw(1)}</g>`;
    void sd;
  }

  // Named leaves already placed, as a few circles along each leaf, so new leaves can avoid overlapping them.
  const placed: { x: number; y: number; r: number }[] = [];
  const LEAF_W = 25;
  const leafLen = (u: Unit) => Math.max(70, Math.round((u.spouse ? label(u) : shortName(u.primary, lang)).length * 5.9) + 24);
  const leafCircles = (x: number, y: number, a: number, L: number) =>
    [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((fr, i) => ({ x: x + Math.cos(rad(a)) * L * fr, y: y + Math.sin(rad(a)) * L * fr, r: LEAF_W * [0.55, 0.85, 1, 0.95, 0.75, 0.45][i] * 0.9 }));
  const leafPenalty = (x: number, y: number, a: number, L: number) => {
    let pen = 0;
    for (const c of leafCircles(x, y, a, L)) for (const p of placed) pen += Math.max(0, c.r + p.r + 3 - Math.hypot(c.x - p.x, c.y - p.y));
    return pen;
  };

  function nameLeaf(x: number, y: number, a: number, u: Unit, rnd: () => number) {
    const text = u.spouse ? label(u) : shortName(u.primary, lang);
    const L = Math.max(70, Math.round(text.length * 5.9) + 24), W = LEAF_W;
    placed.push(...leafCircles(x, y, a, L));
    const c = GREENS[1 + Math.floor(rnd() * 3)], flip = (a > 90 && a < 270) || a < -90;
    ext(x + Math.cos(rad(a)) * L, y + Math.sin(rad(a)) * L, W); ext(x, y, W);
    named += `<g data-pid="${esc(u.primary.id)}" style="cursor:pointer" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})">${sw(0, true)}<path d="${leafBody(L, W)}" fill="${c}" stroke="#244F1D" stroke-width="1.2"/><path d="${leafHalf(L, W)}" fill="#fff" opacity=".13"/><path d="${leafVeins(L, W)}" stroke="#244F1D" stroke-width=".9" opacity=".45" fill="none"/><text transform="translate(${f(L * 0.5)} 0)${flip ? " rotate(180)" : ""}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#fff" font-weight="600" stroke="#244F1D" stroke-width="2.2" paint-order="stroke" stroke-linejoin="round">${esc(text)}</text>${sw(1)}</g>`;
  }

  function branch(start: Pt, ang: number, len: number, w0: number, d: number, u: Unit, text: string, kids: Unit[], inAng = 0, lead: Pt[] = []): void {
    const rnd = rngFor(u.id);
    const trunk = d < 0;
    // an ancestor with a single child (a long line of descent) only needs as much trunk as the name; branches that fork keep full room
    const solo = kids.length === 1 && kids[0].children.length > 0;
    if (solo) len = trunk ? 150 : 74; // short, wide trunk blocks with the name written straight across
    else if (!trunk) len = Math.min(340, Math.max(len, text.length * 11.5)); // long enough for the name
    // arch upward: the branch bends toward vertical as it grows (like a bough)
    const lean = kids.length === 1 && kids[0].children.length ? -1 : 0; // trunk leans toward its only branch so they join smoothly
    const aEnd = trunk ? lean * 0 : ang * (0.6 + rnd() * 0.12);
    const aMid = trunk ? lean * 0 : ang * 0.92;
    const p0 = start;
    const bAng = trunk ? 0 : inAng; // start tangent = parent end tangent (smooth joint), then bend toward `ang`
    const run = trunk ? len * 0.4 : len * 0.32; // keep the parent's heading for a while, then bend
    const p1: Pt = [p0[0] + dir(bAng)[0] * run, p0[1] + dir(bAng)[1] * run];
    const p3: Pt = [p0[0] + dir(aMid)[0] * len, p0[1] + dir(aMid)[1] * len];
    const p2: Pt = [p3[0] - dir(aEnd)[0] * len * 0.34, p3[1] - dir(aEnd)[1] * len * 0.34];
    const own = bez(p0, p1, p2, p3);
    const end = own[own.length - 1];
    // a child begins by retracing the parent's last stretch exactly (same centreline and width), so the joint has no seam
    const pts: Pt[] = lead.length ? [...lead.slice(0, -1), ...own] : own;
    const n0 = lead.length ? lead.length - 1 : 0, T = arcT(pts);
    const leadLen = lead.length ? plen(lead) : 0, plat = leadLen ? leadLen / (leadLen + plen(own)) : 0;
    const w1 = solo ? (trunk ? 124 : Math.max(112, w0 * 0.95)) : trunk ? 84 : Math.max(16, w0 * 0.6), flare = trunk ? 0.6 : 0, decay = trunk ? 7 : 11;
    pts.forEach((p, i) => ext(p[0], p[1], i === 0 ? w0 : w0 * 0.4));

    const pid = esc(u.primary.id);
    bark += `<path data-pid="${pid}" style="cursor:pointer" d="${ribbon(pts, w0, w1, flare, 0, 1, decay, false, plat)}" fill="${BARK}"/>`;
    shade += `<path d="${ribbon(pts, w0, w1, flare, 0.4, 0.28, decay, true, plat)}" fill="${BARK_DARK}" opacity=".55" pointer-events="none"/>`;
    hi += `<path d="${ribbon(pts, w0, w1, flare, -0.34, 0.26, decay, true, plat)}" fill="${BARK_LIGHT}" opacity=".6" pointer-events="none"/>`;
    for (const k of [-0.18, 0.12]) hi += `<path d="${polyline(offsetLine(pts, w0, w1, flare, k, decay, plat).slice(6, -7))}" stroke="${BARK_DARK}" stroke-width="1.2" fill="none" opacity=".4" pointer-events="none"/>`;

    bark += `<circle cx="${f(end[0])}" cy="${f(end[1])}" r="${f(w1 * 0.5)}" fill="${BARK}"/>`;
    if (text && solo) {
      // wide trunk block: write the name straight (horizontal) across the middle
      const m = own[Math.floor(own.length * 0.5)], wMid = widthAt(w0, w1, plat + (1 - plat) * 0.5, flare, decay, plat);
      const fs = Math.max(9, Math.min(trunk ? 20 : 15, (wMid * 0.84) / (text.length * 0.56)));
      labels += `<text data-pid="${pid}" style="cursor:pointer" x="${f(m[0])}" y="${f(m[1] + fs * 0.35)}" text-anchor="middle" font-size="${f(fs)}" fill="#FBEFE3" font-weight="700" stroke="${BARK_DARK}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">${esc(text)}</text>`;
    } else if (text) {
      const lid = "p" + uid++, lr = p3[0] >= p0[0], ps = lr ? own : own.slice().reverse();
      defs += `<path id="${lid}" d="${polyline(ps)}"/>`;
      // font fits the branch thickness, and the name stays in the middle ~70% so it never runs into a junction
      const wMid = widthAt(w0, w1, plat + (1 - plat) * 0.5, flare, decay, plat);
      let fs = Math.min(trunk ? 24 : 16, Math.max(10, wMid * 0.62));
      const room = len * (solo ? 0.82 : 0.58), need = text.length * fs * 0.56;
      if (need > room) fs = Math.max(9, room / (text.length * 0.56));
      const mid = solo ? (lr ? 55 : 45) : (lr ? 62 : 38); // text runs along the path; after reversal the same visual spot is mirrored
      labels += `<text data-pid="${pid}" style="cursor:pointer" font-size="${f(fs)}" fill="#FBEFE3" font-weight="700" stroke="${BARK_DARK}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round"><textPath href="#${lid}" startOffset="${mid}%" text-anchor="middle" dy="${f(fs * 0.35)}">${esc(text)}</textPath></text>`;
    }

    // foliage grows from the edge of the outer bough, on stems, pointing outward and toward the tip
    if (d >= 0) {
      const n = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor((0.45 + rnd() * 0.5) * (own.length - 1)), p = own[idx];
        const q = own[Math.min(own.length - 1, idx + 1)], r0 = own[Math.max(0, idx - 1)];
        const tx = q[0] - r0[0], ty = q[1] - r0[1], tm = Math.hypot(tx, ty) || 1;
        const side = i % 2 ? 1 : -1, wHere = widthAt(w0, w1, T[n0 + idx], flare, decay, plat);
        const ex = p[0] + (-ty / tm) * side * wHere * 0.42, ey = p[1] + (tx / tm) * side * wHere * 0.42;
        const tang = (Math.atan2(ty, tx) * 180) / Math.PI;
        decoLeaf(ex, ey, tang + side * (38 + rnd() * 26), 0.6 + rnd() * 0.45, rnd);
      }
    }

    if (kids.length === 1 && kids[0].children.length) {
      // still on the single line of descent: keep growing the trunk
      const ka = aEnd + (d % 2 === 0 ? 1 : -1) * (solo ? 8 : 22) + (rnd() - 0.5) * 8;
      const ovl = Math.max(30, w1 * 1.4), lead2: Pt[] = [end];
      for (let i = pts.length - 2, run2 = 0; i >= 0 && run2 < ovl; i--) { run2 += Math.hypot(pts[i][0] - pts[i + 1][0], pts[i][1] - pts[i + 1][1]); lead2.unshift(pts[i]); }
      branch(end, ka, Math.max(140, len * 0.84), Math.max(22, w1), d + 1, kids[0], label(kids[0]), kids[0].children, aEnd, lead2);
    } else if (kids.length) crown(end, w1, kids);
  }

  // Bark, highlights, name and foliage for one limb of the crown.
  function limb(own: Pt[], w0: number, w1: number, u: Unit, rnd: () => number) {
    const pid = esc(u.primary.id), text = label(u), len = plen(own), T = arcT(own), end = own[own.length - 1], decay = 5;
    own.forEach((p) => ext(p[0], p[1], w0 * 0.4));
    bark += `<path data-pid="${pid}" style="cursor:pointer" d="${ribbon(own, w0, w1, 0, 0, 1, decay, false, 0)}" fill="${BARK}"/><circle cx="${f(end[0])}" cy="${f(end[1])}" r="${f(w1 * 0.5)}" fill="${BARK}"/>`;
    shade += `<path d="${ribbon(own, w0, w1, 0, 0.4, 0.28, decay, true, 0)}" fill="${BARK_DARK}" opacity=".55" pointer-events="none"/>`;
    hi += `<path d="${ribbon(own, w0, w1, 0, -0.34, 0.26, decay, true, 0)}" fill="${BARK_LIGHT}" opacity=".6" pointer-events="none"/>`;
    const lid = "p" + uid++, lr = end[0] >= own[0][0], ps = lr ? own : own.slice().reverse();
    defs += `<path id="${lid}" d="${polyline(ps)}"/>`;
    const wMid = widthAt(w0, w1, 0.65, 0, decay, 0);
    let fs = Math.min(16, Math.max(11, wMid * 0.62));
    const room = len * 0.6;
    if (text.length * fs * 0.56 > room) fs = Math.max(9, room / (text.length * 0.56));
    labels += `<text data-pid="${pid}" style="cursor:pointer" font-size="${f(fs)}" fill="#FBEFE3" font-weight="700" stroke="${BARK_DARK}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round"><textPath href="#${lid}" startOffset="${lr ? 66 : 34}%" text-anchor="middle" dy="${f(fs * 0.35)}">${esc(text)}</textPath></text>`;
    const n = 6 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((0.5 + rnd() * 0.48) * (own.length - 1)), p = own[idx];
      const q = own[Math.min(own.length - 1, idx + 1)], r0 = own[Math.max(0, idx - 1)];
      const tx = q[0] - r0[0], ty = q[1] - r0[1], tm = Math.hypot(tx, ty) || 1;
      const side = i % 2 ? 1 : -1, wHere = widthAt(w0, w1, T[idx], 0, decay, 0);
      const tang = (Math.atan2(ty, tx) * 180) / Math.PI;
      decoLeaf(p[0] + (-ty / tm) * side * wHere * 0.42, p[1] + (tx / tm) * side * wHere * 0.42, tang + side * (38 + rnd() * 26), 0.65 + rnd() * 0.45, rnd);
    }
  }

  // The crown: every family gets its own wedge of the sky, sized by what its descendants need.
  // Limbs are drawn in polar space (radius + angle around the fork) with the same easing, so
  // sibling limbs keep their left-to-right order at every radius and cannot cross.
  function crown(c: Pt, trunkW: number, kids: Unit[]) {
    const HALF = 94, SX = 1.04, SY = 1.08; // slightly rounder than a flat fan
    // how much of the sky a family wants: one share per leaf, with a floor so a lone limb still has room
    const need = (u: Unit): number => (u.children.length ? Math.max(1.5, u.children.reduce((s, k) => s + need(k), 0)) : 1);
    const at = (r: number, th: number): Pt => [c[0] + Math.sin(rad(th)) * r * SX, c[1] - Math.cos(rad(th)) * r * SY];
    // `bend` is shared by all siblings, so their angle changes with radius in the same way and they cannot cross
    const arcPts = (r0: number, th0: number, r1: number, th1: number, bend: number, n = 48): Pt[] =>
      Array.from({ length: n + 1 }, (_, i) => {
        const r = r0 + ((r1 - r0) * i) / n, q = Math.min(1, (r - r0) / bend), e = q * q * (3 - 2 * q);
        return at(r, th0 + (th1 - th0) * e);
      });

    const leaves: (() => void)[] = [];
    const grow = (list: Unit[], d: number, r0: number, th0: number, lo: number, hi_: number, pw: number) => {
      const needs = list.map(need), total = needs.reduce((s, v) => s + v, 0);
      const span = hi_ - lo;
      const weights = list.map(leafCount), wTotal = weights.reduce((s, v) => s + v, 0);
      // each limb is only as long as its name needs, or as far as it must go for its own children to have elbow room
      const wedges = needs.map((v) => span * (v / total));
      const ends = list.map((k, i) => {
        if (!k.children.length) return 0;
        const nameLen = Math.max(120, label(k).length * 8 + (d === 1 ? 110 : 50));
        const room = (k.children.length * 46) / rad(Math.max(6, wedges[i]));
        return Math.max(r0 + nameLen, Math.min(r0 + nameLen + 170, room));
      });
      const limbEnds = ends.filter(Boolean);
      const bend = limbEnds.length ? (Math.min(...limbEnds) - r0) * 0.9 : 90;
      let a = lo, leafNo = 0;
      list.forEach((k, i) => {
        const wedge = wedges[i], th = a + wedge / 2, rnd = rngFor(k.id);
        const from = a; a += wedge;
        if (k.children.length) {
          const w0 = list.length === 1 ? pw : Math.max(24, pw * Math.min(0.94, Math.sqrt(weights[i] / wTotal) * 1.25));
          const w1 = k.children.some((g) => g.children.length) ? Math.max(20, w0 * 0.72) : Math.max(15, w0 * 0.58);
          limb(arcPts(r0, th0, ends[i], th, bend), w0, w1, k, rnd);
          grow(k.children, d + 1, ends[i], th, from, from + wedge, w1);
        } else {
          const tier = leafNo++ % 3;
          // leaves are placed after every limb, each moving outward only as far as it needs to stay clear
          leaves.push(() => {
            const L = leafLen(k);
            const base = r0 + Math.max(44, Math.min(110, r0 * Math.abs(rad(th - th0)) * 0.55)) + tier * 34;
            let best = { r: base, th, pen: Infinity };
            search: for (let extra = 0; extra <= 300; extra += 25) for (const da of [0, 1.5, -1.5, 3, -3]) {
              const t = at(base + extra, th + da), o = at(base + extra + 40, th + da);
              const ang = (Math.atan2(o[1] - t[1], o[0] - t[0]) * 180) / Math.PI;
              const pen = leafPenalty(t[0], t[1], ang, L);
              if (pen < best.pen) best = { r: base + extra, th: th + da, pen };
              if (pen < 4) break search;
            }
            const tw = arcPts(r0, th0, best.r, best.th, (best.r - r0) * 0.9, 16), tip = tw[tw.length - 1], out = at(best.r + 40, best.th);
            twigs += `<path d="${ribbon(tw, 8, 2.6)}" fill="${BARK}"/>`;
            nameLeaf(tip[0], tip[1], (Math.atan2(out[1] - tip[1], out[0] - tip[0]) * 180) / Math.PI, k, rnd);
          });
        }
      });
    };
    grow(kids, 1, 0, 0, -HALF, HALF, trunkW);
    leaves.forEach((place) => place());
  }

  const top: Unit = roots.length === 1 ? roots[0] : { id: "__root", primary: { id: "__root", name: { en: rootLabel }, gender: "male" }, children: roots };
  const topText = roots.length === 1 ? label(roots[0]) : rootLabel;
  const soloRoot = top.children.length === 1 && top.children[0].children.length > 0, base = soloRoot ? 150 : 128;
  branch([0, 0], 0, 320, base, -1, top, topText, top.children);
  ext(0, 0, base);

  // root lobes and ground drawn behind the tree
  const flare = `<path d="M-64 -80C-76 -20 -130 10 -218 20C-150 34 -90 26 -56 14Z" fill="${BARK}"/><path d="M64 -80C76 -20 130 10 218 20C150 34 90 26 56 14Z" fill="${BARK}"/>`;
  const gw = Math.max(420, (maxX - minX) * 0.5);
  const ground = `<ellipse cx="0" cy="14" rx="${f(gw)}" ry="36" fill="#A06E40"/><ellipse cx="0" cy="9" rx="${f(gw * 0.8)}" ry="23" fill="#B88350"/>`;
  const mound = `<ellipse cx="0" cy="14" rx="${f(Math.min(gw, 300))}" ry="18" fill="#B88350"/><ellipse cx="0" cy="20" rx="${f(Math.min(gw, 300) * 0.7)}" ry="10" fill="#A06E40" opacity=".6"/>`;
  const pad = 70, y = minY - pad, h = 56 - y;
  let x = minX - pad - gw * 0.2, w = maxX - minX + pad * 2 + gw * 0.4;
  const minW = h * 1.25;
  if (w < minW) { x -= (minW - w) / 2; w = minW; }
  const vb = { x: f(x), y: f(y), w: f(w), h: f(h) };
  const sun = `<circle cx="${f(vb.x + vb.w * 0.82)}" cy="${f(vb.y + vb.h * 0.16)}" r="${f(Math.min(vb.w, vb.h) * 0.2)}" fill="url(#glow)"/>`;
  const inner = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7DABA"/><stop offset="1" stop-color="#EDB487"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#FFF3DC" stop-opacity=".85"/><stop offset="1" stop-color="#FFF3DC" stop-opacity="0"/></radialGradient>${defs}</defs>${sun}${ground}${flare}${twigs}${bark}${shade}${hi}${mound}${deco}${labels}${named}`;
  return { inner, vb };
}
