"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthMeResponse, AuthResponse } from "@/lib/contracts";
import { api, ApiError, describeError } from "../../_lib/api";
import { useSession } from "../../_lib/session";

/* Same scrapbook treatment as the login page. */

export default function RegisterPage() {
  const router = useRouter();
  const session = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    if (session.status === "authenticated") router.replace("/app");
  }, [session.status, router]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name (at least 2 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      await api.post<AuthResponse>("/api/auth/register", { name: form.name.trim(), email: form.email.trim(), password: form.password });
      const me = await api.get<AuthMeResponse>("/api/auth/me");
      session.setSession(me);
      router.replace("/app");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setErrors({ email: "An account with this email already exists." });
      else if (caught instanceof ApiError && caught.details.length) setErrors(Object.fromEntries(caught.details.map((d) => [d.field, d.message])));
      else setError(describeError(caught, "We could not create your account."));
      setBusy(false);
    }
  }

  return (
    <main className="mode-login">
      <section className="mode-login-form-column" aria-label="Create account">
        <section className="mode-login-card" aria-labelledby="register-title">
          <h1 id="register-title">Join the club!</h1>
          <p>Create your member account.<br />Officers assign roles after you join.</p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="name">Full name</label>
            <input id="name" autoComplete="name" value={form.name} aria-invalid={Boolean(errors.name)} onChange={(e) => update("name", e.target.value)} />
            {errors.name && <span className="mode-field-error">{errors.name}</span>}
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={form.email} aria-invalid={Boolean(errors.email)} onChange={(e) => update("email", e.target.value)} />
            {errors.email && <span className="mode-field-error">{errors.email}</span>}
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="new-password" value={form.password} aria-invalid={Boolean(errors.password)} onChange={(e) => update("password", e.target.value)} />
            {errors.password && <span className="mode-field-error">{errors.password}</span>}
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" autoComplete="new-password" value={form.confirm} aria-invalid={Boolean(errors.confirm)} onChange={(e) => update("confirm", e.target.value)} />
            {errors.confirm && <span className="mode-field-error">{errors.confirm}</span>}
            {error && <p className="mode-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          </form>
          <p className="mode-login-help">Already a member? <Link href="/app/login"><strong>Log in</strong></Link></p>
        </section>
      </section>
    </main>
  );
}
