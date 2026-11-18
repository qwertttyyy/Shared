package realtime

import (
	"encoding/json"
	"sync"
)

type Client struct{ Messages chan []byte }

type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[*Client]struct{}
}

func NewHub() *Hub { return &Hub{clients: make(map[string]map[*Client]struct{})} }
func (h *Hub) Register(userID string) *Client {
	client := &Client{Messages: make(chan []byte, 16)}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*Client]struct{})
	}
	h.clients[userID][client] = struct{}{}
	return client
}
func (h *Hub) Unregister(userID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if users := h.clients[userID]; users != nil {
		delete(users, client)
		if len(users) == 0 {
			delete(h.clients, userID)
		}
	}
}
func (h *Hub) NotifyCreated(userID, itemID string) {
	payload, err := json.Marshal(map[string]string{"type": "item.created", "item_id": itemID})
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients[userID] {
		select {
		case client.Messages <- payload:
		default: /* offline clients resync via REST */
		}
	}
}
