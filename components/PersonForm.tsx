"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Lang } from "@/config/site";
import type { Business, Person, Relation } from "@/lib/types";
import { getT } from "@/lib/i18n";
import { addPersonAction, updatePersonAction, setPhotoAction, removePhotoAction } from "@/app/actions";

type Props = {
  form: { mode: "add"; relation: Relation; targetId: string } | { mode: "edit"; id: string };
  person?: Person; target?: Person; lang: Lang;
  onClose: () => void; onDone: (id?: string) => void;
};

// Shrink + convert to WebP in the browser (max 800px, ~50KB) so uploads are small; JPEG fallback if WebP is unsupported.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read photo"))), "image/webp", 0.8));
}

export default function PersonForm({ form, person, target, lang, onClose, onDone }: Props) {
  const t = getT(lang);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [removeIt, setRemoveIt] = useState(false);
  const [biz, setBiz] = useState<Business[]>(person?.businesses ?? []);
  const setB = (i: number, patch: Partial<Business>) => setBiz((l) => l.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(person?.photo ?? null);
  useEffect(() => {
    if (!file) { setPreview(removeIt ? null : person?.photo ?? null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file, removeIt, person?.photo]);
  const rel = form.mode === "add" ? form.relation : null;
  const relLabel = rel === "child" ? t.addChild : rel === "spouse" ? t.addSpouse : rel === "parent" ? t.addParent : rel === "sibling" ? t.addSibling : t.editTitle;
  const defaultGender = person?.gender ?? (rel === "spouse" && target ? (target.gender === "male" ? "female" : "male") : "male");
  const surname = target?.name.en.split(" ").slice(1).join(" ");
  const surnameGu = target?.name.gu?.split(" ").slice(1).join(" ");

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={relLabel} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        className="sheet pf"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = {
            nameEn: String(f.get("nameEn") ?? ""), nameGu: String(f.get("nameGu") ?? ""),
            gender: (f.get("gender") === "female" ? "female" : "male") as "male" | "female",
            birth: String(f.get("birth") ?? "").trim() || undefined, death: String(f.get("death") ?? "").trim() || undefined,
            phone: String(f.get("phone") ?? "").trim() || undefined, phonePublic: f.get("phonePublic") === "on",
            businesses: biz,
          };
          setErr("");
          start(async () => {
            const r = form.mode === "edit" ? await updatePersonAction(form.id, input) : await addPersonAction(form.relation, form.targetId, input);
            if (!r.ok) { setErr(r.error); return; }
            const pid = form.mode === "edit" ? form.id : (r as { id?: string }).id;
            if (pid && file) {
              try {
                const fd = new FormData(); fd.set("photo", await shrink(file), "photo.webp");
                const pr = await setPhotoAction(pid, fd);
                if (!pr.ok) { setErr(pr.error); return; }
              } catch { setErr("Could not process the photo"); return; }
            } else if (pid && removeIt) await removePhotoAction(pid);
            onDone(pid);
          });
        }}
      >
        <header className="pf-head">
          <h2>{relLabel}{target && <small> {t.relationTo} {target.name.en.split(" ")[0]}</small>}</h2>
          <button type="button" className="pf-x" aria-label={t.close} onClick={onClose}>×</button>
        </header>

        <div className="pf-body">
          <div className="pf-photo">
            <button type="button" className="pf-avatar" aria-label="Choose photo" onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="" /> : <svg aria-hidden width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>}
              <span className="pf-cam" aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg></span>
            </button>
            <div className="pf-photo-links">
              <button type="button" onClick={() => fileRef.current?.click()}>{preview ? "Change photo" : "Add photo"}</button>
              {preview && <button type="button" className="danger" onClick={() => { setFile(null); setRemoveIt(!!person?.photo); if (fileRef.current) fileRef.current.value = ""; }}>{t.remove}</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveIt(false); }} />
          </div>

          <label><span>{t.nameEn} <i className="req">*</i></span><input name="nameEn" required autoFocus defaultValue={person?.name.en ?? ""} placeholder={surname ? `Firstname ${surname}` : ""} /></label>
          <label>{t.nameGu}<input name="nameGu" defaultValue={person?.name.gu ?? ""} placeholder={surnameGu ? `નામ ${surnameGu}` : ""} /></label>

          <div className="pf-seg" role="radiogroup" aria-label={t.gender}>
            <label className="pf-opt"><input type="radio" name="gender" value="male" defaultChecked={defaultGender === "male"} /><span>{t.male}</span></label>
            <label className="pf-opt"><input type="radio" name="gender" value="female" defaultChecked={defaultGender === "female"} /><span>{t.female}</span></label>
          </div>

          <div className="pf-2">
            <label>{t.birth}<input name="birth" inputMode="numeric" placeholder="YYYY-MM-DD" defaultValue={person?.birth ?? ""} /></label>
            <label>{t.death}<input name="death" inputMode="numeric" placeholder="YYYY-MM-DD" defaultValue={person?.death ?? ""} /></label>
          </div>

          <div className="pf-sec-row">
            <h3 className="pf-sec">{t.phone}</h3>
            <label className="pf-mini"><span>{t.showPublic}</span><input type="checkbox" className="sw" name="phonePublic" defaultChecked={!!person?.phonePublic} /></label>
          </div>
          <label className="pf-plain"><input name="phone" type="tel" inputMode="tel" aria-label={t.phone} placeholder="+91 98765 43210" defaultValue={person?.phone ?? ""} /></label>

          <h3 className="pf-sec">{t.businesses}</h3>
          {biz.map((b, i) => (
            <div className="pf-biz" key={i}>
              <div className="pf-biz-top"><b>{t.businesses} {biz.length > 1 ? i + 1 : ""}</b><button type="button" className="pf-link danger" onClick={() => setBiz((l) => l.filter((_, j) => j !== i))}>{t.remove}</button></div>
              <label>{t.businessName}<input value={b.name} onChange={(e) => setB(i, { name: e.target.value })} required maxLength={80} /></label>
              <label>{t.about}<input value={b.about ?? ""} onChange={(e) => setB(i, { about: e.target.value })} maxLength={200} /></label>
              <div className="pf-2">
                <label>{t.phone}<input type="tel" inputMode="tel" value={b.phone ?? ""} onChange={(e) => setB(i, { phone: e.target.value })} /></label>
                <label>{t.email}<input type="email" inputMode="email" value={b.email ?? ""} onChange={(e) => setB(i, { email: e.target.value })} /></label>
              </div>
              <div className="pf-2">
                <label>{t.website}<input inputMode="url" placeholder="example.com" value={b.website ?? ""} onChange={(e) => setB(i, { website: e.target.value })} /></label>
                <label>{t.city}<input value={b.city ?? ""} onChange={(e) => setB(i, { city: e.target.value })} maxLength={60} /></label>
              </div>
              <label className="pf-switch"><span>{t.showPublic}</span><input type="checkbox" className="sw" checked={!!b.public} onChange={(e) => setB(i, { public: e.target.checked })} /></label>
            </div>
          ))}
          {biz.length < 10 && <button type="button" className="pf-add" onClick={() => setBiz((l) => [...l, { name: "" }])}>+ {t.addBusiness}</button>}
        </div>

        <footer className="pf-foot">
          {err && <p role="alert" className="err">{err}</p>}
          <div className="row">
            <button type="button" className="btn soft" onClick={onClose}>{t.cancel}</button>
            <button className="btn primary" disabled={pending}>{pending ? "…" : t.save}</button>
          </div>
        </footer>
      </form>
    </div>
  );
}
