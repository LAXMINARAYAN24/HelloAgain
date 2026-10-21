# Publication readiness — 21 October 2026

Status: working local pilot; not ready for unrestricted public launch.

## Completed

- Random camera-first home without public profile cards; Start / Next / Stop and current-room text.
- Random/everyone and reciprocal Women/Men matching, consent, session authorization, blocking/reporting and server-side camera screening.
- Interactive test demonstration, generated demo calls, demo launcher and alternate test-token authentication removed. The retired demonstration page and APIs return 404. Test-call server stopped.
- Production frontend rebuilt; API/security and desktop/mobile browser checks passed. Automated checks are development tools, outside the deployed frontend and final Docker image.

## Outstanding before public launch

| Area | Actual current state | Work remaining |
| --- | --- | --- |
| Public hosting | Localhost only | Configure a compatible HTTPS/WebSocket host and validate the container on it. |
| Database and email | Local SQLite and local recovery-email outbox | Connect production PostgreSQL and SMTP, test delivery, backups and restore. |
| Account verification | Email ownership verification not implemented; age and gender self-declared | Complete the verification/age-assurance approach and test account access controls on the hosted service. |
| Support and moderation | Review/ban tools implemented; no staffed public support or appeals contact | Set operator details, contacts, review responsibility and response procedures. |
| Camera enforcement | Automated model and fail-closed relay tested with fixtures | Validate with real devices and varied camera conditions; screening is imperfect and liveness is not implemented. |
| Capacity | Two simultaneous calls, 15 minutes each; one server instance | Measure public-network latency, load, resource costs and abuse handling before raising limits. |
| Policies | Local notices contain pending operator details | Complete the published notices for the actual service and processors. |

The site has not been deployed and no paid hosting resources have been created. Removing the demo does not complete these launch tasks. Advertising and a Play Store app are not implemented. See deployment.md for configuration details and verification.md for the evidence and limits of checks.

## Current publication handoff

The tested source is committed and pushed to https://github.com/LAXMINARAYAN24/HelloAgain (branch main). The user is signed in to Render in the browser, and its dashboard is accessible. The separate Render connector still reports USER_NOT_LOGGED_IN; browser deployment is the available fallback.

The owner chose “Set up email first” before public launch. Brevo HTTPS email delivery is implemented and tested with a simulated provider, allowing a free Render host to use email without SMTP ports. A real email-service account, verified sender and secret API key are still required. No actual email was sent and no new public service or database was provisioned while awaiting that setup. A sending domain/provider account was requested from the owner.
