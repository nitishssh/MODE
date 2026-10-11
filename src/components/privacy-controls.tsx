"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearOptionalPreferences, getPrivacyChoice, PRIVACY_CHANGE_EVENT, savePrivacyChoice, type PrivacyChoice } from "@/lib/privacy-preferences";

function usePrivacyChoice() {
  const [choice, setChoice] = useState<PrivacyChoice | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const update = () => {
      const current = getPrivacyChoice();
      if (current !== "preferences") clearOptionalPreferences();
      setChoice(current);
      setReady(true);
    };
    update();
    window.addEventListener(PRIVACY_CHANGE_EVENT, update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener(PRIVACY_CHANGE_EVENT, update); window.removeEventListener("focus", update); };
  }, []);
  return { choice, ready };
}

export function PrivacyPreferences() {
  const { choice, ready } = usePrivacyChoice();
  const [message, setMessage] = useState("");
  function choose(next: PrivacyChoice) {
    const saved = savePrivacyChoice(next);
    setMessage(saved ? (next === "essential" ? "Essential only. Saved theme and announcement drafts were cleared." : "Saved preferences allowed. You can change this at any time.") : "Your browser could not remember this choice. Essential-only withdrawal still applies on this page; check browser settings to save it for future visits.");
  }
  return <section className="privacy-preferences" aria-label="Cookie and storage preferences">
    <h2>Cookies & saved preferences</h2>
    <p>Sign-in, your privacy choice, and a language you explicitly select use essential cookies. Optional storage remembers your theme and announcement drafts on this browser.</p>
    <p><strong>Current choice:</strong> {ready && choice === "preferences" ? "Saved preferences allowed" : "Essential only"}</p>
    <div className="privacy-actions">
      <button type="button" aria-pressed={ready && choice === "essential"} onClick={() => choose("essential")}>Use essential only</button>
      <button type="button" aria-pressed={ready && choice === "preferences"} onClick={() => choose("preferences")}>Allow saved preferences</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}

export function PrivacyNotice() {
  const { choice, ready } = usePrivacyChoice();
  const [message, setMessage] = useState("");
  function choose(next: PrivacyChoice) {
    setMessage(savePrivacyChoice(next) ? "" : "Your browser could not remember this choice. Use the policy page to manage preferences or check your browser settings.");
  }
  return <>
    <footer className="privacy-footer"><Link href="/privacy">Privacy policy & permissions</Link></footer>
    {ready && (!choice || message) && <aside className="privacy-banner" aria-label="Your privacy choices">
      <p><strong>Your data, your choice.</strong> MODE uses essential cookies for sign-in. Saving your theme and announcement drafts is optional. Camera and file access are requested separately when needed.</p>
      <div className="privacy-actions">
        <button type="button" onClick={() => choose("essential")}>Use essential only</button>
        <button type="button" onClick={() => choose("preferences")}>Allow saved preferences</button>
        <Link href="/privacy">Read policy & manage choices</Link>
      </div>
      {message && <p role="status">{message}</p>}
    </aside>}
  </>;
}
