"use client";

import { useState, type FormEvent } from "react";
import { LoginShowcase } from "@/components/login-showcase";

export function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "We could not sign you in. Check your details and try again.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mode-login">
    <LoginShowcase />
    <section className="mode-login-form-column" aria-label="Sign in">
      <section className="mode-login-card" aria-labelledby="login-title">
        <a className="mode-login-back" href="/">← Back to MODE</a>
        <p className="mode-login-brand">MO<span>DE</span><b>✦</b></p>
        <h1 id="login-title">Sign in to MODE</h1>
        <p>Use your club account to manage tasks and expenses</p>
        <form onSubmit={signIn} noValidate>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} onChange={() => setFieldErrors((current) => ({ ...current, email: undefined }))} />
          {fieldErrors.email && <span className="mode-field-error" id="email-error">{fieldErrors.email}</span>}
          <label htmlFor="password">Password</label>
          <span className="mode-password-field"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} onChange={() => setFieldErrors((current) => ({ ...current, password: undefined }))} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span>
          {fieldErrors.password && <span className="mode-field-error" id="password-error">{fieldErrors.password}</span>}
          {error && <p className="mode-login-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to MODE →"}</button>
        </form>
      </section>
    </section>
  </main>;
}
