# Live camera implementation and limits

## Rules shown before Start

Allow camera and microphone access. Keep the camera on, lens uncovered, face and shoulders clearly visible and lighting sufficient. Everyone must stay fully clothed with a shirt on. Black/off/covered feeds, nudity, exposed private parts and sexual activity are prohibited. Use Next, Stop or Report / block at any time. Leaving the tab stops the call and releases devices.

## Implemented media path

1. An explicit Start click captures a 480×360 camera stream and microphone. A pre-call JPEG is screened on the server. Failed checks never enter the queue.
2. Authenticated adults are matched with a waiting eligible person accepted by both people’s choices. Random accepts any declared gender; Women / Men accepts the opposite declared gender. Same-gender rooms require both participants to select Random. Both have pressed Start and accepted rules; neither is a blocked, expired or sample account.
3. Authenticated, origin-checked WebSockets relay video and audio through the application. They are not peer-to-peer calls. A call ID alone is insufficient for access.
4. The browser sends JPEG pictures approximately every 350 ms. A persistent Python worker validates image size, checks near-black pixels and runs NudeNet. A face must be visible. Exposed chest/private-part classes are rejected. Model labels are not identity or gender verification.
5. Only screened pictures are forwarded. Audio uses 24 kHz mono PCM in 100 ms packets and is forwarded only when both cameras have approved pictures less than two seconds old. Bounded queues, frame sizes and send rates limit load.
6. Failed visibility checks immediately withhold pictures and clear the remote canvas. Stale pictures/audio are suppressed; roughly six seconds without a clear picture ends the call. A worker outage fails closed and stops the call.
7. Prohibited-exposure flags immediately end media, suspend the account, revoke sessions and create a metadata-only report with the label/score. Camera pictures and audio are not saved. A human confirms violations and bans, or restores a mistaken suspension. A technical black screen does not automatically establish intentional misconduct.
8. Next/Stop closes the old random room on the server. Text access is room-authorized, old text is cleared from the visible panel and blocked/recently skipped pairs are excluded from matching. Restart closes orphaned random rooms.

## Pilot limits

Two simultaneous calls; 15 minutes each; low-frame-rate JPEG video rather than smooth high-resolution WebRTC. No claim of production scale, verified identities, liveness detection, flawless nudity/clothing detection or guaranteed prevention of every unsafe image. A static test picture can pass the model; liveness enforcement is not implemented. Detection thresholds and clothing/body diversity require broader evaluation before public release.

The current service stores no call recordings. Account/session, text, moderation metadata and random-room linkage still exist in the database and have separate retention rules. Read the privacy notice and deployment handover. NudeNet distribution includes AGPL-3.0 license text; see `licenses/` and `THIRD_PARTY_NOTICES.md` before redistribution/hosted use.

## Evidence

`npm run test:calls` uses four disposable accounts and synthetic camera/audio sources to exercise two simultaneous real server-relayed, screened calls. It verifies media in both directions, partner switching, fresh text, old-room denial, mute, mobile layout and black-screen cutoff. The interactive demonstration has been removed from the application; automated development checks remain.
