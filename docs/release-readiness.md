# Publication readiness — 21 October 2026

Status: the owner-approved free public pilot is live at https://helloagain-live.onrender.com/ . It is a limited pilot, with operational work remaining before broad promotion.

## Verified

- Docker service and PostgreSQL on Render's free plans; HTTPS health and configuration checks passed.
- Existing owner member account migrated with its password hash, without copying local sessions or sample accounts. Private schema, ten RLS-protected tables and certificate-verified database TLS checked.
- Brevo HTTPS recovery email configured; one owner-approved test was marked Delivered by the provider. Secrets remain in Render's environment settings.
- Two simultaneous hosted calls received screened video and audio in both directions using synthetic media. Disposable test records were removed afterward. See public-pilot.md for exact scope.
- Random camera-first home, reciprocal Random/Women/Men preferences, Start/Next/Stop, room isolation, reporting/blocking and server-side screening have local API/browser evidence.
- Interactive test demonstration, demo launcher and alternate test login removed. Twenty-one automated tests and the production build passed after bounding the model's CPU threads.

## Remaining work

| Area | Current limitation |
| --- | --- |
| Database expiry | Free Render database expires on **20 November 2026**. Export/move the data before then; no free managed backups. |
| Verification | Age and gender are self-declared; email ownership at signup and liveness are not verified. |
| Support | Operator notices, public support/appeal contacts and staffed review procedures need completion. |
| Camera enforcement | Automated screening is imperfect. Real devices, varied clothing/lighting and network conditions need evaluation. |
| Capacity | Two calls, fifteen minutes each, one shared CPU instance. No sustained load benchmark or uptime commitment. |
| Promotion | Pilot-only use until operational gaps are addressed. No ad SDK or Play Store app exists. |

Resource identities, deployment revision, actual email evidence and hosted test limits are recorded in public-pilot.md. No paid resource was selected.
