# Dependency audit status

Observed on 11 October 2026 from `npm run audit:dependencies` using the current
root and Expo lockfiles. The backend audit reported zero vulnerabilities. The
client audit reported 18 high and 11 moderate affected packages. These counts
include parent dependencies affected by the same underlying advisories; they
do not represent 29 independent vulnerabilities.

| Advisory | Package | Reported range | Dependency path / next step |
| --- | --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces` | All versions, high | Metro file matching through `micromatch`; the report identifies no patched version. Verify an upstream fix before changing the lockfile. |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge` | All versions, high | Expo CLI code-signing certificates; the report identifies no patched version. Signature-validation changes require a compatible upstream release. |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | `decode-uri-component` | `<=0.4.2`, moderate | Expo Router through `query-string`; inspect compatible fixes and URL-decoding behavior. The suggested Router 58 upgrade crosses the current SDK boundary. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | `uuid` | `<11.1.1`, moderate | Xcode/config tooling; changing the major version requires checking its consumers, not a global override. |

Metro and certificate packages appear in development/build tooling paths, but
Expo declares that tooling through normal dependencies, so `--omit=dev` still
audits it. This classification alone does not establish that a vulnerable
operation is unreachable, or justify accepting its risk.

## Current gate behavior

The dependency job and final **Quality gate** remain failing for high/critical
advisories. No advisory is ignored, and no severity threshold was raised.
The `npm audit fix --force` suggestion to install Expo 44 is unsuitable for this
SDK 57 project. Do not apply that downgrade to obtain a green audit result.

Preview available compatible changes without installing them:

```powershell
npm --prefix client audit fix --dry-run --ignore-scripts --json > tmp/client-audit-plan.json
```

After choosing a verified compatible fix, update and commit the client manifest
and lockfile together, then run client lint, types, tests, web export/delivery
acceptance and the audit again. An unresolved upstream advisory requires an
explicit, scoped risk-acceptance decision before any exception can be added.

The advisory ranges above come from the supplied npm report. Live advisory
pages and available release versions have not yet been independently verified.
