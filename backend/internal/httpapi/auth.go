package httpapi

import (
	"errors"
	"example.com/shared/backend/internal/auth"
	"example.com/shared/backend/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"net/http"
	"strings"
	"unicode/utf8"
)

type credentials struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func validPassword(value string) bool {
	return len(value) <= 256 && utf8.ValidString(value) && utf8.RuneCountInString(value) >= 6
}
func validLogin(value string) bool {
	if len(value) < 3 || len(value) > 32 {
		return false
	}
	for _, c := range value {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
func (a *api) register(w http.ResponseWriter, r *http.Request) {
	var data credentials
	if err := decodeJSON(r, &data); err != nil {
		fail(w, 400, "Неверный формат данных")
		return
	}
	data.Login = strings.ToLower(strings.TrimSpace(data.Login))
	if !validLogin(data.Login) {
		fail(w, 400, "Логин: 3–32 символа, латинские буквы, цифры, _ и -")
		return
	}
	if !validPassword(data.Password) {
		fail(w, 400, "Пароль должен содержать минимум 6 символов и занимать не больше 256 байт")
		return
	}
	hash, err := auth.HashPassword(data.Password)
	if err != nil {
		fail(w, 500, "Не удалось создать аккаунт")
		return
	}
	user := model.User{ID: uuid.NewString(), Login: data.Login, PasswordHash: hash}
	if err := a.db.WithContext(r.Context()).Create(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			fail(w, 409, "Этот логин уже занят")
			return
		}
		fail(w, 500, "Не удалось создать аккаунт")
		return
	}
	csrf, err := a.sessions.Create(w, r, user)
	if err != nil {
		fail(w, 500, "Аккаунт создан, но не удалось выполнить вход")
		return
	}
	respond(w, 201, map[string]any{"user": user, "csrf_token": csrf})
}
func (a *api) login(w http.ResponseWriter, r *http.Request) {
	var data credentials
	if err := decodeJSON(r, &data); err != nil {
		fail(w, 400, "Неверный формат данных")
		return
	}
	data.Login = strings.ToLower(strings.TrimSpace(data.Login))
	// Reject abnormally large payloads before an expensive password hash comparison.
	if !validLogin(data.Login) || len(data.Password) > 256 {
		fail(w, 401, "Неверный логин или пароль")
		return
	}
	var user model.User
	err := a.db.WithContext(r.Context()).Where("login = ?", data.Login).First(&user).Error
	if err != nil || !auth.VerifyPassword(user.PasswordHash, data.Password) {
		fail(w, 401, "Неверный логин или пароль")
		return
	}
	csrf, err := a.sessions.Create(w, r, user)
	if err != nil {
		fail(w, 500, "Не удалось начать сеанс")
		return
	}
	respond(w, 200, map[string]any{"user": user, "csrf_token": csrf})
}
func (a *api) me(w http.ResponseWriter, r *http.Request) {
	identity := auth.FromContext(r.Context())
	if err := a.sessions.Renew(w, r, identity); err != nil {
		if errors.Is(err, auth.ErrUnauthorized) {
			fail(w, http.StatusUnauthorized, "Нужно войти в аккаунт")
		} else {
			fail(w, http.StatusServiceUnavailable, "Не удалось проверить сеанс. Повторите позже.")
		}
		return
	}
	respond(w, 200, map[string]any{"user": identity.User, "csrf_token": identity.CSRFToken})
}
func (a *api) logout(w http.ResponseWriter, r *http.Request) {
	if err := a.sessions.Destroy(w, r); err != nil {
		fail(w, 500, "Не удалось выйти")
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
