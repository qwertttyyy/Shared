package realtime

import (
	"testing"
	"time"
)

func TestHubOnlyNotifiesOwner(t *testing.T) {
	hub := NewHub()
	alice := hub.Register("alice")
	bob := hub.Register("bob")
	defer hub.Unregister("alice", alice)
	defer hub.Unregister("bob", bob)
	hub.NotifyCreated("alice", "note-1")
	select {
	case <-alice.Messages:
	case <-time.After(time.Second):
		t.Fatal("owner did not get event")
	}
	select {
	case <-bob.Messages:
		t.Fatal("another user received the event")
	default:
	}
}
