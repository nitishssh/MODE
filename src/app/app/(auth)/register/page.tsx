"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthMeResponse, AuthResponse } from "@/lib/contracts";
import { api, ApiError, describeError } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { Alert, Button, TextField } from "../../_components/ui";

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
      else if (caught instanceof ApiError && caught.details.length) {
        setErrors(Object.fromEntries(caught.details.map((d) => [d.field, d.message])));
      } else setError(describeError(caught, "We could not create your account."));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auth">
      <aside className="mx-auth-art">
        <Link href="/" className="mx-brand" style={{ padding: 0 }}><i />MODE</Link>
        <div>
          <p className="mx-eyebrow" style={{ color: "#f3a98e" }}>Join the club</p>
          <h1 className="mx-h1" style={{ marginTop: 12 }}>Your member account, <span>ready in a minute.</span></h1>
          <ul>
            <li>Book event tickets at member prices once your dues are paid</li>
            <li>Order merchandise and track your holds</li>
            <li>Submit expense claims with receipts</li>
            <li>Show your pass at the door</li>
          </ul>
        </div>
        <p style={{ color: "#7f949c", fontSize: 12 }}>Self-registration creates a member account. Officers assign other roles.</p>
      </aside>
      <section className="mx-auth-form">
        <form className="mx-auth-card mx-form" onSubmit={submit} noValidate>
          <div>
            <h2 className="mx-h2">Create your account</h2>
            <p className="mx-muted">Use the email your club knows you by.</p>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <TextField label="Full name" autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} error={errors.name} autoFocus />
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} error={errors.email} />
          <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => update("password", e.target.value)} error={errors.password} hint="At least 8 characters." />
          <TextField label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => update("confirm", e.target.value)} error={errors.confirm} />
          <Button type="submit" variant="primary" loading={busy} className="block">Create account</Button>
          <p className="mx-muted mx-small" style={{ textAlign: "center" }}>Already a member? <Link href="/app/login" className="mx-link">Sign in</Link></p>
        </form>
      </section>
    </div>
  );
}
