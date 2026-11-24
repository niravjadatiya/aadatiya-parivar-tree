"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/config/site";
import type { Person, Relation } from "@/lib/types";
import { buildUnits, countDescendants, layout, CARD_H, CARD_W, TOP } from "@/lib/tree";
import type { Node } from "@/lib/tree";
import { getT } from "@/lib/i18n";
import { formatDate, fullName, shortName } from "@/lib/format";
import { deletePersonAction, logoutAction } from "@/app/actions";
import PersonForm from "./PersonForm";

type Props = {
  people: Person[]; isAdmin: boolean;
  familyName: { en: string; gu: string };
  defaultLang: Lang; languages: Lang[];
};
type FormState = { mode: "add"; relation: Relation; targetId: string } | { mode: "edit"; id: string } | null;

function Avatar({ p, size = 44, ring = false }: { p: Person; size?: number; ring?: boolean }) {
  const f = p.gender === "female";
  return (
    <span className="avatar" style={{ width: size, height: size, background: f ? "#F9D5E3" : "#D4E4F7", outline: ring ? "2px solid var(--accent)" : undefined }}>
      {p.photo ? <img src={p.photo} alt="" width={size} height={size} /> : (
        <svg aria-hidden width={size} height={size} viewBox="0 0 44 44"><circle cx="22" cy="17" r="8" fill={f ? "#E58BB0" : "#7FAAD9"} /><path d="M6 44c0-12 7-18 16-18s16 6 16 18z" fill={f ? "#E58BB0" : "#7FAAD9"} /></svg>
      )}
    </span>
  );
}

export default function FamilyApp({ people, isAdmin, familyName, defaultLang, languages }: Props) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [, startT] = useTransition();
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const vp = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const t = getT(lang);

  useEffect(() => { try { const s = localStorage.getItem("lang"); if (s === "en" || s === "gu") setLang(s); } catch {} }, []);
  const pickLang = (l: Lang) => { setLang(l); try { localStorage.setItem("lang", l); } catch {} };

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const roots = useMemo(() => buildUnits(people), [people]);
  const { nodes, lines, width, height } = useMemo(() => layout(roots, expanded), [roots, expanded]);
  const generations = useMemo(() => {
    const d = (u: (typeof roots)[number]): number => 1 + Math.max(0, ...u.children.map(d));
    return Math.max(1, ...roots.map(d));
  }, [roots]);

  const fit = useCallback(() => {
    const el = vp.current; if (!el) return;
    const k = Math.min(1, (el.clientWidth - 32) / width);
    setView({ k, x: (el.clientWidth - width * k) / 2, y: 8 });
  }, [width]);
  const firstFit = useRef(false);
  useEffect(() => { if (!firstFit.current) { firstFit.current = true; fit(); } }, [fit]);

  // wheel: pan (ctrl/pinch: zoom)
  useEffect(() => {
    const el = vp.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const r = el.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top;
        setView((v) => { const k = Math.min(2, Math.max(0.3, v.k * Math.exp(-e.deltaY * 0.01))); const s = k / v.k; return { k, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s }; });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // drag to pan, two fingers to zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    pinch.current = 0;
    const move = (ev: PointerEvent) => {
      const prev = pointers.current.get(ev.pointerId); if (!prev) return;
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const pts = [...pointers.current.values()];
      if (pts.length === 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinch.current) { const f = d / pinch.current; setView((v) => ({ ...v, k: Math.min(2, Math.max(0.3, v.k * f)) })); }
        pinch.current = d; moved.current = true; return;
      }
      const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 5) moved.current = true; if (moved.current) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy })); }
    };
    const up = (ev: PointerEvent) => {
      pointers.current.delete(ev.pointerId); pinch.current = 0;
      if (!pointers.current.size) { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const zoom = (f: number) => setView((v) => {
    const el = vp.current; const cx = el ? el.clientWidth / 2 : 0, cy = el ? el.clientHeight / 2 : 0;
    const k = Math.min(2, Math.max(0.3, v.k * f)); const s = k / v.k; return { k, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s };
  });

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allIds = useMemo(() => { const ids: string[] = []; const w = (u: (typeof roots)[number]) => { if (u.children.length) ids.push(u.id); u.children.forEach(w); }; roots.forEach(w); return ids; }, [roots]);
  const expandAll = () => { setExpanded(new Set(allIds)); setTimeout(fit, 30); };
  const collapseAll = () => { setExpanded(new Set()); setTimeout(fit, 30); };

  const sel = selectedId ? byId.get(selectedId) : undefined;
  const selSpouse = sel?.spouseId ? byId.get(sel.spouseId) : undefined;
  const selParents = useMemo(() => {
    if (!sel?.parentId) return [] as Person[];
    const p = byId.get(sel.parentId); const s = p?.spouseId ? byId.get(p.spouseId) : undefined;
    return [p, s].filter(Boolean) as Person[];
  }, [sel, byId]);
  const selChildren = sel ? people.filter((c) => c.parentId && (c.parentId === sel.id || c.parentId === sel.spouseId)) : [];

  const doDelete = () => {
    if (!sel || !window.confirm(t.confirmDelete)) return;
    startT(async () => { const r = await deletePersonAction(sel.id); if (!r.ok) window.alert(r.error); else { setSelectedId(null); router.refresh(); } });
  };
  const logout = () => startT(async () => { await logoutAction(); router.refresh(); });

  // search
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return [] as Person[];
    return people.filter((p) => p.name.en.toLowerCase().includes(k) || (p.name.gu ?? "").includes(k)).slice(0, 6);
  }, [q, people]);
  const pick = (p: Person) => {
    const parentOf = new Map<string, (typeof roots)[number] | undefined>();
    const unitOf = new Map<string, (typeof roots)[number]>();
    const walk = (u: (typeof roots)[number], par?: (typeof roots)[number]) => {
      parentOf.set(u.id, par); unitOf.set(u.primary.id, u); if (u.spouse) unitOf.set(u.spouse.id, u);
      u.children.forEach((c) => walk(c, u));
    };
    roots.forEach((r) => walk(r));
    const unit = unitOf.get(p.id); if (!unit) return;
    const next = new Set(expanded);
    for (let a = parentOf.get(unit.id); a; a = parentOf.get(a.id)) next.add(a.id);
    setExpanded(next); setSelectedId(p.id); setQ("");
    const l = layout(roots, next); const node = l.nodes.find((n) => n.unit.id === unit.id); const el = vp.current;
    if (node && el) {
      const wide = el.clientWidth >= 768 + 340;
      setView({ k: 1, x: (wide ? (el.clientWidth - 340) / 2 : el.clientWidth / 2) - node.x, y: Math.max(8, el.clientHeight * 0.22 - node.y) });
    }
  };

  const rootNode = nodes[0];
  const personLine = (p: Person) => formatDate(p.birth, lang);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>{lang === "gu" ? familyName.gu : familyName.en}</h1>
          <p>
            {people.length} {t.members} · {generations} {t.generations}
            {isAdmin && <span className="chip-admin">{t.adminMode}</span>}
          </p>
        </div>
        <div className="top-actions">
          {languages.length > 1 && (
            <div className="seg" role="group" aria-label="Language">
              <button aria-pressed={lang === "en"} onClick={() => pickLang("en")}>EN</button>
              <button aria-pressed={lang === "gu"} onClick={() => pickLang("gu")}>ગુ</button>
            </div>
          )}
          {isAdmin && <button className="btn soft hide-sm" onClick={logout}>{t.signOut}</button>}
        </div>
      </header>

      <div className="searchbar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} />
        {q.trim() && (
          <ul className="results">
            {results.length ? results.map((r) => (
              <li key={r.id}><button onClick={() => pick(r)}><Avatar p={r} size={32} /><span>{fullName(r, lang)}{r.birth ? <small> · {formatDate(r.birth, lang)}</small> : null}</span></button></li>
            )) : <li className="none">{t.noResults}</li>}
          </ul>
        )}
      </div>

      <div className="stage">
        <div className="viewport" ref={vp} onPointerDown={onPointerDown} onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }}>
          <div className="world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, width, height: height + 40 }}>
            <svg className="lines" width={width} height={height + 40} aria-hidden><path d={lines.join("")} fill="none" stroke="#CDBFAB" strokeWidth="2" /></svg>

            {isAdmin && rootNode && !rootNode.unit.primary.parentId && (
              <>
                <svg className="lines" width={width} height={TOP} aria-hidden><path d={`M${rootNode.x} 44V${TOP}`} stroke="#CDBFAB" strokeWidth="2" fill="none" /></svg>
                <button className="ghost" style={{ left: rootNode.x - 100, top: 0 }} onClick={() => setForm({ mode: "add", relation: "parent", targetId: rootNode.unit.primary.id })}>
                  + {t.addParentsOf} {shortName(rootNode.unit.primary, lang)}
                </button>
              </>
            )}

            {nodes.map((n: Node) => {
              const u = n.unit; const open = expanded.has(u.id); const count = countDescendants(u);
              const label = u.spouse ? `${shortName(u.primary, lang)} & ${shortName(u.spouse, lang)}` : fullName(u.primary, lang);
              const isSel = selectedId === u.primary.id || selectedId === u.spouse?.id;
              return (
                <div key={u.id} className={"unit" + (isSel ? " sel" : "")} style={{ left: n.x - CARD_W / 2, top: n.y, width: CARD_W, height: CARD_H }}>
                  <button className="unit-main" onClick={() => setSelectedId(u.primary.id)} aria-label={label}>
                    <span className="avatars">
                      <Avatar p={u.primary} />
                      {u.spouse && <span style={{ marginLeft: -12 }} role="button" aria-label={fullName(u.spouse, lang)} onClick={(e) => { e.stopPropagation(); setSelectedId(u.spouse!.id); }}><Avatar p={u.spouse} /></span>}
                    </span>
                    <span className="unit-text"><b>{label}</b><small>{personLine(u.primary)}</small></span>
                  </button>
                  {u.children.length > 0 && (
                    <button className={"toggle" + (open ? "" : " badge")} onClick={() => toggle(u.id)} aria-expanded={open} aria-label={open ? t.collapse : `${t.expand} (${count})`}>
                      {!open && count}
                      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="tools">
          <button className="btn soft" onClick={expanded.size ? collapseAll : expandAll}>{expanded.size ? t.collapseAll : t.expandAll}</button>
          <button className="btn soft" onClick={fit}>{t.fit}</button>
          <button className="btn soft sq" aria-label="Zoom out" onClick={() => zoom(0.8)}>−</button>
          <button className="btn soft sq" aria-label="Zoom in" onClick={() => zoom(1.25)}>+</button>
        </div>
      </div>

      {sel && (
        <aside className="panel" aria-label="Person details">
          <button className="close" aria-label={t.close} onClick={() => setSelectedId(null)}>×</button>
          <div className="who">
            {sel.photo ? (
              <button className="photo-btn" aria-label="View photo" onClick={() => setLightbox(sel.photo!)}><Avatar p={sel} size={56} /></button>
            ) : <Avatar p={sel} size={56} />}
            <div>
              <h2>{fullName(sel, lang)}</h2>
              {sel.name.gu && lang === "en" && <p>{sel.name.gu}</p>}
              {lang === "gu" && <p>{sel.name.en}</p>}
            </div>
          </div>
          <dl>
            <div><dt>{t.born}</dt><dd>{formatDate(sel.birth, lang) || "—"}</dd></div>
            {sel.death && <div><dt>{t.died}</dt><dd>{formatDate(sel.death, lang)}</dd></div>}
            <div><dt>{t.spouse}</dt><dd>{selSpouse ? <a href="#" onClick={(e) => { e.preventDefault(); setSelectedId(selSpouse.id); }}>{`${shortName(selSpouse, lang)}${selSpouse.birth ? ` (${formatDate(selSpouse.birth, lang)})` : ""}`}</a> : t.none}</dd></div>
            <div><dt>{t.parents}</dt><dd>{selParents.length ? selParents.map((p) => shortName(p, lang)).join(" & ") : t.none}</dd></div>
            <div><dt>{t.children}</dt><dd>{selChildren.length ? selChildren.map((p) => shortName(p, lang)).join(", ") : t.none}</dd></div>
          </dl>
          {isAdmin && (
            <div className="admin-actions">
              <button className="btn primary" onClick={() => setForm({ mode: "add", relation: "child", targetId: sel.id })}>+ {t.addChild}</button>
              <button className="btn soft" disabled={!!sel.spouseId} onClick={() => setForm({ mode: "add", relation: "spouse", targetId: sel.id })}>+ {t.addSpouse}</button>
              <button className="btn soft" disabled={!!sel.parentId} onClick={() => setForm({ mode: "add", relation: "parent", targetId: sel.id })}>+ {t.addParent}</button>
              <button className="btn soft" disabled={!sel.parentId} onClick={() => setForm({ mode: "add", relation: "sibling", targetId: sel.id })}>+ {t.addSibling}</button>
              <button className="btn soft" onClick={() => setForm({ mode: "edit", id: sel.id })}>{t.edit}</button>
              <button className="btn danger" onClick={doDelete}>{t.delete}</button>
            </div>
          )}
        </aside>
      )}

      {lightbox && (
        <div className="modal" role="dialog" aria-label="Photo" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={{ maxWidth: "94vw", maxHeight: "90vh", borderRadius: 12, background: "#fff" }} />
        </div>
      )}

      {form && (
        <PersonForm
          key={form.mode === "edit" ? form.id : form.relation + form.targetId}
          form={form} person={form.mode === "edit" ? byId.get(form.id) : undefined}
          target={form.mode === "add" ? byId.get(form.targetId) : undefined}
          lang={lang}
          onClose={() => setForm(null)}
          onDone={(newId) => { setForm(null); if (form.mode === "add") setExpanded((s) => new Set(s).add(roots.find((r) => r.id === form.targetId)?.id ?? form.targetId)); router.refresh(); void newId; }}
        />
      )}
    </div>
  );
}
