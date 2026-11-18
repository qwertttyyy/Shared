package ratelimit

import (
	"testing"
	"time"
)

func TestLimitPerIP(t *testing.T) {
	limit := New(2, time.Minute)
	if !limit.Allow("alice") || !limit.Allow("alice") {
		t.Fatal("requests should be allowed")
	}
	if limit.Allow("alice") {
		t.Fatal("third request should be denied")
	}
	if !limit.Allow("bob") {
		t.Fatal("different IP should be independent")
	}
}
