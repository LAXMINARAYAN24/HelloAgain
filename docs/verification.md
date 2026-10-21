# Verification — 21 October 2026

## Passed locally

- `npm run check`: 21 API/security/video/mail tests and the Vite production build. Tests cover age checks, private messages, reciprocal matching restrictions, rate limits, CSRF, account/export/deletion, report/redaction/retention, moderator bans/session revocation, recovery and production guards. Video tests include actual on-server model acceptance of a clothed adult fixture, malformed media rejection, consent and authenticated membership, audio gating, blocked call cutoff, black-frame withholding, simulated exposure suspension, worker outage fail-closed, and random queue/text authorization/Stop/block behavior, bystander-call protection and retired-demo endpoint and authentication checks. New tests verify same-gender Random rooms with authorized text/media, invalid-filter rejection without interrupting the call, and both queue orders of Random versus opposite-gender filtering.
- `npm run test:browser`: desktop/mobile home without profile cards, honest unavailable-screening state, simplified signup without public profile fields, Random/Men selector, account editing/export, rules, logout/recovery/login and no browser runtime errors.
- `npm run test:calls`: four independent browser contexts and four disposable accounts connected two simultaneous same-gender Random calls through the real server/model, then switched to a different-gender partner via Next. Both directions received video/audio; Next changed partners, cleared old text and denied the old room; fresh text, mute/unmute, mobile layout and black-camera cutoff passed. All cameras/microphones were synthetic. This is not evidence of four real users online.
- Source fixture is a clothed adult astronaut, credited in `tests/fixtures/README.md`. No prohibited sexual images were needed for tests; exposure enforcement uses an injected model verdict.
- Local database backup helper ran before the app update. The existing member database was retained.

Screenshots from these tests are under `docs/screenshots/`: `random-home-desktop.png`, `random-home-mobile.png`, `live-call-test.png`, `live-call-mobile-test.png`. Older discovery screenshots describe historical UI and are not the current home.

Email integration checks verify production rejects a local outbox or missing credentials, recovery requests use a fixed HTTPS provider endpoint with the configured sender/recipient/site link, redirects are refused, and provider/network errors remain generic. No external email was sent.

## Release cleanup

The interactive demonstration page, four synthetic demo participants, generated tones, lab launcher and alternate test-token authentication have been removed. Retired demonstration URLs return 404. Automated checks remain development-only and do not create test accounts in the member database. The built client contains no interactive call-lab code.

## Limits of verification

No public deployment, hosted database, production SMTP delivery, Docker runtime or actual physical two-device camera session has been validated. No throughput/load or broad model-accuracy evaluation has been completed. Real cameras, clothing, lighting and network conditions vary. The screening worker cannot guarantee prevention of every unsafe image or verify real gender/age/liveness. Public launch still needs the operator measures in `deployment.md`.
