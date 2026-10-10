"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthMeResponse, AuthResponse } from "@/lib/contracts";
import { api, ApiError, describeError } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { Alert, Button, TextField } from "../../_components/ui";

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
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (session.status === "authenticated") router.replace(next);
  }, [session.status, router, next]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = {
      email: email.trim() ? undefined : "Enter your club email address.",
      password: password ? undefined : "Enter your password.",
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    setBusy(true);
    setError("");
    try {
      await api.post<AuthResponse>("/api/auth/login", { email: email.trim(), password });
      const me = await api.get<AuthMeResponse>("/api/auth/me");
      session.setSession(me);
      router.replace(next);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setError("That email and password combination did not match.");
      else setError(describeError(caught, "We could not sign you in. Please try again."));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auth">
      <aside className="mx-auth-art">
        <Link href="/" className="mx-brand" style={{ padding: 0 }}><i />MODE</Link>
        <div>
          <p className="mx-eyebrow" style={{ color: "#f3a98e" }}>Student organization system</p>
          <h1 className="mx-h1" style={{ marginTop: 12 }}>Everything your club runs on, <span>in one place.</span></h1>
          <ul>
            <li>Memberships, dues and renewals</li>
            <li>Event tickets with a door scanner</li>
            <li>Merchandise, tasks and announcements</li>
            <li>One ledger for every rupee</li>
          </ul>
        </div>
        <p className="mx-muted" style={{ color: "#7f949c", fontSize: 12 }}>Synthetic demo data only. No real student records.</p>
      </aside>
      <section className="mx-auth-form">
        <form className="mx-auth-card mx-form" onSubmit={submit} noValidate>
          <div>
            <h2 className="mx-h2">Welcome back</h2>
            <p className="mx-muted">Sign in with your club email.</p>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((c) => ({ ...c, email: undefined })); }} error={fieldErrors.email} placeholder="you@example.com" autoFocus />
          <TextField
            label={<span className="mx-between" style={{ width: "100%" }}>Password<button type="button" className="mx-link" style={{ background: "none", border: 0, fontSize: 12 }} onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button></span>}
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((c) => ({ ...c, password: undefined })); }}
            error={fieldErrors.password}
          />
          <Button type="submit" variant="primary" loading={busy} className="block">Sign in</Button>
          <p className="mx-muted mx-small" style={{ textAlign: "center" }}>New to the club? <Link href="/app/register" className="mx-link">Create a member account</Link></p>
          <div className="mx-demo">
            <strong>Demo accounts</strong> (password <code>mode-demo-2026</code>):
            <div className="mx-row" style={{ marginTop: 6, gap: 2 }}>
              {DEMO_ACCOUNTS.map(([address, label]) => (
                <button key={address} type="button" onClick={() => { setEmail(address); setPassword("mode-demo-2026"); setFieldErrors({}); }} title={address}>{label}</button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
