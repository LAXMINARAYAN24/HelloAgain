# HelloAgain — random live chat

An independent adults-only random video and text chat website. The home page opens directly to two cameras, a text panel and Start / Next / Stop. There are no profile cards or dating discovery on the home page. The free public pilot is https://helloagain-live.onrender.com/ .

## Start on this Windows computer

1. Run `Setup-Video.cmd` once to install Python camera-screening dependencies. Python 3.12+ and Node 24+ must be installed.
2. Run `Start-HelloAgain.cmd` and keep its window open.
3. Open http://127.0.0.1:4310 . Log in or create an adult account.
4. Read and acknowledge the camera rules, then press **Start** and allow camera/microphone access.
5. Choose **Random (everyone)** to meet any eligible adult, or **Women** if you are a man / **Men** if you are a woman. A second adult with compatible preferences must also press Start. Until then the site waits honestly; it does not invent people or online counts.
6. **Next** ends the current room, clears its text and searches for a new partner. **Stop** leaves the queue, ends contact and releases camera/microphone access.

Dependencies and video screening are installed in this workspace. For a new copy run `npm ci`, `Setup-Video.cmd`, then `npm run build`. The source archive excludes private accounts, passwords, the database, local emails and dependencies. Existing account data stays in `data/helloagain.sqlite` on this computer.

## What works

- Single-page signup requiring display name, email, password, date of birth, declared gender and consent. No public biography, interests or city are needed. The date-of-birth check is self-declaration, not verified age.
- Random matching between active adults who both press Start, pass a recent camera check and meet reciprocal preferences. Random accepts any declared gender; Women / Men restricts to the opposite declared gender. A match must satisfy both people’s choices. Stop the current search/call before changing the choice. Blocks, expired sessions and sample accounts cannot bypass matching checks.
- Two simultaneous calls in this pilot, up to 15 minutes per call. A recently skipped pair is avoided for five minutes. Queue entries expire after seven seconds without a heartbeat.
- Server-relayed video and audio. Every transmitted picture is screened before forwarding. Audio requires recent approved pictures from both participants. A paused or missing camera clears remote video and ends the call if it is not corrected.
- Live text for the current room, refreshed about once a second. No daily quota; 30 messages/minute and 4,000 characters/message prevent spam. The latest 100 messages are shown. Old room access closes with Next or Stop; sent texts may still be retained for up to 90 days and included in account exports or reports.
- Mute microphone/speaker, report, immediate two-way block, account editing/export/deletion, password recovery, moderation decisions and audit history.
- No black/covered/off camera, no shirtless appearance for anyone, nudity, exposed private parts or sexual activity. Keep face visible with good lighting and remain fully clothed.
- Automated prohibited-exposure flags stop media immediately and suspend the source account pending review. A moderator confirms violations and bans; darkness or a technical fault alone does not prove misconduct. Automated screening can miss violations or flag mistakes.
- Camera images and audio are processed in memory, without recording. This is server-readable media, not end-to-end encryption. Privacy, terms and rules explain actual behavior and outstanding operator details.
- No ad SDK, analytics tracker, payment system or app-store listing is active.

## Development and verification

```powershell
npm run dev
npm run check
npm run test:browser
npm run test:calls
node scripts/backup.mjs
```

Browser tests use Microsoft Edge and isolated disposable accounts; camera/audio inputs are synthetic. The call tests exercise four independent accounts in two simultaneous calls, Next partner switching, room isolation, text, mobile rendering, mute and black-screen cutoff. See `docs/verification.md`.

To grant an existing operator account moderation access, run `npm run admin -- --email <operator-email>`. The normal member is not an administrator. No passwords are saved in this document.

## Hosting

The website runs independently in an ordinary browser. Localhost works without deployment. Access from other devices needs a public HTTPS host with WebSocket support, Node 24, Python/ONNX and sufficient CPU/memory, plus a production PostgreSQL database and a configured email provider (SMTP or Brevo HTTPS). The included Dockerfile prepares this topology. The Docker image is deployed on Render for a limited public pilot; see docs/public-pilot.md for the current verification state.

This backend cannot run as a static-only upload or inside the Sites Cloudflare Worker runtime. The source is now uploaded to https://github.com/LAXMINARAYAN24/HelloAgain . Browser access to the signed-in Render dashboard works; the separate hosting connector still returns “not connected.” The public pilot is https://helloagain-live.onrender.com/ . Real recovery email delivery is verified. The owner chose Render’s free database, which expires on 20 November 2026. No paid resources have been created. Free/unlimited video hosting is not promised: bandwidth, screening compute, email, database, moderation and uptime have finite capacity.

See `docs/deployment.md` for configuration and remaining public-launch work. A Play Store app is not required to use the website; no Android package or store submission has been built.

## Email for free Render hosting

Brevo HTTPS delivery is implemented so the application can send recovery emails without SMTP ports. In Render’s secret environment settings, configure `EMAIL_MODE=brevo`, `BREVO_API_KEY`, `EMAIL_FROM` (a sender verified in the email-provider account) and optionally `EMAIL_FROM_NAME=HelloAgain`. Store the API key in the hosting secret manager. Production refuses local-only mail and incomplete Brevo configuration. A verified sender and restricted key are configured on Render. Brevo confirmed delivery of the owner-approved recovery test; see docs/public-pilot.md. Keys and recipient details are not committed.

SMTP remains supported on hosts that permit it. The local Windows preview keeps its private local-email outbox. The owner chose email setup before public launch.
