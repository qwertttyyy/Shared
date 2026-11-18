-- +goose Up
CREATE TABLE users (
 id UUID PRIMARY KEY,
 login VARCHAR(64) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE sessions (
 token_hash VARCHAR(64) PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE TABLE items (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type VARCHAR(16) NOT NULL CHECK (type IN ('text', 'file')),
 text TEXT NOT NULL DEFAULT '',
 caption TEXT NOT NULL DEFAULT '',
 original_filename TEXT NOT NULL DEFAULT '',
 storage_key TEXT NOT NULL DEFAULT '',
 content_type TEXT NOT NULL DEFAULT '',
 size BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_items_user_created ON items(user_id, created_at DESC, id DESC);
-- +goose Down
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
