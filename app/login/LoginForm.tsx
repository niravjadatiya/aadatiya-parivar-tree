"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "../actions";

export default function LoginForm({ name }: { name: { en: string; gu: string } }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <main className="login">
      <div className="login-brand">
        <div className="logo" aria-hidden>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5V12M12 12H5v4.5M12 12h7v4.5" /></svg>
        </div>
        <h1>{name.en}</h1>
        <p>{name.gu}</p>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setErr("");
          start(async () => {
            const r = await loginAction(String(f.get("u")), String(f.get("p")));
            if (r.ok) { router.replace("/"); router.refresh(); } else setErr("Wrong username or password");
          });
        }}
      >
        <h2>Admin sign in</h2>
        <label>Username<input name="u" autoComplete="username" autoCapitalize="none" required /></label>
        <label>Password<input name="p" type="password" autoComplete="current-password" required /></label>
        {err && <p role="alert" className="err">{err}</p>}
        <button className="btn primary" disabled={pending}>{pending ? "…" : "Sign in"}</button>
      </form>
    </main>
  );
}
