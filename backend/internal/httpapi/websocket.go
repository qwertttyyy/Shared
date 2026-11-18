package httpapi

import (
	"context"
	"example.com/shared/backend/internal/auth"
	"github.com/coder/websocket"
	"net/http"
	"strings"
	"time"
)

func (a *api) websocket(w http.ResponseWriter, r *http.Request) {
	// Cookie authentication also applies to the WebSocket handshake.
	if origin := r.Header.Get("Origin"); !strings.EqualFold(origin, a.cfg.PublicOrigin) {
		fail(w, 403, "Недопустимый источник подключения")
		return
	}
	identity := auth.FromContext(r.Context())
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{strings.TrimPrefix(strings.TrimPrefix(a.cfg.PublicOrigin, "https://"), "http://")}})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")
	client := a.hub.Register(identity.User.ID)
	defer a.hub.Unregister(identity.User.ID, client)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	closed := make(chan struct{})
	go func() {
		defer close(closed)
		for {
			// Messages from clients are ignored; read keeps control frames working.
			if _, _, err := conn.Read(ctx); err != nil {
				return
			}
		}
	}()
	ticker := time.NewTicker(35 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-closed:
			return
		case <-ctx.Done():
			return
		case event := <-client.Messages:
			writeCtx, cancelWrite := context.WithTimeout(ctx, 5*time.Second)
			err := conn.Write(writeCtx, websocket.MessageText, event)
			cancelWrite()
			if err != nil {
				return
			}
		case <-ticker.C:
			pingCtx, cancelPing := context.WithTimeout(ctx, 5*time.Second)
			err := conn.Ping(pingCtx)
			cancelPing()
			if err != nil {
				return
			}
		}
	}
}
