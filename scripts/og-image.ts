// Generates the share-preview image: npx tsx --tsconfig tsconfig.json scripts/og-image.ts [family.json]
import fs from "fs";
import sharp from "sharp";
import { buildUnits } from "../lib/tree";
import { paintTree } from "../lib/painted";

const src = process.argv[2] || "data/family.json";
const people = JSON.parse(fs.readFileSync(src, "utf8")).people;
const { inner, vb } = paintTree(buildUnits(people), "en", "Adatiya Parivar");
const W = 1200, H = 630, pad = 24;
const k = Math.min((H - pad * 2) / vb.h, (W * 0.62) / vb.w);
const tw = vb.w * k, th = vb.h * k, tx = W - tw - 70, ty = H - th - pad;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7DABA"/><stop offset="1" stop-color="#EDB487"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<svg x="${tx}" y="${ty}" width="${tw}" height="${th}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">${inner}</svg>
<text x="70" y="270" font-size="84" font-weight="800" fill="#4A2D20">Adatiya</text>
<text x="70" y="360" font-size="84" font-weight="800" fill="#4A2D20">Parivar</text>
<text x="74" y="415" font-size="30" fill="#6B4630">Our family tree · tap a leaf to explore</text>
</svg>`;
(async () => {
  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  fs.writeFileSync("app/opengraph-image.jpg", buf); fs.writeFileSync("app/twitter-image.jpg", buf);
  console.log("ok", buf.length);
})();
