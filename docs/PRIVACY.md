# Privacy and permission implementation

The web policy is at `/privacy`; Expo has a `/privacy` screen backed by public `GET /api/privacy-policy`. Both use one server notice source. The local operator is **MODE Local Demo**, with **privacy@example.test**, explicitly labelled as a non-delivering example. Set `MODE_PRIVACY_ORGANIZATION` and `MODE_PRIVACY_EMAIL` to real public contact details before hosting for real users.

## Data inspected

| Data or capability | Actual behavior and control |
| --- | --- |
| Profile | Name, email, salted password hash, club role and membership records; no device contacts or social-profile access. Registration asks for policy acknowledgement. |
| Club activity | Dues, bookings, attendance, purchases, tasks, claims and audit records; access follows existing role/club checks. Public announcements and event details are explained in the notice. |
| Camera | Web and native show a rationale first. Only Continue to camera invokes camera access. Not now leaves manual short-code entry available. Stop, leaving the view or backgrounding stops the camera. The server receives decoded codes, not camera frames. |
| Selected files | Web forms disclose access before selection and upload on expense submission. Expo separates selection from Upload selected receipt, with cancellation available. No whole-drive or photo-library permission is requested. |
| Sign-in storage | Browser HttpOnly `mode_session` JWT cookie or native SecureStore session, seven-day expiry; logout revokes the session. |
| Privacy-choice cookie | `mode_privacy` stores version plus `essential` or `preferences` for 180 days. It grants no server authorization. |
| Language cookie | `mode_lang` is stored only after the user explicitly requests a language, for up to one year. It supports that requested feature. |
| Optional localStorage | `mode-theme` and `mode.announcement.draft` are gated by a current preferences choice. Essential-only mode removes both keys. With no choice, an old version, unavailable storage or expired choice, optional reads/writes default off. Current-page theme changes and draft editing still work. |
| Notifications, microphone, location, contacts | Not requested. Existing notifications are in-app notices, not browser push. |
| External requests | Web Google Fonts requests are disclosed. This implementation has no advertising/analytics tracker. Email delivery is simulated; payments are officer-recorded, not charged in the app. |

## Registration evidence

The initially unchecked web checkbox / native switch acknowledges use of the profile and club activity for account services. It does not act as consent to all possible future processing. The request supplies `privacyPolicyVersion` only after acknowledgement. The schema requires the current version; unmodified old registration clients must update or they receive a validation error.

The member record, acknowledgement audit event and JWT session are created atomically. The audit event records the version and timestamp against the new member ID. No schema migration is needed. Existing accounts and officer imports are not retroactively marked acknowledged, and a policy update does not auto-enable optional permissions.

## Managing choices

The initial browser notice offers equally accessible **Use essential only** and **Allow saved preferences** buttons. The persistent privacy link and Settings page lead to controls for changing that choice. Account services continue in essential-only mode. Camera permission is managed by the browser or OS; the policy and native settings link explain revocation. File access is limited to explicit selections, and uploaded records remain subject to the operator's retention process.

These controls gate the Next.js web interface's saved theme/drafts. The Expo interface follows the device theme and does not implement those optional storage features. Expo web uses essential session cookies. A native rebuild is required for changes to native permission configuration; this change uses the existing camera and document-picker configuration without adding permissions.

## Operator setup still required before public use

Replace the local example contact and confirm hosting providers, backup locations and retention periods. Account/financial/audit deletion and data access requests are handled manually; this implementation does not invent a fixed retention period or promise automatic account deletion. Review the notice against the actual deployment and applicable requirements. No legal-compliance certification is implied.

## Verification

`tests/privacy.test.ts` checks server-side acknowledgement validation, atomic rollback, saved evidence, public policy consistency, opt-in storage gating, withdrawal cleanup and storage failures. Existing authentication and journey tests include the new registration field. `npm run typecheck`, production build and the built-server foundation journey check cover integration. Native camera prompts and file pickers also require testing on a real device.
