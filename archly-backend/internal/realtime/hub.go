package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/archly/api/internal/kafka"
	"github.com/archly/api/internal/kafka/topics"
	"github.com/archly/api/internal/middleware"
	sqlcgen "github.com/archly/api/internal/sqlc/generated"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true }, // CORS handled at router level
}

type inboundMsg struct {
	client *Client
	data   []byte
}

// Hub maintains the set of active WebSocket clients and broadcasts messages.
// Each room is an isolated map of clients.
type Hub struct {
	mu         sync.RWMutex
	rooms      map[string]map[*Client]bool // roomID → set of clients
	register   chan *Client
	unregister chan *Client
	inbound    chan inboundMsg

	pool     *pgxpool.Pool
	q        *sqlcgen.Queries
	rdb      *redis.Client
	producer kafka.Producer
}

// NewHub creates a Hub. Call hub.Run(ctx) in a goroutine.
func NewHub(pool *pgxpool.Pool, rdb *redis.Client, producer kafka.Producer) *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client, 256),
		unregister: make(chan *Client, 256),
		inbound:    make(chan inboundMsg, 1024),
		pool:       pool,
		q:          sqlcgen.NewFromPool(pool),
		rdb:        rdb,
		producer:   producer,
	}
}

// Run is the hub's main event loop. Must be called in a goroutine.
func (h *Hub) Run(ctx context.Context) {
	saveTicker := time.NewTicker(30 * time.Second)
	defer saveTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case client := <-h.register:
			h.mu.Lock()
			if h.rooms[client.roomID] == nil {
				h.rooms[client.roomID] = make(map[*Client]bool)
			}
			h.rooms[client.roomID][client] = true
			h.mu.Unlock()

			// Send current canvas state to the new joiner
			go h.sendFullState(ctx, client)

		case client := <-h.unregister:
			h.mu.Lock()
			if room, ok := h.rooms[client.roomID]; ok {
				if _, ok := room[client]; ok {
					delete(room, client)
					close(client.send)
					if len(room) == 0 {
						delete(h.rooms, client.roomID)
					}
				}
			}
			h.mu.Unlock()

			// Notify remaining room members
			h.broadcastToRoom(client.roomID, client, mustMarshal(Message{
				Type:    MsgUserLeave,
				Payload: mustMarshalRaw(map[string]string{"user_id": client.userID}),
			}))

		case msg := <-h.inbound:
			h.handleInbound(ctx, msg)

		case <-saveTicker.C:
			// Publish room.state_saved events for all active rooms
			h.mu.RLock()
			for roomID := range h.rooms {
				rid := roomID
				_ = h.producer.Publish(topics.RoomStateSaved, rid, map[string]string{"room_id": rid})
			}
			h.mu.RUnlock()
		}
	}
}

// handleInbound processes a message from a client.
func (h *Hub) handleInbound(ctx context.Context, msg inboundMsg) {
	var m Message
	if err := json.Unmarshal(msg.data, &m); err != nil {
		return // malformed — ignore
	}

	switch m.Type {
	case MsgPing:
		reply, _ := json.Marshal(Message{Type: MsgPong})
		select {
		case msg.client.send <- reply:
		default:
		}

	case MsgElementUpdate, MsgFlowUpdate, MsgCursorMove, MsgUserJoin:
		// Broadcast to everyone else in the room
		h.broadcastToRoom(msg.client.roomID, msg.client, msg.data)

	case MsgUserLeave:
		// Client is gracefully announcing departure — handled by unregister too
		h.broadcastToRoom(msg.client.roomID, msg.client, msg.data)
	}
}

// ServeWS upgrades the HTTP connection to WebSocket and registers the client.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "roomId")
	if roomID == "" {
		http.Error(w, "room id required", http.StatusBadRequest)
		return
	}

	// Archly+ gate — check tier from JWT
	if !middleware.IsProFromCtx(r.Context()) {
		http.Error(w, `{"code":"UPGRADE_REQUIRED","message":"real-time collaboration requires Archly+"}`, http.StatusPaymentRequired)
		return
	}

	userID := ""
	if id, ok := middleware.UserIDFromCtx(r.Context()); ok {
		userID = id.String()
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Warn().Err(err).Msg("ws upgrade failed")
		return
	}

	client := &Client{
		hub:    h,
		roomID: roomID,
		userID: userID,
		conn:   conn,
		send:   make(chan []byte, 256),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

// BroadcastToRoom satisfies the interface used by the broadcast HTTP handler.
func (h *Hub) BroadcastToRoom(roomID string, msg []byte) {
	h.broadcastToRoom(roomID, nil, msg)
}

// broadcastToRoom sends a message to all clients in a room except the sender.
func (h *Hub) broadcastToRoom(roomID string, sender *Client, msg []byte) {
	h.mu.RLock()
	clients := h.rooms[roomID]
	h.mu.RUnlock()

	for client := range clients {
		if client == sender {
			continue
		}
		select {
		case client.send <- msg:
		default:
			// Slow client — drop message (client's writePump will drain or close)
		}
	}
}

// sendFullState loads the last saved canvas state from Postgres and sends it
// to the newly joined client as a full_state message.
func (h *Hub) sendFullState(ctx context.Context, client *Client) {
	roomUUID, err := uuid.Parse(client.roomID)
	if err != nil {
		return
	}
	room, err := h.q.GetCollabRoom(ctx, roomUUID)
	if err != nil {
		return // no saved state yet — that's fine
	}

	msg, _ := json.Marshal(Message{
		Type: MsgFullState,
		Payload: mustMarshalRaw(map[string]json.RawMessage{
			"elements":  room.Elements,
			"app_state": room.AppState,
		}),
	})
	select {
	case client.send <- msg:
	default:
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────

func mustMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func mustMarshalRaw(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return json.RawMessage(b)
}
