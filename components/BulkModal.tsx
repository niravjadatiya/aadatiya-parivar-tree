"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importApplyAction, importPreviewAction, type ImportResult } from "@/app/actions";

export default function BulkModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [remove, setRemove] = useState(false);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [busy, start] = useTransition();
  const rep = res?.report;

  const preview = (t: string, rm: boolean) => start(async () => setRes(await importPreviewAction(t, rm)));
  const pick = (f: File | undefined) => {
    if (!f) return;
    setName(f.name); setRes(null);
    f.text().then((t) => { setText(t); preview(t, remove); });
  };
  const apply = () => start(async () => { const r = await importApplyAction(text, remove); setRes(r); if (r.applied) router.refresh(); });
  const changes = rep ? rep.added.length + rep.updated.length + rep.removed.length : 0;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Bulk update" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet pf">
        <header className="pf-head"><h2>Bulk update</h2><button type="button" className="pf-x" aria-label="Close" onClick={onClose}>×</button></header>
        <div className="pf-body">
          <ol className="bulk-steps">
            <li><b>Download</b> the family data as a JSON file.</li>
            <li>Edit it. Each person in the file replaces that person (matched by <code>id</code>). A person without an <code>id</code>, or with a new one, is added.</li>
            <li><b>Upload</b> it. You see a preview first, and nothing is saved until you confirm.</li>
          </ol>
          <a className="btn soft bulk-dl" href="/api/export" download>Download data (JSON)</a>
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>{name ? "Choose another file" : "Upload edited file"}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <label className="pf-switch"><span>Also remove people who are not in the file</span><input type="checkbox" className="sw" checked={remove} onChange={(e) => { setRemove(e.target.checked); if (text) preview(text, e.target.checked); }} /></label>
          {busy && <p className="pf-hint">Working…</p>}
          {res?.error && <p role="alert" className="err">{res.error}</p>}
          {rep && (
            <div className="bulk-report">
              <p><b>{name}</b>: {rep.rows} people in the file. {rep.added.length} new, {rep.updated.length} changed, {rep.removed.length} removed, {rep.unchanged} unchanged.</p>
              {rep.errors.length > 0 && (<><p className="err"><b>Fix these first ({rep.errors.length}):</b></p><ul className="err">{rep.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul></>)}
              {rep.added.length > 0 && <details open={!rep.errors.length}><summary>New people ({rep.added.length})</summary><ul>{rep.added.slice(0, 50).map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
              {rep.updated.length > 0 && <details open={!rep.errors.length}><summary>Changed ({rep.updated.length})</summary><ul>{rep.updated.slice(0, 50).map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
              {rep.removed.length > 0 && <details open><summary className="err">Will be removed ({rep.removed.length})</summary><ul className="err">{rep.removed.slice(0, 50).map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
              {res?.applied && <p className="ok">Saved. The tree is updated.</p>}
            </div>
          )}
        </div>
        <footer className="pf-foot">
          <div className="row">
            <button type="button" className="btn soft" onClick={onClose}>{res?.applied ? "Done" : "Cancel"}</button>
            {!res?.applied && <button type="button" className="btn primary" disabled={busy || !rep || rep.errors.length > 0 || changes === 0} onClick={apply}>{changes ? `Apply ${changes} change${changes === 1 ? "" : "s"}` : "Apply"}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
