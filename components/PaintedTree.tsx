"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "@/config/site";
import type { Unit } from "@/lib/tree";
import { paintTree } from "@/lib/painted";

type Props = { roots: Unit[]; lang: Lang; rootLabel: string; onSelect: (id: string) => void; labels: { fit: string; save: string } };

export default function PaintedTree({ roots, lang, rootLabel, onSelect, labels }: Props) {
  const { inner, vb } = useMemo(() => paintTree(roots, lang, rootLabel), [roots, lang, rootLabel]);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const moved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  const fit = useCallback(() => {
    const el = box.current; if (!el) return;
    const k = Math.min(el.clientWidth / vb.w, el.clientHeight / vb.h);
    setView({ k, x: (el.clientWidth - vb.w * k) / 2 - vb.x * k, y: (el.clientHeight - vb.h * k) / 2 - vb.y * k });
  }, [vb]);
  useEffect(() => { fit(); }, [fit]);

  const zoomAt = (f: number, cx: number, cy: number) => setView((v) => {
    const k = Math.min(4, Math.max(0.1, v.k * f)), s = k / v.k;
    return { k, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s };
  });

  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false; pinch.current = 0;
    const move = (ev: PointerEvent) => {
      const prev = pointers.current.get(ev.pointerId); if (!prev) return;
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const pts = [...pointers.current.values()];
      if (pts.length === 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const r = box.current!.getBoundingClientRect();
        if (pinch.current) zoomAt(d / pinch.current, (pts[0].x + pts[1].x) / 2 - r.left, (pts[0].y + pts[1].y) / 2 - r.top);
        pinch.current = d; moved.current = true; return;
      }
      const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
      if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 5) moved.current = true;
      if (moved.current) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    };
    const up = (ev: PointerEvent) => {
      pointers.current.delete(ev.pointerId); pinch.current = 0;
      if (!pointers.current.size) { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  const onClick = (e: React.MouseEvent) => {
    if (moved.current) { moved.current = false; return; }
    const id = (e.target as Element).closest("[data-pid]")?.getAttribute("data-pid");
    if (id && id !== "__root") onSelect(id);
  };

  const save = () => {
    const title = `<text x="${vb.x + 24}" y="${vb.y + 40}" font-size="26" font-weight="700" fill="#4A2D20" font-family="system-ui, sans-serif">${rootLabel.replace(/&/g, "&amp;")}</text>`;
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${vb.w}" height="${vb.h}" font-family="system-ui, sans-serif">${inner}${title}</svg>`;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(2, 4096 / Math.max(vb.w, vb.h));
      const c = document.createElement("canvas"); c.width = Math.round(vb.w * scale); c.height = Math.round(vb.h * scale);
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "family-tree.png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  };

  return (
    <div className="viewport painted" ref={box} onPointerDown={onPointerDown} onClick={onClick}>
      <svg className="painted-svg" width={vb.w} height={vb.h} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${view.x + vb.x * view.k}px,${view.y + vb.y * view.k}px) scale(${view.k})` }}
        dangerouslySetInnerHTML={{ __html: inner }} />
      <div className="tools" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <button className="btn soft" onClick={save}>{labels.save}</button>
        <button className="btn soft" onClick={fit}>{labels.fit}</button>
        <button className="btn soft sq" aria-label="Zoom out" onClick={() => { const r = box.current!; zoomAt(0.8, r.clientWidth / 2, r.clientHeight / 2); }}>−</button>
        <button className="btn soft sq" aria-label="Zoom in" onClick={() => { const r = box.current!; zoomAt(1.25, r.clientWidth / 2, r.clientHeight / 2); }}>+</button>
      </div>
    </div>
  );
}
