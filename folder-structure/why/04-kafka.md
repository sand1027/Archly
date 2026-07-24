# Why: Kafka in PaperDraw

## What is Kafka?
Kafka is a distributed message queue. Instead of doing every side-effect synchronously inside
an API handler, you publish an event ("this thing happened") and workers process it later.

Think of it like dropping a letter in a mailbox:
- Your API handler drops the event into the mailbox (Kafka topic)
- Kafka holds it reliably
- Background workers pick it up and process it independently

## Why Kafka here?

Without Kafka (synchronous handler):
```
User forks a design
      ↓
API saves the fork to Postgres
      ↓
API increments fork_count           ← extra DB write inside the handler
      ↓
API logs analytics event             ← more work
      ↓
API responds to user                 ← user waited for all of this
```

With Kafka (asynchronous):
```
User forks a design
      ↓
API saves the fork to Postgres
      ↓
API publishes "design.forked" event to Kafka  ← instant
      ↓
API responds immediately ✓          ← user gets response right away

Meanwhile, in the background:
analytics_worker reads "design.forked" → increments fork_count in Postgres
```

## Topics and their purpose

| Topic | Published when | Consumed by |
|---|---|---|
| `design.published` | User publishes a design to the community | `analytics_worker` — initialises counters |
| `design.forked` | User forks a community design onto their canvas | `analytics_worker` — increments fork_count on source design |
| `ai.diagram_generated` | AI generates a diagram from text | `notify_worker` — logs usage for analytics |
| `share.viewed` | Someone opens a share link | `analytics_worker` — increments view_count on share link |
| `room.state_saved` | WebSocket hub snapshots a room's canvas state | `room_worker` — persists snapshot to collab_rooms in Postgres |

## What you learn from this
- Producer/Consumer pattern — fundamental to distributed systems at scale
- Event-driven architecture — the pattern used at Uber, Netflix, Airbnb for async workflows
- Go goroutines — workers are goroutines started in `main.go`, cancelled via context
- Decoupling — the API handler does not care if the analytics worker is slow or down

## Folder structure in apps/api

```
internal/
├── kafka/
│   ├── producer.go    ← connects to Kafka, Publish(ctx, topic, payload)
│   ├── consumer.go    ← base consumer goroutine, shared by all workers
│   └── topics.go      ← all topic name constants
└── workers/
    ├── analytics_worker.go  ← listens to design.published, design.forked, share.viewed
    ├── notify_worker.go     ← listens to ai.diagram_generated
    └── room_worker.go       ← listens to room.state_saved
```
