/**
 * Interview problem bank — all system design problems with metadata.
 * Extracted from the real archly.dev source (index.js).
 */

import type { InterviewProblem } from "@/types";

export const INTERVIEW_PROBLEMS: InterviewProblem[] = [
  {
    id: "twitter-feed",
    title: "Twitter / X Feed",
    difficulty: "hard",
    durationMins: 45,
    tags: ["social", "feed", "fanout", "caching"],
    prompt:
      "Design the Twitter timeline feed for 100M daily active users. Users can follow others and see a real-time feed of tweets from people they follow.",
    keyChallenge:
      "Fan-out on write vs read. Celebrity accounts have 50M+ followers — naive fan-out on write causes write amplification. Hybrid approach needed.",
    rubric: [
      "Clarified DAU, feed freshness, and celebrity-follower constraints",
      "Chose fan-out strategy (write / read / hybrid) with trade-offs",
      "Included caching layer for hot timelines",
      "Addressed ranking / timeline assembly path",
      "Discussed failure modes and backfill for new follows",
    ],
  },
  {
    id: "url-shortener",
    title: "URL Shortener",
    difficulty: "easy",
    durationMins: 30,
    tags: ["hashing", "cdn", "redirect", "caching"],
    prompt:
      "Design a URL shortening service like bit.ly. Users submit long URLs and get a short slug. Billions of redirects per day.",
    keyChallenge:
      "CDN can cache popular URLs (301). DB only for rare/new ones. No DB join needed — key-value lookup pattern.",
    rubric: [
      "Defined write path (create short URL) vs read path (redirect)",
      "Chose ID generation (hash / counter / base62) with collision handling",
      "Used CDN or cache for hot redirects",
      "Estimated storage and QPS roughly",
      "Mentioned analytics / expiry if relevant",
    ],
  },
  {
    id: "video-streaming",
    title: "Video Streaming (YouTube/Netflix)",
    difficulty: "hard",
    durationMins: 60,
    tags: ["cdn", "transcoding", "adaptive bitrate", "storage"],
    prompt:
      "Design a video streaming platform like YouTube or Netflix. Users upload videos that are transcoded and streamed to millions of viewers globally.",
    keyChallenge:
      "CDN is essential — video bytes are the bulk of traffic. CDN absorbs 90%+ of bytes; origin only handles uploads and misses. Async transcoding pipeline via message queue after upload.",
    rubric: [
      "Separated upload, transcoding, and playback paths",
      "Placed CDN in front of object storage for playback",
      "Used async queue/workers for transcoding",
      "Mentioned adaptive bitrate / multiple resolutions",
      "Discussed metadata store vs blob store split",
    ],
  },
  {
    id: "ride-sharing",
    title: "Ride-Sharing (Uber)",
    difficulty: "hard",
    durationMins: 45,
    tags: ["websocket", "geolocation", "kafka", "matching"],
    prompt:
      "Design Uber's ride-matching system. Drivers and riders are matched in real-time. Location updates stream constantly from mobile clients.",
    keyChallenge:
      "WebSocket for location updates. Consistent hash for geo sharding. Machine ID at scale is the hardest part — leasing from a coord service.",
    rubric: [
      "Real-time location updates (WebSocket / streaming)",
      "Geo indexing / sharding strategy",
      "Matching service with supply/demand considerations",
      "Discussed dispatch latency and fairness",
      "Covered failure when matcher or location service dies",
    ],
  },
  {
    id: "chat-messaging",
    title: "Chat / Messaging App",
    difficulty: "medium",
    durationMins: 45,
    tags: ["websocket", "redis", "fanout", "consistency"],
    prompt:
      "Design a real-time chat application like WhatsApp or Slack. Support 1:1 and group messaging with delivery receipts.",
    keyChallenge:
      "Message fanout for groups is the same fan-out problem as Twitter. Consistency across nodes requires shared state — Redis pub/sub for WS fan-out.",
    rubric: [
      "Connection model (WebSocket gateways)",
      "Message persistence + delivery receipts",
      "Group fan-out approach",
      "Online presence strategy",
      "Idempotency / ordering considerations",
    ],
  },
  {
    id: "web-crawler",
    title: "Web Crawler",
    difficulty: "medium",
    durationMins: 45,
    tags: ["queue", "deduplication", "rate limiting", "politeness"],
    prompt:
      "Design a scalable web crawler. The system must discover and index billions of web pages while being polite to target servers.",
    keyChallenge:
      "URL frontier (queue) is the core — prioritise by page rank and freshness. Per-domain rate limiting to be a polite crawler.",
    rubric: [
      "URL frontier / queue design",
      "Deduplication of URLs",
      "Per-domain politeness / rate limits",
      "Storage for crawled content + metadata",
      "Priority / freshness strategy",
    ],
  },
  {
    id: "search-autocomplete",
    title: "Search Autocomplete (Typeahead)",
    difficulty: "medium",
    durationMins: 30,
    tags: ["trie", "redis", "ranking", "latency"],
    prompt:
      "Design a search autocomplete system like Google's typeahead. Results must appear within 100ms as the user types.",
    keyChallenge:
      "Batch update top-k counts every few minutes, not on every search. New trending queries surface within minutes.",
    rubric: [
      "Sub-100ms latency path (cache / trie / prefix index)",
      "Ranking / popularity signals",
      "Offline or batched update pipeline",
      "Personalization vs global top-k trade-off",
      "Cache invalidation for trending queries",
    ],
  },
  {
    id: "notification-system",
    title: "Notification System",
    difficulty: "medium",
    durationMins: 45,
    tags: ["push", "email", "sms", "queue", "dlq"],
    prompt:
      "Design a notification system that sends 10M+ notifications per day across push, email, and SMS channels.",
    keyChallenge:
      "Priority queues for time-sensitive notifications. DLQ for retries. Notifications during quiet hours must be rescheduled, not dropped.",
    rubric: [
      "Multi-channel fan-out (push / email / SMS)",
      "Queue + worker architecture",
      "Retries and DLQ",
      "User preferences / quiet hours",
      "Idempotency to avoid duplicate sends",
    ],
  },
  {
    id: "leaderboard",
    title: "Real-Time Leaderboard",
    difficulty: "medium",
    durationMins: 30,
    tags: ["redis", "sorted set", "ranking", "latency"],
    prompt:
      "Design a real-time global leaderboard for a gaming platform. Top 100 scores must be served in under 50ms.",
    keyChallenge:
      "Top 100 global leaderboard in < 50ms. Redis sorted sets are the canonical solution.",
    rubric: [
      "Chose sorted-set / equivalent for top-K",
      "Sub-50ms read path",
      "Write path for score updates",
      "Sharding if global set is too large",
      "Tie-breaking / update frequency",
    ],
  },
  {
    id: "pastebin",
    title: "Code / Text Sharing (Pastebin)",
    difficulty: "easy",
    durationMins: 20,
    tags: ["storage", "cdn", "key-value", "expiry"],
    prompt:
      "Design a code/text sharing service like Pastebin. Users can paste text up to 10MB and share a link. Pastes may expire.",
    keyChallenge:
      "Object storage for paste content, relational DB for metadata. CDN or cache for popular pastes. Read heavy — cache popular pastes.",
    rubric: [
      "Metadata DB vs blob/object storage split",
      "Short ID generation",
      "Expiry / TTL handling",
      "Caching for popular pastes",
      "Size limits and abuse considerations",
    ],
  },
  {
    id: "file-storage",
    title: "File Storage (Google Drive)",
    difficulty: "hard",
    durationMins: 60,
    tags: ["s3", "deduplication", "multipart", "sync"],
    prompt:
      "Design a file storage and sync service like Google Drive or Dropbox. Files up to 50GB. Multi-device sync.",
    keyChallenge:
      "Metadata service (DB) separate from blob store (S3-like). Block deduplication. Multipart upload. Upload URL → object store directly, not through app server.",
    rubric: [
      "Direct-to-object-store uploads (presigned URLs)",
      "Metadata service separate from blobs",
      "Multipart / resumable uploads for large files",
      "Sync / conflict strategy across devices",
      "Deduplication or block-level storage notes",
    ],
  },
  {
    id: "distributed-cache",
    title: "Distributed Cache",
    difficulty: "medium",
    durationMins: 45,
    tags: ["consistent hashing", "eviction", "replication"],
    prompt:
      "Design a distributed in-memory cache like Memcached or Redis cluster. Must support millions of requests per second.",
    keyChallenge:
      "Consistent hashing minimises cache invalidation on node add/remove. Cache stampede prevention (lock / PER algorithm).",
    rubric: [
      "Consistent hashing / key distribution",
      "Eviction policy (LRU etc.)",
      "Replication vs pure cache trade-off",
      "Stampede / thundering herd mitigation",
      "Node failure and rebalance behavior",
    ],
  },
  {
    id: "rate-limiter",
    title: "Rate Limiter",
    difficulty: "medium",
    durationMins: 30,
    tags: ["token bucket", "sliding window", "redis", "distributed"],
    prompt:
      "Design a distributed rate limiter that enforces per-user and per-IP request limits across a fleet of API servers.",
    keyChallenge:
      "Token bucket vs sliding window. Redis atomic increment. Distributed consistency without a hot key bottleneck.",
    rubric: [
      "Algorithm choice (token bucket / sliding window) with rationale",
      "Central store for counters (e.g. Redis)",
      "Per-user and per-IP dimensions",
      "Atomic increment / race safety",
      "Hot-key or shard considerations",
    ],
  },
  {
    id: "task-scheduler",
    title: "Task Scheduler / Cron",
    difficulty: "medium",
    durationMins: 30,
    tags: ["distributed lock", "cron", "queue", "idempotency"],
    prompt:
      "Design a distributed task scheduler that fires jobs at scheduled times across thousands of tasks.",
    keyChallenge:
      "Distributed lock on scheduler prevents duplicate runs. Idempotency key on each task execution.",
    rubric: [
      "How jobs are stored and polled/triggered",
      "Distributed lock to avoid double-fire",
      "Worker execution via queue",
      "Idempotent task handlers",
      "Missed-run / catch-up policy",
    ],
  },
  {
    id: "payment-system",
    title: "Payment System",
    difficulty: "hard",
    durationMins: 60,
    tags: ["idempotency", "circuit breaker", "settlement", "consistency"],
    prompt:
      "Design a payment processing system. Handle card charges, refunds, and daily settlement. Must be exactly-once.",
    keyChallenge:
      "Idempotency keys prevent double charges on retry. Acquirer circuit breaker. Settlement reconciliation. Hold seats for checkout window (e.g. 10 minutes) then release.",
    rubric: [
      "Idempotency keys on charge APIs",
      "Ledger / transaction state machine",
      "Retries with circuit breaker to acquirer",
      "Refunds and reconciliation",
      "Exactly-once / at-least-once trade-offs explained",
    ],
  },
  {
    id: "open-canvas",
    title: "Open Canvas",
    difficulty: "easy",
    durationMins: 45,
    tags: ["freeform"],
    prompt:
      "Open canvas — no specific problem constraints. Design any system architecture you want to practice.",
    keyChallenge:
      "Open-ended. Use this to sketch any architecture or practice drawing with the component palette.",
    rubric: [
      "Stated requirements and scale assumptions",
      "Clear request path from client to storage",
      "Called out at least one bottleneck",
      "Mentioned failure / redundancy",
      "Named trade-offs explicitly",
    ],
  },
];

export function getProblem(id: string): InterviewProblem | undefined {
  return INTERVIEW_PROBLEMS.find((p) => p.id === id);
}

export function getProblemsByDifficulty(
  difficulty: "easy" | "medium" | "hard"
): InterviewProblem[] {
  return INTERVIEW_PROBLEMS.filter((p) => p.difficulty === difficulty);
}

export function getProblemsByDuration(
  maxMins: number
): InterviewProblem[] {
  return INTERVIEW_PROBLEMS.filter((p) => p.durationMins <= maxMins);
}
