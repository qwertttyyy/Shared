-- +goose Up
CREATE TABLE file_deletions (
 storage_key TEXT PRIMARY KEY,
 retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS file_deletions;
