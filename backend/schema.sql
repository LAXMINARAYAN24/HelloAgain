CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 name TEXT NOT NULL, dob TEXT NOT NULL, gender TEXT NOT NULL CHECK(gender IN ('man','woman')),
 city TEXT NOT NULL, bio TEXT NOT NULL, interests TEXT NOT NULL, color TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','banned')),
 status_reason TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1,
 age_min INTEGER NOT NULL DEFAULT 18, age_max INTEGER NOT NULL DEFAULT 99,
 is_demo INTEGER NOT NULL DEFAULT 0, consent_version TEXT NOT NULL,
 created_at TEXT NOT NULL, last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS users_activity ON users(status,is_demo,last_seen);
CREATE TABLE IF NOT EXISTS account_tokens (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS connections (
 id TEXT PRIMARY KEY, user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 requester TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','closed')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 read_a TEXT NOT NULL, read_b TEXT NOT NULL,
 UNIQUE(user_a,user_b), CHECK(user_a <> user_b)
);
CREATE INDEX IF NOT EXISTS connections_a ON connections(user_a);
CREATE INDEX IF NOT EXISTS connections_b ON connections(user_b);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_connection ON messages(connection_id,created_at,id);
CREATE TABLE IF NOT EXISTS random_rooms (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, ended_at TEXT
);
CREATE TABLE IF NOT EXISTS blocks (
 blocker TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 blocked TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(blocker,blocked), CHECK(blocker <> blocked)
);
CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY, reporter TEXT REFERENCES users(id) ON DELETE SET NULL,
 target TEXT REFERENCES users(id) ON DELETE SET NULL,
 reason TEXT NOT NULL, detail TEXT NOT NULL, context TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 action TEXT, created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status,created_at);
CREATE TABLE IF NOT EXISTS audit (
 id TEXT PRIMARY KEY, actor TEXT REFERENCES users(id) ON DELETE SET NULL,
 target TEXT REFERENCES users(id) ON DELETE SET NULL,
 action TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS traffic_meta (
 id INTEGER PRIMARY KEY CHECK(id=1), started_at TEXT NOT NULL, total_views BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS traffic_daily (
 day TEXT NOT NULL, source TEXT NOT NULL, views BIGINT NOT NULL, PRIMARY KEY(day,source)
);
CREATE TABLE IF NOT EXISTS traffic_seen (
 event_id TEXT PRIMARY KEY, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_seen_time ON traffic_seen(created_at);
