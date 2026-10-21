# Email activation handoff

The owner requested real email setup before the public website is launched.

## Implemented

`backend/mail.mjs` supports SMTP, a private development-only outbox, and Brevo’s HTTPS transactional API at `https://api.brevo.com/v3/smtp/email`. Free Render blocks ordinary SMTP ports, so use HTTPS delivery there. The API uses a bounded timeout and refuses redirects; provider errors do not print secrets, recipient details or reset links. Production never silently falls back to the development outbox.

## Required account setup

1. Sign in to an email-service account. If using the implemented integration, use Brevo.
2. Create and verify the sender address in that account. An owned authenticated domain is preferred; provider restrictions and verification requirements must be completed in the actual account.
3. Create an API key in the provider’s dashboard and place it in Render’s secret environment settings as `BREVO_API_KEY`.
4. Configure `EMAIL_MODE=brevo`, `EMAIL_FROM=<verified sender email>` and `EMAIL_FROM_NAME=HelloAgain`.
5. After the hosted application/database is configured, verify real password recovery and inbox delivery using a controlled account before inviting public users.

The user must complete account sign-in, any terms acceptance, email verification and API-key creation steps. API keys are never committed, placed in the source archive, or requested in chat. No real provider account or sender has been verified yet.

Primary references: https://developers.brevo.com/docs/send-a-transactional-email and https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email .
