"use client";
import { useState, useTransition } from "react";
import type { Lang } from "@/config/site";
import type { Person, Relation } from "@/lib/types";
import { getT } from "@/lib/i18n";
import { addPersonAction, updatePersonAction, setPhotoAction, removePhotoAction } from "@/app/actions";

type Props = {
  form: { mode: "add"; relation: Relation; targetId: string } | { mode: "edit"; id: string };
  person?: Person; target?: Person; lang: Lang;
  onClose: () => void; onDone: (id?: string) => void;
};

// Shrink + convert to WebP in the browser (max 1200px, ~100-150KB) so uploads are small; JPEG fallback if WebP is unsupported.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
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
  const rel = form.mode === "add" ? form.relation : null;
  const relLabel = rel === "child" ? t.addChild : rel === "spouse" ? t.addSpouse : rel === "parent" ? t.addParent : rel === "sibling" ? t.addSibling : t.editTitle;
  const defaultGender = person?.gender ?? (rel === "spouse" && target ? (target.gender === "male" ? "female" : "male") : "male");
  const surname = target?.name.en.split(" ").slice(1).join(" ");
  const surnameGu = target?.name.gu?.split(" ").slice(1).join(" ");

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={relLabel} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = {
            nameEn: String(f.get("nameEn") ?? ""), nameGu: String(f.get("nameGu") ?? ""),
            gender: (f.get("gender") === "female" ? "female" : "male") as "male" | "female",
            birth: String(f.get("birth") ?? "").trim() || undefined, death: String(f.get("death") ?? "").trim() || undefined,
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
        <h2>{relLabel}{target && <small> {t.relationTo} {target.name.en.split(" ")[0]}</small>}</h2>
        <label>{t.nameEn}<input name="nameEn" required autoFocus defaultValue={person?.name.en ?? ""} placeholder={surname ? `Firstname ${surname}` : ""} /></label>
        <label>{t.nameGu} <small>({t.optional})</small><input name="nameGu" defaultValue={person?.name.gu ?? ""} placeholder={surnameGu ? `નામ ${surnameGu}` : ""} /></label>
        <label>Photo <small>({t.optional})</small>
          <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveIt(false); }} />
        </label>
        {person?.photo && !file && (
          <label className="radio"><input type="checkbox" checked={removeIt} onChange={(e) => setRemoveIt(e.target.checked)} />Remove current photo</label>
        )}
        <fieldset>
          <legend>{t.gender}</legend>
          <label className="radio"><input type="radio" name="gender" value="male" defaultChecked={defaultGender === "male"} />{t.male}</label>
          <label className="radio"><input type="radio" name="gender" value="female" defaultChecked={defaultGender === "female"} />{t.female}</label>
        </fieldset>
        <label>{t.birth} <small>({t.optional})</small><input name="birth" inputMode="numeric" placeholder={t.dateHint} defaultValue={person?.birth ?? ""} /></label>
        <label>{t.death} <small>({t.optional})</small><input name="death" inputMode="numeric" placeholder={t.dateHint} defaultValue={person?.death ?? ""} /></label>
        {err && <p role="alert" className="err">{err}</p>}
        <div className="row">
          <button type="button" className="btn soft" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" disabled={pending}>{pending ? "…" : t.save}</button>
        </div>
      </form>
    </div>
  );
}
