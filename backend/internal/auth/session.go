package auth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"example.com/shared/backend/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"math"
	"net/http"
	"strings"
	"time"
)

const CookieName = "shared_session"
const legacyCookieName = "ryadom_session"
const lifetime = 60 * 24 * time.Hour
const renewWithin = 45 * 24 * time.Hour

type contextKey struct{}
type Identity struct {
	User        model.User
	CSRFToken   string
	SessionHash string
	ExpiresAt   time.Time
}

type Sessions struct {
	db     *gorm.DB
	secure bool
}

func NewSessions(db *gorm.DB, secure bool) *Sessions { return &Sessions{db: db, secure: secure} }

func hashToken(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func sessionCookie(r *http.Request) (*http.Cookie, error) {
	cookie, err := r.Cookie(CookieName)
	if err == http.ErrNoCookie {
		return r.Cookie(legacyCookieName)
	}
	return cookie, err
}

func (s *Sessions) Create(w http.ResponseWriter, r *http.Request, user model.User) (string, error) {
	token, err := RandomToken()
	if err != nil {
		return "", err
	}
	csrf, err := RandomToken()
	if err != nil {
		return "", err
	}
	session := model.Session{TokenHash: hashToken(token), UserID: user.ID, CSRFToken: csrf, ExpiresAt: time.Now().Add(lifetime)}
	if err := s.db.WithContext(r.Context()).Create(&session).Error; err != nil {
		return "", err
	}
	s.setCookie(w, token, session.ExpiresAt)
	return csrf, nil
}

func (s *Sessions) setCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name: CookieName, Value: token, Path: "/", HttpOnly: true, Secure: s.secure,
		SameSite: http.SameSiteLaxMode, Expires: expiresAt, MaxAge: int(math.Ceil(time.Until(expiresAt).Seconds())),
	})
}

func (s *Sessions) Renew(w http.ResponseWriter, r *http.Request, identity *Identity) error {
	now := time.Now()
	if identity.ExpiresAt.After(now.Add(renewWithin)) {
		return nil
	}
	cookie, err := sessionCookie(r)
	if err != nil {
		return err
	}
	var session model.Session
	result := s.db.WithContext(r.Context()).Model(&session).
		Clauses(clause.Returning{Columns: []clause.Column{{Name: "expires_at"}}}).
		Where("token_hash = ? AND expires_at > ?", identity.SessionHash, now).
		Update("expires_at", gorm.Expr("GREATEST(expires_at, ?)", now.Add(lifetime)))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUnauthorized
	}
	s.setCookie(w, cookie.Value, session.ExpiresAt)
	return nil
}

func (s *Sessions) Destroy(w http.ResponseWriter, r *http.Request) error {
	if cookie, err := sessionCookie(r); err == nil {
		if err := s.db.WithContext(r.Context()).Where("token_hash = ?", hashToken(cookie.Value)).Delete(&model.Session{}).Error; err != nil {
			return err
		}
	}
	for _, name := range []string{CookieName, legacyCookieName} {
		http.SetCookie(w, &http.Cookie{Name: name, Path: "/", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	}
	return nil
}

func (s *Sessions) Identity(r *http.Request) (*Identity, error) {
	cookie, err := sessionCookie(r)
	if err != nil || len(cookie.Value) != 43 {
		return nil, ErrUnauthorized
	}
	var row struct {
		UserID        string    `gorm:"column:user_id"`
		Login         string    `gorm:"column:login"`
		UserCreatedAt time.Time `gorm:"column:user_created_at"`
		TokenHash     string    `gorm:"column:token_hash"`
		CSRFToken     string    `gorm:"column:csrf_token"`
		ExpiresAt     time.Time `gorm:"column:expires_at"`
	}
	// A single JOIN retrieves both the valid session and its owner.
	err = s.db.WithContext(r.Context()).Table("sessions").
		Select("sessions.user_id, sessions.token_hash, sessions.csrf_token, sessions.expires_at, users.login, users.created_at AS user_created_at").
		Joins("JOIN users ON users.id = sessions.user_id").
		Where("sessions.token_hash = ? AND sessions.expires_at > ?", hashToken(cookie.Value), time.Now()).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	user := model.User{ID: row.UserID, Login: row.Login, CreatedAt: row.UserCreatedAt}
	return &Identity{User: user, CSRFToken: row.CSRFToken, SessionHash: row.TokenHash, ExpiresAt: row.ExpiresAt}, nil
}

func (s *Sessions) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, err := s.Identity(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			if errors.Is(err, ErrUnauthorized) {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"Нужно войти в аккаунт"}`))
			} else {
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte(`{"error":"Не удалось проверить сеанс. Повторите позже."}`))
			}
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, identity)))
	})
}

func FromContext(ctx context.Context) *Identity {
	identity, _ := ctx.Value(contextKey{}).(*Identity)
	return identity
}

func CheckCSRF(identity *Identity, r *http.Request) bool {
	if identity == nil {
		return false
	}
	value := strings.TrimSpace(r.Header.Get("X-CSRF-Token"))
	return len(value) > 0 && subtle.ConstantTimeCompare([]byte(value), []byte(identity.CSRFToken)) == 1
}
