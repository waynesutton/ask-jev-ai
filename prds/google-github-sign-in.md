# Google and GitHub sign in

Created: 2026-09-20 04:15 UTC
Status: Dev and production credentials verified; Google consent In production; OAuth code remains undeployed

## Problem

Accounts currently use email and password. Add Google and GitHub sign in to the same account model, preserving handles, user numbers, history, moderation, and the admin's password-only boundary.

## Scope

- Two Auth v2 OAuth components, separate provider credentials per environment, and exact redirect origins.
- Require a verified provider email before creating or linking an account. Refuse `ADMIN_USERNAME` and blocked emails before any write. Recheck these rules for returning OAuth accounts.
- Shared provider buttons and errors on sign in and sign up; admin form stays password only. Preserve the follow-up return address.
- Header Sign in pill and Sign up link, responsive in both themes.
- Optional provider metadata on users supports an accurate account settings page; older rows default to password. No migration or change to existing required fields.
- Update privacy copy and environment documentation without secret values.

## Boundaries

The user's explicit no-deploy instruction overrides the source guide's dev and production pushes. Do not run a backend watcher, `convex dev --once`, `convex deploy`, or `npm run deploy`. Do not commit or push. Keep `.env.local` unchanged. The user later requested production provider configuration without deployment. The user confirmed production client creation, credential storage, and Google consent publication at action time; these provider configuration changes are complete. Code deployments remain prohibited; full sign-in verification requires a later authorized dev deployment.

## Files

`convex/convex.config.ts`, `convex/auth.ts`, `convex/users.ts`, OAuth helpers/tests, `convex/schema.ts`, `convex/profile.ts`, `src/main.tsx`, `src/components/AuthForm.tsx`, `SignIn.tsx`, `Admin.tsx`, `Me.tsx`, `Docs.tsx`, `Legal.tsx`, `src/App.tsx`, `src/styles.css`, generated API types through codegen, and project tracking docs.

## Verification

Typecheck and build locally. Test admin refusal, missing/unverified email refusal, blocked email refusal, stable verified-email linking, returning-account guards, and same-origin return paths without changing live admin settings. Inspect mobile/desktop auth UI and password-only admin form. Scan for leaked secrets and ensure environment files are unchanged. Report provider configuration separately from deployed authentication.

## Completion log

- 2026-09-20 04:15 UTC Read the setup guide and installed Auth v2 OAuth contracts. Confirmed no Convex watcher is running. Existing work will be preserved.
- 2026-09-20 04:30 UTC Implemented provider components, verified-email linking, returning-sign-in guards, optional provider metadata, shared provider buttons, global flow errors, safe return paths, and the account settings/header changes. Password sign in remains available and the admin form has no OAuth buttons.
- 2026-09-20 04:30 UTC Generated component types using `convex codegen`, whose installed CLI explicitly documents that it does not change running deployment code. No dev watcher, deployment, static upload, commit, or push was run.
- 2026-09-20 04:30 UTC Passed 23 local tests, both TypeScript checks, and the Vite build. Inspected sign in and the header at 375px in light and dark themes, plus sign up and password-only admin. Fixed the header link specificity that initially hid the Sign in text. No application console errors observed; one browser-extension stylesheet error was unrelated.
- 2026-09-20 04:30 UTC Created the Ask Jev Google Cloud project without billing. Accepted the Google API Services User Data Policy after explicit approval. Saved branding, support/contact settings, app URLs, and authorized domains. Google rejects bare `convex.site` as a public suffix: use the exact dev hostname instead. Consent remains in Testing.
- 2026-09-20 04:30 UTC Set dev `AUTH_ALLOWED_ORIGINS` to the two documented localhost origins. Prepared Google and GitHub dev client forms, without submitting credential creation. No client secrets have been generated or stored.
- 2026-09-20 04:32 UTC Source/doc scans found no credential values or occurrences of the dev admin address. The admin value was compared only in process memory and not printed. `.env.local` contains no OAuth credential variables; the setup guide remains git ignored. `git diff --check` passes.

- 2026-09-20 04:59 UTC The user created both dev clients. Saved Google client ID/secret and GitHub client ID only in Convex dev and privately verified all three saved values. GitHub secret generation opened a fresh identity check; passkey verification is pending. No deployment or local credential file.

- 2026-09-20 05:03 UTC The user completed GitHub verification with Google Authenticator. Captured the generated GitHub client secret without printing it, saved it only to Convex dev, and privately verified the saved value matches. All four provider credentials and the localhost origin allowlist are present. Values are masked; no credential files, deployment, commit, or push.

- 2026-09-20 12:53 UTC Reproduced Google failure on both localhost ports. Console evidence is `Could not find public function for auth:startSignInGoogle`; GitHub on the requested port fails with the equivalent missing `auth:startSignInGithub`. Read-only deployed function metadata confirms dev and prod still expose password/session functions only. Dev already allows both requested localhost origins and has all four provider credentials. This is a missing backend deployment, not evidence that Google rejected the configured credentials. No deployment was run.
- 2026-09-20 12:53 UTC Confirmed production has no OAuth credentials. Prepared separate production Google and GitHub client forms with exact production callbacks and a production environment tab. Confirmed Google consent is External/Testing with no test users. Requested the required action-time confirmation for creating/saving production credentials and publishing consent; no production credential or consent change performed yet.

- 2026-09-20 13:02 UTC After explicit confirmation, created separate production Google and GitHub clients, verified their saved callbacks, and privately compared all four credentials plus the origin allowlist saved in Convex production. The user completed GitHub sudo verification with Google Authenticator. Published Google consent and verified External/In production. No code deployment, credential files, commit, or push.

## Remaining gates

- A separately authorized dev deployment is required before provider start/callback functions can work. Test new users, repeat sign in, password-account linking, cancellation, browser back, follow-up return paths, missing/unverified email, moderation, and admin refusal. Test with disposable non-admin accounts.
- Production provider configuration is complete. Production code deployment and live OAuth verification remain separately unauthorized; validate dev first. Do not interpret configuration checks as a provider round-trip test.
- Auth v2 alpha retains an inert core account entry when an app user is deleted. The returning-sign-in guard refuses that stale account instead of issuing access to a missing user. Recreating such an account needs the future core cleanup API or a separately designed recovery flow.

## Commit message (not committed)

```text
feat: add Google and GitHub sign in

- link verified provider emails while preserving password and admin boundaries
- add provider buttons, safe return paths, flow errors, and account settings
- document OAuth environment variables and remaining undeployed setup
```
