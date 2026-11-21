package storage

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"time"

	"gorm.io/gorm"
)

func (s *Local) RunDeletionQueue(ctx context.Context, db *gorm.DB) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for ctx.Err() == nil {
		if err := s.cleanDeletedFiles(ctx, db); err != nil && ctx.Err() == nil {
			slog.Error("file deletion queue", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Local) cleanDeletedFiles(ctx context.Context, db *gorm.DB) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var keys []string
		if err := tx.Raw(`
			SELECT storage_key FROM file_deletions
			WHERE retry_at <= NOW() ORDER BY retry_at, storage_key
			LIMIT 100 FOR UPDATE SKIP LOCKED`).Scan(&keys).Error; err != nil {
			return err
		}
		removed := make([]string, 0, len(keys))
		var retry []string
		for _, key := range keys {
			if err := s.Remove(key); err != nil && !errors.Is(err, os.ErrNotExist) {
				slog.Warn("retrying stored file deletion", "error", err)
				retry = append(retry, key)
				continue
			}
			removed = append(removed, key)
		}
		if len(removed) > 0 {
			if err := tx.Exec("DELETE FROM file_deletions WHERE storage_key IN ?", removed).Error; err != nil {
				return err
			}
		}
		if len(retry) > 0 {
			return tx.Exec("UPDATE file_deletions SET retry_at = NOW() + INTERVAL '1 minute' WHERE storage_key IN ?", retry).Error
		}
		return nil
	})
}
