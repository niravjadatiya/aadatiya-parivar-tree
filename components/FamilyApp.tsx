"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/config/site";
import type { Person, Relation } from "@/lib/types";
import PaintedTree from "./PaintedTree";
import BulkModal from "./BulkModal";
import { buildUnits, countDescendants, layout, FULL, COMPACT } from "@/lib/tree";
import type { Node } from "@/lib/tree";
import { getT } from "@/lib/i18n";
import { formatDate, fullName, shortName } from "@/lib/format";
import { deletePersonAction, logoutAction } from "@/app/actions";
import PersonForm from "./PersonForm";

type Props = {
  people: Person[]; isAdmin: boolean;
  familyName: { en: string; gu: string };
  defaultLang: Lang; languages: Lang[];
  contact: { name: string; phone: string; display: string };
  credit: { text: string; url: string };
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

export default function FamilyApp({ people, isAdmin, familyName, defaultLang, languages, contact, credit }: Props) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [, startT] = useTransition();
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [bulk, setBulk] = useState(false);
  const [mode, setMode] = useState<"chart" | "painted">("chart");
  useEffect(() => { try { if (localStorage.getItem("view") === "painted") setMode("painted"); } catch {} }, []);
  const pickMode = (m: "chart" | "painted") => { setMode(m); try { localStorage.setItem("view", m); } catch {} };
  const [compact, setCompact] = useState(false);
  const M = compact ? COMPACT : FULL;
  const vp = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const t = getT(lang);

  const [visits, setVisits] = useState<number | null>(null);
  useEffect(() => {
    let counted = false; try { counted = !!sessionStorage.getItem("visited"); sessionStorage.setItem("visited", "1"); } catch {}
    fetch("/api/visit", { method: counted ? "GET" : "POST" }).then((r) => r.json()).then((d) => setVisits(d.count)).catch(() => {});
  }, []);
  useEffect(() => { try { const s = localStorage.getItem("lang"); if (s === "en" || s === "gu") setLang(s); } catch {} }, []);
  const pickLang = (l: Lang) => { setLang(l); try { localStorage.setItem("lang", l); } catch {} };

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const roots = useMemo(() => buildUnits(people), [people]);
  const { nodes, lines, width, height } = useMemo(() => layout(roots, expanded, M), [roots, expanded, M]);
  const generations = useMemo(() => {
    const d = (u: (typeof roots)[number]): number => 1 + Math.max(0, ...u.children.map(d));
    return Math.max(1, ...roots.map(d));
  }, [roots]);

  const fit = useCallback(() => {
    const el = vp.current; if (!el) return;
    const k = Math.min(1, (el.clientWidth - 32) / width);
    setView({ k, x: (el.clientWidth - width * k) / 2, y: 8 });
  }, [width]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setCompact(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const lastCompact = useRef(false);
  useEffect(() => { if (lastCompact.current !== compact) { lastCompact.current = compact; fit(); } }, [compact, fit]);
  const firstFit = useRef(false);
  useEffect(() => { if (!firstFit.current) { firstFit.current = true; fit(); } }, [fit]);

  // wheel: pan (ctrl/pinch: zoom)
  useEffect(() => {
    const el = vp.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // scroll wheel zooms toward the cursor (pinch on a trackpad zooms faster)
      const r = el.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      setView((v) => { const k = Math.min(2, Math.max(0.3, v.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)))); const s = k / v.k; return { k, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s }; });
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

  // Keep the tapped card exactly where it is on screen: re-layout, then shift the view by how far the card moved.
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    const before = nodes.find((n) => n.unit.id === id);
    const after = layout(roots, next, M).nodes.find((n) => n.unit.id === id);
    setExpanded(next);
    if (before && after) setView((v) => ({ ...v, x: v.x + (before.x - after.x) * v.k, y: v.y + (before.y - after.y) * v.k }));
  };
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
    const l = layout(roots, next, M); const node = l.nodes.find((n) => n.unit.id === unit.id); const el = vp.current;
    if (node && el) {
      const wide = el.clientWidth >= 768 + 340;
      setView({ k: 1, x: (wide ? (el.clientWidth - 340) / 2 : el.clientWidth / 2) - node.x, y: Math.max(8, el.clientHeight * 0.22 - node.y) });
    }
  };

  const rootNode = nodes[0];
  const yr = (p: Person) => p.birth?.slice(0, 4);
  const personLine = (u: { primary: Person; spouse?: Person }) =>
    u.spouse
      ? [u.primary, u.spouse].filter((x) => yr(x)).map((x) => `${shortName(x, lang)} ${yr(x)}`).join(" · ")
      : formatDate(u.primary.birth, lang);

  return (
    <div className={"app" + (compact ? " compact" : "")}>
      <header className="top">
        <div>
          <h1>{lang === "gu" ? familyName.gu : familyName.en}</h1>
          <p>
            {people.length} {t.members} · {generations} {t.generations}
            {isAdmin && <span className="chip-admin">{t.adminMode}</span>}
            {isAdmin && <button className="chip-admin chip-btn" onClick={() => setBulk(true)}>Bulk data</button>}
          </p>
        </div>
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
        <div className="top-actions">
          {languages.length > 1 && (
            <div className="seg" role="group" aria-label="Language">
              <button aria-pressed={lang === "en"} onClick={() => pickLang("en")}>EN</button>
              <button aria-pressed={lang === "gu"} onClick={() => pickLang("gu")}>ગુ</button>
            </div>
          )}
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={mode === "chart"} onClick={() => pickMode("chart")}>{t.viewChart}</button>
            <button aria-pressed={mode === "painted"} onClick={() => pickMode("painted")}>🌳 {t.viewTree}</button>
          </div>
          {isAdmin && <button className="btn soft hide-sm" onClick={logout}>{t.signOut}</button>}
        </div>
      </header>

      <div className="stage">
        {mode === "painted" ? (
          <PaintedTree roots={roots} lang={lang} rootLabel={lang === "gu" ? familyName.gu : familyName.en} onSelect={setSelectedId} labels={{ fit: t.fit, save: t.saveImage, hint: t.treeHint }} />
        ) : (
          <>
        <div className="viewport" ref={vp} onPointerDown={onPointerDown} onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }}>
          <div className="world" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, width, height: height + 40 }}>
            <svg className="lines" width={width} height={height + 40} aria-hidden><path d={lines.join("")} fill="none" stroke="#CDBFAB" strokeWidth="2" /></svg>

            {isAdmin && rootNode && !rootNode.unit.primary.parentId && (
              <>
                <svg className="lines" width={width} height={M.TOP} aria-hidden><path d={`M${rootNode.x} 44V${M.TOP}`} stroke="#CDBFAB" strokeWidth="2" fill="none" /></svg>
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
                <div key={u.id} className={"unit" + (isSel ? " sel" : "")} style={{ left: n.x - M.W / 2, top: n.y, width: M.W, height: M.H }}>
                  <button className="unit-main" onClick={() => setSelectedId(u.primary.id)} aria-label={label}>
                    <span className="avatars">
                      <Avatar p={u.primary} size={compact ? 34 : 44} />
                      {u.spouse && <span style={{ marginLeft: -12 }} role="button" aria-label={fullName(u.spouse, lang)} onClick={(e) => { e.stopPropagation(); setSelectedId(u.spouse!.id); }}><Avatar p={u.spouse} size={compact ? 34 : 44} /></span>}
                    </span>
                    <span className="unit-text"><b>{label}</b><small>{personLine(u)}</small></span>
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
          </>
        )}
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
            {sel.city && <div><dt>{t.city}</dt><dd>{sel.city}</dd></div>}
            <div><dt>{t.spouse}</dt><dd>{selSpouse ? <a href="#" onClick={(e) => { e.preventDefault(); setSelectedId(selSpouse.id); }}>{`${shortName(selSpouse, lang)}${selSpouse.birth ? ` (${formatDate(selSpouse.birth, lang)})` : ""}`}</a> : t.none}</dd></div>
            <div><dt>{t.parents}</dt><dd>{selParents.length ? selParents.map((p) => shortName(p, lang)).join(" & ") : t.none}</dd></div>
            <div><dt>{t.children}</dt><dd>{selChildren.length ? selChildren.map((p) => shortName(p, lang)).join(", ") : t.none}</dd></div>
          </dl>
          {(sel.phone || sel.businesses?.length) && (
            <div className="contact">
              {sel.phone && (
                <div className="contact-row">
                  <span>{t.phone}{isAdmin && !sel.phonePublic && <em className="lock"> · {t.privateTag}</em>}</span>
                  <span className="links"><a href={`tel:${sel.phone}`}>{sel.phone}</a><a href={`https://wa.me/${sel.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></span>
                </div>
              )}
              {sel.businesses?.map((b, i) => (
                <div className="biz-card" key={i}>
                  <b>{b.name}{isAdmin && !b.public && <em className="lock"> · {t.privateTag}</em>}</b>
                  {b.about && <p>{b.about}</p>}
                  {b.city && <p className="muted">{b.city}</p>}
                  <span className="links">
                    {b.phone && <a href={`tel:${b.phone}`}>{b.phone}</a>}
                    {b.phone && <a href={`https://wa.me/${b.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                    {b.email && <a href={`mailto:${b.email}`}>{b.email}</a>}
                    {b.website && <a href={b.website} target="_blank" rel="noopener noreferrer">{b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>}
                  </span>
                </div>
              ))}
            </div>
          )}
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

      <footer className="foot">
        <span className="foot-long">
          {lang === "gu" ? "ફોટા કે માહિતી ઉમેરવા/સુધારવા સંપર્ક કરો" : "To add or update photos and details, contact"} <b>{contact.name}</b>
        </span>
        <span className="foot-short">{lang === "gu" ? "માહિતી સુધારવી છે?" : "Update details?"}</span>
        <span className="foot-links">
          <a href={`tel:${contact.phone}`}>{lang === "gu" ? "કૉલ" : "Call"}<span className="foot-num"> {contact.display}</span></a>
          <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </span>
        <span className="foot-credit"><span className="credit-long">{lang === "gu" ? "❤️ સાથે વિકસાવ્યું" : "Developed with ❤️ by"} </span><span className="credit-short">❤️ </span><a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.text}</a></span>
        {visits ? <span className="foot-visits" title={lang === "gu" ? "મુલાકાતો" : "Visits"}>👁 {visits.toLocaleString("en-IN")}</span> : null}
      </footer>

      {bulk && <BulkModal onClose={() => setBulk(false)} />}

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
