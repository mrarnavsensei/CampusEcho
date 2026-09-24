CREATE TABLE user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX email_tokens_user_idx ON email_tokens(user_id, purpose);
CREATE TABLE security_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  resets_at INTEGER NOT NULL
);
CREATE INDEX security_rate_expiry_idx ON security_rate_limits(resets_at);
CREATE TABLE student_verifications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'domain_verified' CHECK(status IN ('domain_verified','pending','approved','rejected')),
  reviewed_by TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
