package main

import (
	"context"
	"errors"
	"example.com/shared/backend/internal/config"
	"example.com/shared/backend/internal/httpapi"
	"example.com/shared/backend/internal/migrations"
	"example.com/shared/backend/internal/realtime"
	"example.com/shared/backend/internal/storage"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{TranslateError: true})
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	sqlDB.SetMaxOpenConns(15)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)
	if err := migrations.Apply(sqlDB); err != nil {
		return err
	}
	files, err := storage.NewLocal(cfg.UploadDir, cfg.MaxFileBytes)
	if err != nil {
		return err
	}
	hub := realtime.NewHub()
	router := httpapi.NewRouter(db, files, hub, cfg)
	server := &http.Server{Addr: ":" + cfg.Port, Handler: router, ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 75 * time.Second}
	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	cleanupDone := make(chan struct{})
	go func() {
		defer close(cleanupDone)
		files.RunDeletionQueue(stopCtx, db)
	}()
	defer func() {
		stop()
		<-cleanupDone
	}()
	go func() {
		<-stopCtx.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			slog.Error("shutdown", "error", err)
		}
	}()
	slog.Info("listening", "port", cfg.Port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
