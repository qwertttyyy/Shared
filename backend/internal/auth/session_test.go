package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSessionCookiePrefersSharedAndAcceptsLegacy(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	request.AddCookie(&http.Cookie{Name: legacyCookieName, Value: "legacy"})
	cookie, err := sessionCookie(request)
	if err != nil || cookie.Value != "legacy" {
		t.Fatalf("legacy session cookie = %v, %v", cookie, err)
	}

	request.AddCookie(&http.Cookie{Name: CookieName, Value: "shared"})
	cookie, err = sessionCookie(request)
	if err != nil || cookie.Value != "shared" {
		t.Fatalf("current session cookie = %v, %v", cookie, err)
	}
}

func TestDestroyExpiresBothCookieNames(t *testing.T) {
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	if err := NewSessions(nil, true).Destroy(response, request); err != nil {
		t.Fatal(err)
	}
	expired := make(map[string]bool)
	for _, cookie := range response.Result().Cookies() {
		expired[cookie.Name] = cookie.MaxAge < 0 && cookie.Secure && cookie.HttpOnly
	}
	if !expired[CookieName] || !expired[legacyCookieName] {
		t.Fatalf("expired cookies = %v", expired)
	}
}
