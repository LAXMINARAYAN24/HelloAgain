# Deployment handover — no deployment performed

## Architecture

The app is a React/Vite random live-chat frontend served by an Express Node 24 API with a persistent Python camera-screening worker. Authenticated WebSockets relay screened JPEG video and PCM audio; every participant must pass a camera check and press Start. All browser requests use same-origin `/api` paths and HTTP-only session cookies. Text updates use polling rather than Supabase Realtime. The browser receives no database credentials. No CORS credentials or third-party sign-in are required for local use.

The current local database is SQLite. A PostgreSQL adapter is implemented for later use with Supabase or another PostgreSQL provider. It creates a private `helloagain` schema, enables RLS, and revokes access from PUBLIC and Supabase’s browser roles. The server schema owner performs authorized access through the API; no browser access policies are created. Do not expose this schema through Supabase’s Data API. The adapter uses parameterized queries, transactions, savepoints, and a single advisory transaction lock for the pilot. That lock favors consistency over throughput; revisit it and load-test before scaling.

## Recommended first hosted topology

One Docker-capable application host with WebSocket support serves the built frontend, `/api`, media relay and Python/ONNX screening worker, with managed PostgreSQL/Supabase and a transactional SMTP provider. Render is installed but the account is not yet authenticated (latest read-only request returned USER_NOT_LOGGED_IN). No GitHub/GitLab/Bitbucket remote exists for this local project, so no service or deployment has been created. Complete Render sign-in and connect a source repository before provisioning. Plan a single application instance for this pilot because call/queue state is in memory. Horizontal scaling requires shared queue/signaling and media routing work. Choose the host and data region after deciding the launch country. The included Dockerfile is a deployment starting point, not a verified container release.

Cloudflare Pages can host the static frontend only if a same-origin proxy routes `/api` to the Node host. Simply uploading `dist/` will not produce a functioning database-backed app. The earlier free-static-hosting proposal therefore needs an API host as well. Free tier capacity, uptime, SMTP, backups, video, and moderation are separate costs or limits.

## Environment

Copy `.env.example` to `.env` locally; set actual secrets only in the hosting secret manager for production. Never place connection strings or SMTP credentials in VITE-prefixed variables, frontend code, Git, public folders, or chat.

Production startup requires:

- `NODE_ENV=production`
- `DEMO_MODE=false`
- `HOST=0.0.0.0` and the platform’s assigned `PORT`
- `APP_ORIGIN=https://your-actual-domain`
- `DATABASE_URL` pointing at the private PostgreSQL database
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and the provider’s authentication settings (`SMTP_USER`, `SMTP_PASSWORD` when required)
- TLS-protected SMTP: port 587 with STARTTLS, or `SMTP_SECURE=true` for a provider that uses implicit TLS (usually port 465)
- `VIDEO_ENABLED=true` and `VIDEO_PYTHON` pointing to Python with `requirements-video.txt` installed (the Dockerfile uses `/opt/video/bin/python`).
- A PostgreSQL connection using certificate verification; use `PG_CA_CERT_PATH` when the provider requires its CA. Do not use a connection string that disables certificate verification.

The initial database credential must be allowed to create and own the private schema and tables. After initialization, review and restrict its permissions to the application schema. Do not reuse a broad operator credential elsewhere. The application implements custom email/password authentication; it does not use Supabase Auth. Email ownership verification is not yet implemented and must be added before public signup.

## Build and start

```powershell
npm ci
npm run check
npm run test:browser
npm run test:calls
npm start
```

Browser tests currently expect Microsoft Edge on Windows. Adapt the Playwright channel for a Linux CI image. In a container, install/build with the Dockerfile, configure the secrets above, use HTTPS at the host gateway, and verify `/api/health`. Do not include the local sample database or local email outbox.

## Security and data operations

- HTTPS is required for production cookies and browser media APIs. Browser state-changing requests are protected by same-site cookies, Origin checks, and JSON-only endpoints.
- Passwords use salted scrypt; session and reset tokens are stored only as hashes. Password reset tokens expire in 30 minutes, work once, and revoke sessions.
- Rate limits are stored in the database. Wrong-password attempts remain counted even when the request fails. Apply host-level request/abuse protection as well before public launch.
- Roles come from database records, never editable profile claims. Provision the operator with `npm run admin -- --email owner@your-domain` after creating their account. Set up operator MFA before public launch; MFA is not implemented in this local build.
- Messages and ended random-room linkage records expire after 90 days. Report excerpts expire after 30 days; reports and audit records after 90 days. Cleanup runs at startup and hourly. Expired reset/session/rate-limit records are removed too.
- Account deletion removes sessions, reset tokens, profile, connections, and chats; it clears report details/evidence and moderation notes involving the user. Shared backup copies need their own expiry procedure.
- Local reset emails are written under `data/mail/` and never exposed through HTTP. They expire from the local outbox after 24 hours during cleanup and are removed when the account is deleted. Production sends SMTP instead; provider mailbox/log retention must be documented separately.
- Use `node scripts/backup.mjs` for a consistent manual SQLite backup under `data/backups/`. It can run while the local server is active. Local backups are not scheduled, encrypted, automatically deleted, or uploaded by this build. Keep access restricted and remove them on a defined schedule.
- Before production, configure encrypted managed PostgreSQL backups, a short retention schedule (for example seven days if appropriate), recovery tests, a restore/deletion replay procedure, and access controls. Restoring a backup must not silently resurrect deleted users.
- The app does not provide end-to-end encryption. Private messages are access-controlled by the server; report excerpts may be read by administrators.

## Remaining launch gates

Finalize operator identity, launch country, support/appeal and child-safety contacts, legal notices, email ownership verification, age assurance, moderator staffing, hosted database tests, email delivery tests, monitoring, backups, and load tests. Local live calls now run with active server screening. Public video still requires capacity/load validation and the operational measures in `video-requirements.md`. Model screening does not guarantee perfect prevention or verified liveness. There is no advertising SDK yet; select an ad provider only after checking its policies for random video/chat content and applicable privacy requirements. No store listing exists.

## Video and availability caveats

Current capacity is deliberately two simultaneous calls with a 15-minute pilot limit. Memory-only rooms and waiting queues reset on restart; the database marks prior random rooms closed. This is a single-instance pilot, not a scalable multi-region service. Browser camera/microphone access requires HTTPS except on localhost. Reverse proxies must permit WebSocket upgrades and long-lived connections, and must route `/api/video/stream` to the same instance as REST signaling. No TURN account is needed for this server-WebSocket architecture, but the server pays the media bandwidth and screening compute.

Local dependencies are installed and tested. Docker startup, hosted PostgreSQL, production SMTP, hosted media latency and public capacity are unverified. Do not interpret the supplied Dockerfile as a completed deployment. A static Sites/Pages upload cannot run this Python/Node backend. No Play Store listing or Android binary exists.

## Verified Render free-tier constraints

The current Render documentation says free web services have no persistent local disk, and free Postgres databases expire after 30 days. Free web services also cannot send traffic on SMTP ports 25, 465 or 587. The current application uses SMTP in production, so a free Render release needs a supported HTTPS email-provider integration before relying on password recovery; merely entering SMTP settings will not solve that limitation. Do not silently switch to a paid instance, disable production checks, or store member data on ephemeral SQLite to bypass these constraints. Source: https://render.com/docs/free .

The hosting connector’s current error is authentication, not lack of authorization from the user: the user has already requested publication. The local changes and sanitized source archive are ready for upload once account/repository access is available.
