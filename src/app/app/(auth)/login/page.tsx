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
import { AuthLanguage, AuthStory } from "../_story";

/* Sign-in on the product's own paper: brand story on the left, a quiet form card on the right. */

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
  }, [session.status, session.user, router, next]);

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
    <main className="mx-login">
      <AuthStory cardName={email} />
      <section className="mx-login-form" aria-label={t("auth.login.ariaLabel")}>
        <AuthLanguage />
        <div className="mx-login-card">
          <h2>{t("auth.login.title")}</h2>
          <p>{t("shell.description")}</p>
          <form onSubmit={signIn} noValidate>
            {error ? <div className="mx-login-alert" role="alert">{error}</div> : null}
            <label>
              {t("auth.login.emailLabel")}
              <input name="email" type="email" autoComplete="username" value={email} aria-invalid={Boolean(fieldErrors.email)} autoFocus onChange={(e) => { setEmail(e.target.value); setFieldErrors((c) => ({ ...c, email: undefined })); }} />
              {fieldErrors.email ? <span className="mx-login-error" role="alert">{fieldErrors.email}</span> : null}
            </label>
            <label>
              {t("auth.login.passwordLabel")}
              <span className="mx-login-pw">
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} aria-invalid={Boolean(fieldErrors.password)} onChange={(e) => { setPassword(e.target.value); setFieldErrors((c) => ({ ...c, password: undefined })); }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}>{showPassword ? t("auth.login.hide") : t("auth.login.show")}</button>
              </span>
              {fieldErrors.password ? <span className="mx-login-error" role="alert">{fieldErrors.password}</span> : null}
            </label>
            <div className="mx-login-options">
              <label><input type="checkbox" name="remember" />{t("auth.login.rememberMe")}</label>
              <span>{t("auth.login.forgotPassword")}</span>
            </div>
            <button type="submit" className="button primary" disabled={busy}>{busy ? t("auth.login.submitting") : t("auth.login.submit")}</button>
          </form>
          <p className="mx-login-links">
            {t("auth.login.newStudent")} <Link href="/app/register"><strong>{t("auth.login.joinLink")}</strong></Link><br />
            <Link href="/">{t("shell.brandHome")}</Link><br />
            <Link href="/status">Service status · No sign-in required</Link>
          </p>
          {demo ? (
            <div className="mx-login-demo">
              <strong>{t("auth.login.demoTitle")}</strong> · {t("auth.login.demoPassword")} <code>mode-demo-2026</code>
              <div>
                {DEMO_ACCOUNTS.map(([address, labelKey]) => (
                  <button key={address} type="button" title={address} onClick={() => { setEmail(address); setPassword("mode-demo-2026"); setFieldErrors({}); }}>{t(labelKey)}</button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
