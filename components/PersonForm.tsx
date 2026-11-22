"use client";
import { useState, useTransition } from "react";
import type { Lang } from "@/config/site";
import type { Person, Relation } from "@/lib/types";
import { getT } from "@/lib/i18n";
import { addPersonAction, updatePersonAction } from "@/app/actions";

type Props = {
  form: { mode: "add"; relation: Relation; targetId: string } | { mode: "edit"; id: string };
  person?: Person; target?: Person; lang: Lang;
  onClose: () => void; onDone: (id?: string) => void;
};

export default function PersonForm({ form, person, target, lang, onClose, onDone }: Props) {
  const t = getT(lang);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
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
            if (r.ok) onDone(); else setErr(r.error);
          });
        }}
      >
        <h2>{relLabel}{target && <small> {t.relationTo} {target.name.en.split(" ")[0]}</small>}</h2>
        <label>{t.nameEn}<input name="nameEn" required autoFocus defaultValue={person?.name.en ?? ""} placeholder={surname ? `Firstname ${surname}` : ""} /></label>
        <label>{t.nameGu} <small>({t.optional})</small><input name="nameGu" defaultValue={person?.name.gu ?? ""} placeholder={surnameGu ? `નામ ${surnameGu}` : ""} /></label>
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
