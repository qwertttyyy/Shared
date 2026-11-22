package httpapi

import (
	"encoding/json"
	"example.com/shared/backend/internal/auth"
	"example.com/shared/backend/internal/config"
	"example.com/shared/backend/internal/ratelimit"
	"example.com/shared/backend/internal/realtime"
	"example.com/shared/backend/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"gorm.io/gorm"
	"net/http"
	"strings"
	"time"
)

type api struct {
	db       *gorm.DB
	sessions *auth.Sessions
	files    *storage.Local
	hub      *realtime.Hub
	cfg      config.Config
}

func NewRouter(db *gorm.DB, files *storage.Local, hub *realtime.Hub, cfg config.Config) http.Handler {
	a := &api{db: db, sessions: auth.NewSessions(db, cfg.CookieSecure), files: files, hub: hub, cfg: cfg}
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer)
	r.Use(a.requireOriginForWrites)
	clientIP := middleware.ClientIPFromRemoteAddr
	if cfg.TrustProxy {
		clientIP = middleware.ClientIPFromHeader("X-Real-IP")
	}
	r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) { respond(w, 200, map[string]string{"status": "ok"}) })
	r.With(clientIP, ratelimit.New(5, time.Minute).Middleware).Post("/api/auth/register", a.register)
	r.With(clientIP, ratelimit.New(10, time.Minute).Middleware).Post("/api/auth/login", a.login)
	r.Group(func(r chi.Router) {
		r.Use(a.sessions.Require)
		r.Get("/api/auth/me", a.me)
		r.With(a.requireCSRF).Post("/api/auth/logout", a.logout)
		r.Get("/api/items", a.listItems)
		r.Get("/api/items/stats", a.itemStats)
		r.Get("/api/items/{id}", a.getItem)
		r.With(a.requireCSRF).Post("/api/items/text", a.createText)
		r.With(a.requireCSRF).Post("/api/items/file", a.createFile)
		r.With(a.requireCSRF).Post("/api/items/batch-delete", a.deleteItems)
		r.With(a.requireCSRF).Patch("/api/items/{id}", a.updateText)
		r.With(a.requireCSRF).Delete("/api/items/{id}", a.deleteText)
		r.Get("/api/items/{id}/download", a.downloadFile)
		r.Get("/api/items/{id}/content", a.previewFile)
		r.Get("/api/items/{id}/text-preview", a.previewTextFile)
		r.Get("/api/ws", a.websocket)
	})
	return r
}
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}
func decodeJSON(r *http.Request, out any) error {
	return json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20)).Decode(out)
}
func (a *api) requireOriginForWrites(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete || r.Method == http.MethodPatch {
			if origin := r.Header.Get("Origin"); origin != "" && !strings.EqualFold(origin, a.cfg.PublicOrigin) {
				fail(w, 403, "Недопустимый источник запроса")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
func (a *api) requireCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !auth.CheckCSRF(auth.FromContext(r.Context()), r) {
			fail(w, 403, "Неверный CSRF-токен")
			return
		}
		next.ServeHTTP(w, r)
	})
}
