package ratelimit

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

type entry struct {
	count     int
	expiresAt time.Time
}

type Limiter struct {
	mu       sync.Mutex
	attempts map[string]entry
	max      int
	window   time.Duration
	calls    uint64
}

func New(max int, window time.Duration) *Limiter {
	return &Limiter{attempts: make(map[string]entry), max: max, window: window}
}

// Allow limits requests from one client IP within a fixed time window.
func (l *Limiter) Allow(ip string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	l.calls++
	if l.calls%256 == 0 {
		for key, value := range l.attempts {
			if now.After(value.expiresAt) {
				delete(l.attempts, key)
			}
		}
	}
	current := l.attempts[ip]
	if now.After(current.expiresAt) {
		current = entry{expiresAt: now.Add(l.window)}
	}
	if current.count >= l.max {
		return false
	}
	current.count++
	l.attempts[ip] = current
	return true
}

func (l *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := middleware.GetClientIP(r.Context())
		if host == "" {
			var err error
			host, _, err = net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				host = r.RemoteAddr
			}
		}
		if !l.Allow(host) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"Слишком много попыток. Попробуйте позже."}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}
