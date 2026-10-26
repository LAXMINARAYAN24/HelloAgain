Hosted pilot verification: see [public-pilot.md](public-pilot.md).

# Verification — 21 October 2026

## Passed locally

- `npm run check`: 21 API/security/video/mail tests and the Vite production build. Tests cover age checks, private messages, reciprocal matching restrictions, rate limits, CSRF, account/export/deletion, report/redaction/retention, moderator bans/session revocation, recovery and production guards. Video tests include actual on-server model acceptance of a clothed adult fixture, malformed media rejection, consent and authenticated membership, audio gating, blocked call cutoff, black-frame withholding, simulated exposure suspension, worker outage fail-closed, and random queue/text authorization/Stop/block behavior, bystander-call protection and retired-demo endpoint and authentication checks. New tests verify same-gender Random rooms with authorized text/media, invalid-filter rejection without interrupting the call, and both queue orders of Random versus opposite-gender filtering.
- `npm run test:browser`: desktop/mobile home without profile cards, honest unavailable-screening state, simplified signup without public profile fields, Random/Men selector, account editing/export, rules, logout/recovery/login and no browser runtime errors.
- `npm run test:calls`: four independent browser contexts and four disposable accounts connected two simultaneous same-gender Random calls through the real server/model, then switched to a different-gender partner via Next. Both directions received video/audio; Next changed partners, cleared old text and denied the old room; fresh text, mute/unmute, mobile layout and black-camera cutoff passed. All cameras/microphones were synthetic. This is not evidence of four real users online.
- Source fixture is a clothed adult astronaut, credited in `tests/fixtures/README.md`. No prohibited sexual images were needed for tests; exposure enforcement uses an injected model verdict.
- Local database backup helper ran before the app update. The existing member database was retained.

Screenshots from these tests are under `docs/screenshots/`: `random-home-desktop.png`, `random-home-mobile.png`, `live-call-test.png`, `live-call-mobile-test.png`. Older discovery screenshots describe historical UI and are not the current home.

Email integration checks verify production rejects a local outbox or missing credentials, recovery requests use a fixed HTTPS provider endpoint with the configured sender/recipient/site link, redirects are refused, and provider/network errors remain generic. These isolated checks sent no external email; a separate owner-approved hosted recovery test was later marked Delivered by Brevo (see public-pilot.md).

## Release cleanup

The interactive demonstration page, four synthetic demo participants, generated tones, lab launcher and alternate test-token authentication have been removed. Retired demonstration URLs return 404. Automated checks remain development-only; the separate hosted media check removed all its disposable records afterward. The built client contains no interactive call-lab code.

## Limits of verification

The Render Docker deployment, encrypted hosted PostgreSQL, real Brevo HTTPS recovery-email delivery and two simultaneous public-host media calls have passed the checks recorded in public-pilot.md. An actual physical two-device camera session has not been validated. No sustained throughput/load or broad model-accuracy evaluation has been completed. Real cameras, clothing, lighting and network conditions vary. The screening worker cannot guarantee prevention of every unsafe image or verify real gender/age/liveness. Broad promotion still needs the operator measures in deployment.md.


## 26 October: traffic and active accounts

The new suite passes all 26 tests and the production client build. Tests cover owner-only traffic reads (including denial to other admins), no public traffic totals, deduplication, owner/bot/DNT/GPC exclusions, bounded source labels and retention. Regular-member activity tests verify only recent active accounts with unexpired sessions count, multiple sessions count once, stale/demo/banned/expired accounts are excluded and returning accounts become active again. Traffic read endpoints remain separate from member-visible aggregate activity.

An isolated browser preview signed in with an ordinary disposable member. Both Live chat and Your account displayed 1 total / 1 man / 0 women for that preview; no private-traffic navigation was present. These preview numbers are not public-site statistics. The original public host continues to require authentication for `/api/owner/traffic` and uses `no-store`; `/owner/traffic` has `noindex, nofollow`.

The availability monitor's first hosted run passed in GitHub Actions: https://github.com/LAXMINARAYAN24/HelloAgain/actions/runs/40327527166 . Its scheduled public health requests create neither visitor views nor authenticated activity. This is a best-effort free-plan mitigation, not an uptime guarantee.
