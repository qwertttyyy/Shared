package auth

import "testing"

func TestPasswordRoundtrip(t *testing.T) {
	encoded, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword(encoded, "correct horse battery staple") {
		t.Fatal("expected matching password")
	}
	if VerifyPassword(encoded, "bad password") {
		t.Fatal("unexpected password match")
	}
}
