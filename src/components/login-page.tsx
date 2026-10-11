"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { authHref, resolveWebReturnTarget } from "../../shared/return-target";

export function LoginPage({ returnTo, registrationEnabled }: { returnTo: string; registrationEnabled: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const registerQuery = new URLSearchParams({ returnTo: authHref("/register", returnTo).params.returnTo ?? "/dashboard" });
  const openDestination = useCallback((user: unknown) => {
    if (!user || typeof user !== "object" || !("permissions" in user) ||
      !Array.isArray(user.permissions) || !user.permissions.every(permission => typeof permission === "string")) {
      throw new Error("The server returned an invalid session. Please try again.");
    }
    const destination = resolveWebReturnTarget({ permissions: user.permissions }, returnTo, registrationEnabled);
    if (!destination.allowed) { setForbidden(true); return; }
    // A full document navigation hands Expo URLs to Next's declared rewrites.
    // The web session stays in its HttpOnly cookie; the API token is never stored.
    window.location.replace(destination.target);
  }, [returnTo, registrationEnabled]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => {
        if (response.ok) {
          const result = await response.json();
          if (active) openDestination(result.user);
        }
        else if (response.status !== 401) throw new Error("Could not check your session. Please try signing in.");
      }).catch(cause => {
        if (active) setError(controller.signal.aborted ? "Checking your session timed out. Please try signing in." : cause instanceof Error ? cause.message : "Could not check your session.");
      }).finally(() => { window.clearTimeout(timeout); if (active) setChecking(false); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [openDestination]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || checking) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email")).trim();
    const password = String(values.get("password"));
    const nextErrors = {
      email: email ? undefined : "Enter your club email address.",
      password: password ? undefined : "Enter your password.",
    };
    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "We could not sign you in. Check your details and try again.");
      openDestination(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mode-login">
    <section className="mode-login-form-column" aria-label="Sign in">
      <section className="mode-login-card" aria-labelledby="login-title">
        {forbidden ? <>
          <h1 id="login-title">Access denied</h1>
          <p role="alert">Your current club permissions do not allow access to the requested page.</p>
          <a href="/dashboard">Open your workspace →</a>
        </> : <>
        <h1 id="login-title">Welcome back!</h1>
        <p>Sign in to your Student Organization System (SOS).<br />Events · Members · Money in one place.</p>
        <form onSubmit={signIn} noValidate>
          <label htmlFor="email">Email or Student ID</label>
          <input id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} onChange={() => setFieldErrors((current) => ({ ...current, email: undefined }))} />
          {fieldErrors.email && <span className="mode-field-error" id="email-error">{fieldErrors.email}</span>}
          <label htmlFor="password">Password</label>
          <span className="mode-password-field"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} onChange={() => setFieldErrors((current) => ({ ...current, password: undefined }))} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span>
          {fieldErrors.password && <span className="mode-field-error" id="password-error">{fieldErrors.password}</span>}
          <div className="mode-login-options"><label><input type="checkbox" name="remember" />Remember me</label><span>Forgot password?</span></div>
          {error && <p className="mode-login-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || checking}>{checking ? "Checking session…" : busy ? "Signing in…" : "Log In"}</button>
        </form>
        <p className="mode-login-help">New student? {registrationEnabled ? <a href={`/register?${registerQuery}`}><strong>Join the Association</strong></a> : <strong>Join the Association</strong>}<br />Treasurer &amp; Admin Help</p>
        </>}
      </section>
    </section>
  </main>;
}
