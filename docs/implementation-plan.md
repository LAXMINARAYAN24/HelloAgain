# Current implementation status

The primary product is adults-only random live video/text chat, inspired by the camera-first interaction of random-chat services. It is not a profile directory or dating-card home page. Optional dating features can be considered separately later.

The temporary interactive demonstration and its test authentication have been removed.

Completed: responsive camera-first home, Start/Next/Stop, minimal signup, persistent login, Random/everyone and reciprocal Women/Men queue matching, blocked/recent-pair exclusion, server-screened media relay, per-room text, safety controls, account data tools, moderation workflow. The earlier profile-discovery and invitation service remains legacy backend capability, outside the current home/navigation. No discovery query runs from the random home page.

Current local pilot constraints: two simultaneous calls, 15-minute calls, low-frame-rate video, self-declared age/gender, automated screening limitations and no public deployment. No advertising or app-store build is active.

Next deployment work: connect a compatible external host; configure HTTPS, PostgreSQL and SMTP; run the container/remote-database smoke tests; complete email ownership verification, age assurance, operator/support contacts and staffed review/appeals; validate backups, retention, capacity and abuse controls. No live database or hosting secrets belong in source artifacts.
