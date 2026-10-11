import type { Metadata } from "next";
import Link from "next/link";
import { getPrivacyPolicy } from "@/lib/privacy-policy";
import { PrivacyPreferences } from "@/components/privacy-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy & permissions | MODE", description: "How MODE handles your profile, club records, cookies, camera and selected files." };

export default function PrivacyPage() {
  const policy = getPrivacyPolicy();
  return <main className="privacy-page">
    <Link href="/" className="privacy-back">← Back to MODE</Link>
    <header><p className="privacy-eyebrow">{policy.organization} / YOUR INFORMATION</p><h1>Privacy & permissions</h1><p>Understand what you share, why it is needed, and the choices you control.</p><p className="privacy-meta">Effective {policy.effectiveDate} · Version {policy.version}</p></header>
    <nav className="privacy-toc" aria-label="Privacy sections"><a href="#choices">Manage cookies</a><a href="#permissions">Device permissions</a><a href="#contact">Privacy contact</a></nav>
    <section id="permissions" className="privacy-summary"><h2>Permission is specific to the feature.</h2><dl>
      <div><dt>Profile & club records</dt><dd>Account details you provide and records needed for membership, bookings and club operations. Acknowledged when you register.</dd></div>
      <div><dt>Camera · optional</dt><dd>Explain first, ask when you choose QR scanning. Manual code entry stays available.</dd></div>
      <div><dt>Files · your selection</dt><dd>Only the receipt you choose. Confirm before upload. No whole-drive access.</dd></div>
      <div><dt>Saved preferences · optional</dt><dd>Off until you allow them. Change your choice below without losing access to your account.</dd></div>
    </dl><p>Browser or device settings control camera permission. MODE cannot grant itself access. You do not need to allow microphone, location, contacts or push notifications.</p></section>
    <div id="choices"><PrivacyPreferences /></div>
    {policy.sections.map((section) => <section className="privacy-section" key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}
    <section id="contact" className="privacy-summary"><h2>Privacy contact</h2><p>{policy.organization}</p>{policy.localContact ? <p><strong>{policy.contactEmail}</strong> — local example only; this mailbox does not receive requests. For this demo, contact your club administrator directly.</p> : <p><a href={`mailto:${policy.contactEmail}`}>{policy.contactEmail}</a></p>}<p>Please do not send passwords or session tokens with a privacy request.</p></section>
  </main>;
}
