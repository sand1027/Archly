package realtime

import "encoding/json"

// MessageType identifies the kind of WebSocket message.
type MessageType string

const (
	MsgElementUpdate MessageType = "element_update"
	MsgFlowUpdate    MessageType = "flow_update"
	MsgCursorMove    MessageType = "cursor_move"
	MsgUserJoin      MessageType = "user_join"
	MsgUserLeave     MessageType = "user_leave"
	MsgFullState     MessageType = "full_state"
	MsgPing          MessageType = "ping"
	MsgPong          MessageType = "pong"
)

// Message is the wire format for all WebSocket messages.
type Message struct {
	Type    MessageType     `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// CursorPayload is the payload for cursor_move messages.
type CursorPayload struct {
	UserID      string  `json:"user_id"`
	DisplayName string  `json:"display_name"`
	Color       string  `json:"color"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
}

// UserJoinPayload is the payload for user_join messages.
type UserJoinPayload struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	Color       string `json:"color"`
}

// UserLeavePayload is the payload for user_leave messages.
type UserLeavePayload struct {
	UserID string `json:"user_id"`
}
