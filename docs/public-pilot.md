# Public pilot — 21 October 2026

Public website: https://helloagain-live.onrender.com/

The owner approved a free 30-day Render pilot and an actual recovery-email test. No paid plan was selected.

## Hosting and accounts

- Web service: `helloagain-live`, service ID `srv-dbcboq7f3r2c739h7ik0`, Docker, Oregon, free shared CPU / 512 MB RAM.
- PostgreSQL: `helloagain-pilot-db`, ID `dpg-dbcbnteq1p3s73cu2gg0-a`, free / 1 GB. Render displays an expiry of **20 November 2026**. Export and move the data before that date to continue without a paid Render database.
- Source: https://github.com/LAXMINARAYAN24/HelloAgain . Public-repository deployments are manual in the Render dashboard; pushing alone does not update the running service.
- The existing non-demo owner member account was copied to the private `helloagain` schema with its existing password hash. Sessions, local messages, demo accounts and local recovery emails were not copied. Local SQLite remains intact.
- The external PostgreSQL connection passed certificate verification, and `pg_stat_ssl` confirmed encryption. All ten application tables have row-level security enabled, and PUBLIC has no schema access.

## Email

Brevo's HTTPS transactional integration is configured through Render's secret environment settings. The key is restricted to transactional email. The owner generated the credential, and approved the two Render outgoing ranges `74.220.48.0/24` and `74.220.56.0/24` in Brevo. Unauthorized-IP blocking remains enabled.

The first recovery request was refused by Brevo's network restriction and its token was removed. After the network approval, one recovery email was accepted and Brevo's actual log reported **Delivered** to the owner-selected inbox at 18:57 IST on 21 October 2026. No password was changed during testing. Gmail sender rewriting to a provider-controlled `brevosend.com` address was visible in the delivery log; an owned sending domain is not configured.

API keys, database connection strings, session cookies and recovery links are absent from this repository and its source archive.

## Media verification

The initial hosted model timed out under the free server's CPU quota. Its default ONNX thread pool was replaced by a bounded one-thread session with spinning disabled; OpenCV and numerical-library threads are also bounded. The upstream model, detection thresholds and fail-closed media rules are unchanged. Local checks passed all 21 tests and the production build after this adjustment.

The updated public host passed an actual network check with four disposable accounts in two simultaneous private calls. All four connections received screened video and audio; received picture counts at completion were 22, 20, 2 and 2. Cameras used the clothed fixture and audio used synthetic PCM. The check used explicit accepted connections to avoid matching test participants with visitors. This verifies the hosted relay and model, rather than physical webcams or full random-match browser behavior. The latter has separate local browser evidence in verification.md. All four test accounts, their sessions, connection rows and rate-limit records were removed afterward. No test login or demonstration was added to the public UI.

Deployed runtime source: `693c5f31ce13b68e05a98ffd911d468045f5f335` (bounded screening threads). The Render deployment reached Live, `/api/health` returned `ok: true`, and `/api/config` reported demo disabled and camera screening available.

## Pilot limits

Two simultaneous calls, fifteen minutes per call, one application instance. Text has no daily quota but anti-spam rate limits apply. Free hosting sleeps during inactivity, and bandwidth, CPU, database size and email quotas are finite. The database has no managed free backups.

The test demonstration UI and alternate test login remain removed. Development checks do not appear on the public homepage. Automated checks use synthetic clothed media and disposable accounts, which are deleted after the check.

This is a limited pilot. Real-device camera/microphone and public-network latency checks, varied moderation evaluation, operational support/appeals, age assurance, final operator notices and backup/recovery procedures remain necessary before broad promotion. Automated camera screening does not guarantee that every violation is detected or that age, gender or liveness is verified. Ads and an Android/Play Store application are not implemented.


## 26 October update: traffic, member activity and sharing

Current deployed application source: `7f19cdc` (private traffic, recent active accounts, referral/Instagram sharing and share previews). The active-account implementation was first deployed as `f33cc38`, and the owner environment was selected for the current Lucky account. No owner email, password, API key or session cookie is committed. Page views are measured from activation on 26 October, without reconstructing older visits.

The build and all 26 tests pass. In an isolated browser, an ordinary member sees recent Total / Men / Women aggregates on Live chat and Your account, while private traffic is denied. The server remains responsible for owner authorization. No public counter, profile directory or test demonstration was added.

The public-repository availability workflow (`afde4c1`) requests only `/api/health` approximately every ten minutes. Its first GitHub-hosted check completed successfully: https://github.com/LAXMINARAYAN24/HelloAgain/actions/runs/40327527166 . The monitor has no repository permissions, credentials, checkout, external actions or larger runner. It does not count as a visitor or signed-in active user. GitHub schedule delays, no-activity disabling, Render restarts and shared free-instance hour limits remain applicable. Keeping the service active consumes the workspace's shared allowance; this is not guaranteed always-on production hosting.

The website links to the user-confirmed `@helloagain.live` and offers deliberate visitor sharing. Friend referrals and Instagram links are source categories in private traffic. A free health check and share links do not create an advertising campaign or guarantee audience growth. Instagram posts must be verified separately before being described as published. The free database still expires on 20 November 2026.
