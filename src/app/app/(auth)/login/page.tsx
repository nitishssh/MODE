"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthMeResponse, AuthResponse, Dashboard } from "@/lib/contracts";
import type { AppKey } from "@/i18n/app";
import { api, ApiError } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { useSession } from "../../_lib/session";
import { homeFor } from "../../_lib/access";

/* Azman's scrapbook login page (login-page.css), with the form posting to /app. */

const DEMO_ACCOUNTS: readonly [string, AppKey][] = [
  ["lead@example.com", "auth.demo.admin"],
  ["organizer@example.com", "auth.demo.organizer"],
  ["treasurer@example.com", "auth.demo.treasurer"],
  ["volunteer@example.com", "auth.demo.volunteer"],
  ["active@example.com", "auth.demo.activeMember"],
  ["expired@example.com", "auth.demo.expiredMember"],
];

function safeNext(value: string | null): string {
  return value && value.startsWith("/app") && !value.startsWith("//") ? value : "/app";
}

function LoginForm() {
  const { t, apiError } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (session.status === "authenticated" && session.user) router.replace(next === "/app" ? homeFor(session.user) : next);
  }, [session.status, router, next]);

  // The sample-account shortcuts only make sense while the fictional seed is present.
  useEffect(() => {
    api.get<Dashboard>("/api/dashboard").then((d) => setDemo(d.club.demo)).catch(() => setDemo(false));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? undefined : t("auth.login.emailRequired"),
      password: password ? undefined : t("auth.login.passwordRequired"),
    };
    if (nextErrors.email || nextErrors.password) { setFieldErrors(nextErrors); return; }
    setFieldErrors({});
    setError("");
    setBusy(true);
    try {
      await api.post<AuthResponse>("/api/auth/login", { email: email.trim(), password });
      const me = await api.get<AuthMeResponse>("/api/auth/me");
      session.setSession(me);
      router.replace(next === "/app" ? homeFor(me.user) : next);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setError(t("auth.login.badCredentials"));
      else setError(apiError(caught, "auth.login.failed"));
      setBusy(false);
    }
  }

  return (
    <main className="mode-login">
      <section className="mode-login-form-column" aria-label={t("auth.login.ariaLabel")}>
        <section className="mode-login-card" aria-labelledby="login-title">
          <h1 id="login-title">{t("auth.login.title")}</h1>
          <p>{t("auth.login.leadLine1")}<br />{t("auth.login.leadLine2")}</p>
          <form onSubmit={signIn} noValidate>
            <label htmlFor="email">{t("auth.login.emailLabel")}</label>
            <input id="email" name="email" type="email" autoComplete="username" value={email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} onChange={(e) => { setEmail(e.target.value); setFieldErrors((c) => ({ ...c, email: undefined })); }} />
            {fieldErrors.email && <span className="mode-field-error" id="email-error">{fieldErrors.email}</span>}
            <label htmlFor="password">{t("auth.login.passwordLabel")}</label>
            <span className="mode-password-field">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} onChange={(e) => { setPassword(e.target.value); setFieldErrors((c) => ({ ...c, password: undefined })); }} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}>{showPassword ? t("auth.login.hide") : t("auth.login.show")}</button>
            </span>
            {fieldErrors.password && <span className="mode-field-error" id="password-error">{fieldErrors.password}</span>}
            <div className="mode-login-options"><label><input type="checkbox" name="remember" />{t("auth.login.rememberMe")}</label><span>{t("auth.login.forgotPassword")}</span></div>
            {error && <p className="mode-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? t("auth.login.submitting") : t("auth.login.submit")}</button>
          </form>
          <p className="mode-login-help">{t("auth.login.newStudent")} <Link href="/app/register"><strong>{t("auth.login.joinLink")}</strong></Link><br />{t("auth.login.help")}</p>
          {demo ? <div className="mx-demo">
            <strong>{t("auth.login.demoTitle")}</strong> · {t("auth.login.demoPassword")} <code>mode-demo-2026</code>
            <div style={{ marginTop: 4 }}>
              {DEMO_ACCOUNTS.map(([address, labelKey]) => (
                <button key={address} type="button" title={address} onClick={() => { setEmail(address); setPassword("mode-demo-2026"); setFieldErrors({}); }}>{t(labelKey)}</button>
              ))}
            </div>
          </div> : null}
        </section>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
