"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthMeResponse, AuthResponse } from "@/lib/contracts";
import { api, ApiError } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { useSession } from "../../_lib/session";
import { homeFor } from "../../_lib/access";

/* Same scrapbook treatment as the login page. */

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
  }, [session.status, router]);

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

  return (
    <main className="mode-login">
      <section className="mode-login-form-column" aria-label={t("auth.register.ariaLabel")}>
        <section className="mode-login-card" aria-labelledby="register-title">
          <h1 id="register-title">{t("auth.register.title")}</h1>
          <p>{t("auth.register.leadLine1")}<br />{t("auth.register.leadLine2")}</p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="name">{t("auth.register.nameLabel")}</label>
            <input id="name" autoComplete="name" value={form.name} aria-invalid={Boolean(errors.name)} onChange={(e) => update("name", e.target.value)} />
            {errors.name && <span className="mode-field-error">{errors.name}</span>}
            <label htmlFor="email">{t("auth.register.emailLabel")}</label>
            <input id="email" type="email" autoComplete="email" value={form.email} aria-invalid={Boolean(errors.email)} onChange={(e) => update("email", e.target.value)} />
            {errors.email && <span className="mode-field-error">{errors.email}</span>}
            <label htmlFor="password">{t("auth.register.passwordLabel")}</label>
            <input id="password" type="password" autoComplete="new-password" value={form.password} aria-invalid={Boolean(errors.password)} onChange={(e) => update("password", e.target.value)} />
            {errors.password && <span className="mode-field-error">{errors.password}</span>}
            <label htmlFor="confirm">{t("auth.register.confirmLabel")}</label>
            <input id="confirm" type="password" autoComplete="new-password" value={form.confirm} aria-invalid={Boolean(errors.confirm)} onChange={(e) => update("confirm", e.target.value)} />
            {errors.confirm && <span className="mode-field-error">{errors.confirm}</span>}
            {error && <p className="mode-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? t("auth.register.submitting") : t("auth.register.submit")}</button>
          </form>
          <p className="mode-login-help">{t("auth.register.alreadyMember")} <Link href="/app/login"><strong>{t("auth.register.loginLink")}</strong></Link></p>
        </section>
      </section>
    </main>
  );
}
