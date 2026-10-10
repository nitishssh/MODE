"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthMeResponse, AuthResponse } from "@/lib/contracts";
import { api, ApiError, describeError } from "../../_lib/api";
import { useSession } from "../../_lib/session";

/* Azman's scrapbook login page (login-page.css), with the form posting to /app. */

const DEMO_ACCOUNTS = [
  ["lead@example.com", "Admin"],
  ["organizer@example.com", "Organizer"],
  ["treasurer@example.com", "Treasurer"],
  ["volunteer@example.com", "Volunteer"],
  ["active@example.com", "Active member"],
  ["expired@example.com", "Expired member"],
] as const;

function safeNext(value: string | null): string {
  return value && value.startsWith("/app") && !value.startsWith("//") ? value : "/app";
}

function LoginForm() {
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

  useEffect(() => {
    if (session.status === "authenticated") router.replace(next);
  }, [session.status, router, next]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? undefined : "Enter your club email address.",
      password: password ? undefined : "Enter your password.",
    };
    if (nextErrors.email || nextErrors.password) { setFieldErrors(nextErrors); return; }
    setFieldErrors({});
    setError("");
    setBusy(true);
    try {
      await api.post<AuthResponse>("/api/auth/login", { email: email.trim(), password });
      const me = await api.get<AuthMeResponse>("/api/auth/me");
      session.setSession(me);
      router.replace(next);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setError("We could not sign you in. Check your details and try again.");
      else setError(describeError(caught, "We could not sign you in. Please try again."));
      setBusy(false);
    }
  }

  return (
    <main className="mode-login">
      <section className="mode-login-form-column" aria-label="Sign in">
        <section className="mode-login-card" aria-labelledby="login-title">
          <h1 id="login-title">Welcome back!</h1>
          <p>Sign in to your Student Organization System (SOS).<br />Events · Members · Money in one place.</p>
          <form onSubmit={signIn} noValidate>
            <label htmlFor="email">Email or Student ID</label>
            <input id="email" name="email" type="email" autoComplete="username" value={email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} onChange={(e) => { setEmail(e.target.value); setFieldErrors((c) => ({ ...c, email: undefined })); }} />
            {fieldErrors.email && <span className="mode-field-error" id="email-error">{fieldErrors.email}</span>}
            <label htmlFor="password">Password</label>
            <span className="mode-password-field">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} onChange={(e) => { setPassword(e.target.value); setFieldErrors((c) => ({ ...c, password: undefined })); }} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
            </span>
            {fieldErrors.password && <span className="mode-field-error" id="password-error">{fieldErrors.password}</span>}
            <div className="mode-login-options"><label><input type="checkbox" name="remember" />Remember me</label><span>Forgot password?</span></div>
            {error && <p className="mode-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Log In"}</button>
          </form>
          <p className="mode-login-help">New student? <Link href="/app/register"><strong>Join the Association</strong></Link><br />Treasurer &amp; Admin Help</p>
          <div className="mx-demo">
            <strong>Demo accounts</strong> · password <code>mode-demo-2026</code>
            <div style={{ marginTop: 4 }}>
              {DEMO_ACCOUNTS.map(([address, label]) => (
                <button key={address} type="button" title={address} onClick={() => { setEmail(address); setPassword("mode-demo-2026"); setFieldErrors({}); }}>{label}</button>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
