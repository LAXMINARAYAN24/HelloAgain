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

The user requested public deployment. The new matching choices are implemented and tested. Render was installed during this session, but listing workspaces returned USER_NOT_LOGGED_IN (“is not connected”). The project has no Git remote. GitHub connection/repository details were requested so the actual application can be uploaded. No placeholder or static-only website was published, and no paid resources were created. Deployment must resume after account sign-in and source access are supplied, with the production database/email configuration completed as part of that release.
