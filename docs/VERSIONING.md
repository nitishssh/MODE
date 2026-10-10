# Product versioning

MODE uses one product version for the server, web app and Expo client. The root
`VERSION` file is the source of truth and contains plain `MAJOR.MINOR.PATCH`
semantic versioning, without a `v` prefix, prerelease suffix or leading zeroes.

The prepared `0.2.0` candidate adds the first wave of college-pilot features over
`0.1.0`. It becomes a release only after the changes merge to `main` and CI passes
for the merged commit. A version bump alone does not confirm a release.

## Prepare a release

1. Choose a semantic version: patch for compatible fixes, minor for compatible
   additions and major for incompatible public changes. During `0.x` development,
   minor releases may change the public API; describe breaking changes explicitly.
2. Update `VERSION` and these fields together in the same change:

   | File | Fields |
   | --- | --- |
   | `package.json` | `version` |
   | `package-lock.json` | `version`, `packages[""].version` |
   | `client/package.json` | `version` |
   | `client/package-lock.json` | `version`, `packages[""].version` |
   | `client/app.json` | `expo.version` |

   These are product metadata fields. Updating only the product version does not
   require reinstalling dependencies or changing dependency versions in lockfiles.
3. Update `CHANGELOG.md` with the candidate's changes and any compatibility notes.
4. Run `npm run check:version`, then `npm run check:all` with Node 24. The full
   runner checks version consistency first and stops if any manifest differs.
   Verify the separate PostgreSQL CI job also passes against its disposable database.
5. Merge the reviewed changes and verify both CI jobs pass on the merged `main` commit
   before marking the candidate as released or creating its release tag.

`npm run check:version` uses only Node built-ins and works before dependency
installation. It also checks both lockfile root entries, so changing only their
top-level versions is insufficient.
