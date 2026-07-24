# Why: Real-time Collaboration (WebSocket)

## What does it do?
When two users are in the same room, every canvas change is broadcast to all other
participants in real time. Each browser sees the same canvas state within milliseconds.

## Why WebSocket instead of HTTP polling?
- HTTP polling: client asks "anything new?" every 500ms — laggy, wastes bandwidth
- WebSocket: server pushes changes the moment they happen — instant, efficient
- For 60fps canvas collaboration, polling is completely unusable

## Architecture

```
Browser A changes an element
      ↓
ws-client.ts sends { type: "element_update", payload: elements }
      ↓
Go WebSocket Hub receives message from Client A
      ↓
Hub broadcasts to all other clients in the same room
      ↓
Browser B receives the update
      ↓
useCollaboration.ts calls excalidrawAPI.updateScene({ elements })
      ↓
Browser B canvas updates instantly
```

## Why Redis pub/sub for rooms?
In production with multiple API instances (horizontal scaling), a WebSocket connection
to instance #1 cannot directly reach clients connected to instance #2.

Redis pub/sub solves this:
- Instance #1 publishes a room update to Redis channel `room:{id}`
- Instance #2 (and #1) are subscribed to that channel
- Both broadcast to their locally connected clients

## Why persist room state to Kafka + Postgres?
WebSocket connections are ephemeral. If the server restarts, all in-memory room state is lost.

The `room_worker` Kafka consumer receives `room.state_saved` events and writes the current
canvas snapshot to `collab_rooms.elements` in Postgres. When a new user joins a room, they
receive the full current state from Postgres as their first message.

## hub.go — the room registry

```go
type Hub struct {
    rooms sync.Map  // roomCode → *Room
}

type Room struct {
    clients sync.Map   // *Client → bool
    state   []byte     // latest canvas JSON
}
```

`sync.Map` is used instead of `map + mutex` because rooms are read far more
often than they are created/deleted — sync.Map is optimised for this pattern.
