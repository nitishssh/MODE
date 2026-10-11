"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthMeResponse, AuthResponse } from "@/lib/contracts";
import { api, ApiError } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { useSession } from "../../_lib/session";
import { homeFor } from "../../_lib/access";
import { AuthLanguage, AuthStory } from "../_story";

/* Registration shares the sign-in layout. */

export default function RegisterPage() {
  const { t, apiError } = useT();
  const router = useRouter();
  const session = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    if (session.status === "authenticated" && session.user) router.replace(homeFor(session.user));
  }, [session.status, session.user, router]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = t("auth.register.nameInvalid");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t("auth.register.emailInvalid");
    if (form.password.length < 8) next.password = t("auth.register.passwordShort");
    if (form.confirm !== form.password) next.confirm = t("auth.register.passwordMismatch");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      await api.post<AuthResponse>("/api/auth/register", { name: form.name.trim(), email: form.email.trim(), password: form.password });
      const me = await api.get<AuthMeResponse>("/api/auth/me");
      session.setSession(me);
      router.replace(homeFor(me.user));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setErrors({ email: t("auth.register.emailTaken") });
      else if (caught instanceof ApiError && caught.details.length) setErrors(Object.fromEntries(caught.details.map((d) => [d.field, d.message])));
      else setError(apiError(caught, "auth.register.failed"));
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type: string, autoComplete: string) => (
    <label key={key}>
      {label}
      <input type={type} autoComplete={autoComplete} value={form[key]} aria-invalid={Boolean(errors[key])} onChange={(e) => update(key, e.target.value)} />
      {errors[key] ? <span className="mx-login-error" role="alert">{errors[key]}</span> : null}
    </label>
  );

  return (
    <main className="mx-login">
      <AuthStory cardName={form.name || form.email} />
      <section className="mx-login-form" aria-label={t("auth.register.ariaLabel")}>
        <AuthLanguage />
        <div className="mx-login-card">
          <h2>{t("auth.register.title")}</h2>
          <p>{t("shell.description")}</p>
          <form onSubmit={submit} noValidate>
            {error ? <div className="mx-login-alert" role="alert">{error}</div> : null}
            {field("name", t("auth.register.nameLabel"), "text", "name")}
            {field("email", t("auth.register.emailLabel"), "email", "email")}
            {field("password", t("auth.register.passwordLabel"), "password", "new-password")}
            {field("confirm", t("auth.register.confirmLabel"), "password", "new-password")}
            <button type="submit" className="button primary" disabled={busy}>{busy ? t("auth.register.submitting") : t("auth.register.submit")}</button>
          </form>
          <p className="mx-login-links">{t("auth.register.alreadyMember")} <Link href="/app/login"><strong>{t("auth.register.loginLink")}</strong></Link></p>
        </div>
      </section>
    </main>
  );
}
