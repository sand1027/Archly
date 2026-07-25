/**
 * Student Guide content — glossary, category intros, and interactive labs.
 * Every lab includes architectureWhy + per-node roles (shown as an Architecture Notes node).
 */

import type { ComponentCategory } from "@/lib/components-registry";

export interface GlossaryEntry {
  id: string;
  section: "Infrastructure" | "Capacity" | "Patterns" | "Simulation" | "Chaos";
  label: string;
  summary: string;
  detail: string;
  tip?: string;
}

export interface LabStep {
  title: string;
  body: string;
}

export interface LabNodeRole {
  componentId: string;
  role: string;
  whyHere: string;
}

export interface LabQuizQuestion {
  question: string;
  options: string[];
  /** Index into options */
  answer: number;
}

export interface LabDefinition {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  level: "beginner" | "intermediate" | "advanced";
  /** High-level “why this architecture exists” */
  architectureWhy: string;
  /** Short bullet goals for the learner */
  learningGoals: string[];
  /** Component IDs to place left→right */
  nodes: string[];
  /** Edges as [fromIndex, toIndex] into nodes */
  edges: [number, number][];
  /** Per-node role in THIS lab’s architecture */
  nodeRoles: LabNodeRole[];
  /** Text shown on the Architecture Notes node on the canvas */
  architectureNote: string;
  steps: LabStep[];
  tryIt: string;
  /** Optional multiple-choice quiz scored locally in GuidePanel */
  quiz?: LabQuizQuestion[];
}

export const CATEGORY_INTROS: Record<
  ComponentCategory,
  { title: string; blurb: string; why: string }
> = {
  clients: {
    title: "Clients",
    blurb: "Where users enter the system — browsers, mobile apps, or generic clients.",
    why: "They define latency budgets, payload size, and how auth tokens are stored.",
  },
  traffic_edge: {
    title: "Traffic & Edge",
    blurb: "DNS, CDN, load balancers, WAF, and API gateways.",
    why: "They protect origin services and push work closer to users.",
  },
  compute: {
    title: "Compute",
    blurb: "Servers, workers, serverless, auth, search — business logic runners.",
    why: "This is where requests become decisions, writes, and side effects.",
  },
  storage: {
    title: "Storage",
    blurb: "SQL, NoSQL, caches, object stores, search indexes.",
    why: "Data shape + access pattern decide consistency, cost, and scale.",
  },
  messaging: {
    title: "Messaging",
    blurb: "Queues and streams that decouple producers from consumers.",
    why: "Async boundaries absorb spikes and enable independent deploy/scale.",
  },
  observability: {
    title: "Observability",
    blurb: "Logs, metrics, traces, and alerting.",
    why: "Without signals you can’t detect, debug, or meet SLOs.",
  },
  network: {
    title: "Network",
    blurb: "VPCs, firewalls, proxies, and service mesh.",
    why: "Isolation and zero-trust keep blast radius small.",
  },
  ai_agents: {
    title: "AI Agents",
    blurb: "LLM gateways, orchestrators, tools, memory, safety.",
    why: "AI features need cost control, latency budgets, and guardrails.",
  },
  external: {
    title: "External",
    blurb: "Payments, email, webhooks, third-party APIs.",
    why: "Outsource commodity risk (PCI, deliverability) — but plan for their outages.",
  },
};

export const CONFIG_GLOSSARY: GlossaryEntry[] = [
  {
    id: "replicas",
    section: "Infrastructure",
    label: "Replicas",
    summary: "How many identical instances of this node run in parallel.",
    detail:
      "More replicas share traffic and survive single-instance failure. Cap by cost and by how well the service is stateless. Stateful DBs usually need careful replication, not just “more copies”.",
    tip: "Start at 2–3 for critical stateless services; scale with load tests.",
  },
  {
    id: "cpuCores",
    section: "Infrastructure",
    label: "CPU cores",
    summary: "Compute capacity available to each instance.",
    detail:
      "CPU-bound work (compression, JSON, crypto, ML inference) benefits from more cores. I/O-bound APIs often wait on network/DB and need fewer cores but more replicas.",
    tip: "If CPU sits high while RPS is fine, you are compute-bound — add cores or optimize code.",
  },
  {
    id: "cpuGhz",
    section: "Infrastructure",
    label: "CPU GHz",
    summary: "Clock speed per core — single-thread performance.",
    detail:
      "Helps latency-sensitive single-threaded paths. Most distributed systems scale with cores/replicas more than GHz.",
  },
  {
    id: "ramGb",
    section: "Infrastructure",
    label: "RAM (GB)",
    summary: "Memory for caches, buffers, connection pools, and working sets.",
    detail:
      "Caches and in-memory stores need RAM for hit rate. App servers need enough to avoid GC thrash / OOM kills.",
    tip: "OOM crashes look like random restarts — raise RAM or lower memory use.",
  },
  {
    id: "diskIops",
    section: "Infrastructure",
    label: "Disk read / write IOPS",
    summary: "How fast the disk can do random I/O.",
    detail:
      "Databases and search indexes are IOPS hungry. Low IOPS → high p99 latency under write load. Prefer SSDs for hot data.",
  },
  {
    id: "networkGbps",
    section: "Infrastructure",
    label: "Network (Gbps)",
    summary: "Bandwidth between this node and others.",
    detail:
      "Matters for media, large payloads, and bulk replication. Most JSON APIs are latency/connection limited first.",
  },
  {
    id: "autoScale",
    section: "Infrastructure",
    label: "Auto-scale",
    summary: "Whether the platform adds/removes replicas automatically.",
    detail:
      "disabled = fixed size. enabled = scale on CPU/RPS. aggressive = reacts faster (good for spiky traffic, can thrash).",
    tip: "Always set a max replica cap in real systems to control cost.",
  },
  {
    id: "rpsCapacity",
    section: "Capacity",
    label: "RPS capacity",
    summary: "Rough requests-per-second one instance can handle.",
    detail:
      "Capacity planning: required replicas ≈ peak RPS / (RPS capacity × safety factor). Measure with load tests.",
  },
  {
    id: "serviceLatencyMs",
    section: "Capacity",
    label: "Service latency (ms)",
    summary: "Base processing time inside this node (excluding network hops).",
    detail:
      "End-to-end latency ≈ sum of hop latencies + queueing. Slow nodes become bottlenecks when traffic rises.",
  },
  {
    id: "inspection",
    section: "Capacity",
    label: "Inspection",
    summary: "How deeply traffic is inspected (WAF / gateway style).",
    detail:
      "none = fast path. basic = common checks. full = deep inspection (more CPU, more latency, more security).",
  },
  {
    id: "cacheStrategy",
    section: "Patterns",
    label: "Cache strategy",
    summary: "How reads/writes interact with a cache.",
    detail:
      "none = always hit source. cache-aside = app reads cache, fills on miss. write-through = write cache + DB together. write-behind = write cache, flush DB async (faster, riskier).",
    tip: "Cache-aside is the most common starting point for read-heavy APIs.",
  },
  {
    id: "retryPolicy",
    section: "Patterns",
    label: "Retry policy",
    summary: "How failed calls are retried.",
    detail:
      "none = fail fast. fixed = retry every N ms. exponential = backoff (1s, 2s, 4s…). Always combine with timeouts and idempotency.",
    tip: "Retries without backoff can amplify outages (retry storms).",
  },
  {
    id: "circuitBreaker",
    section: "Patterns",
    label: "Circuit breaker",
    summary: "Stops calling a failing dependency after too many errors.",
    detail:
      "When open, fail fast instead of waiting on timeouts. Protects your service and gives the dependency time to recover.",
  },
  {
    id: "timeout",
    section: "Patterns",
    label: "Timeout (ms)",
    summary: "Max wait before aborting a call.",
    detail:
      "Prevents threads/connections from hanging forever. Set slightly above expected p99, not the happy-path average.",
  },
  {
    id: "trafficMultiplier",
    section: "Simulation",
    label: "Traffic multiplier",
    summary: "Scales simulated request volume (0.1×–5×).",
    detail:
      "Use it to stress the design. Watch bottlenecks and error rates climb as traffic rises.",
  },
  {
    id: "bottleneck",
    section: "Simulation",
    label: "Bottleneck",
    summary: "The node limiting overall throughput.",
    detail:
      "Usually highest latency, saturated CPU, or lowest RPS headroom. Fix the bottleneck before optimizing other hops.",
  },
  {
    id: "chaos-crash",
    section: "Chaos",
    label: "Crash",
    summary: "Kill the node — RPS drops, errors spike.",
    detail: "Models OOM, instance failure, deploy crash. Ask: is there redundancy? Do clients retry safely?",
  },
  {
    id: "chaos-slow",
    section: "Chaos",
    label: "Slow",
    summary: "Inject latency into a node.",
    detail: "Models GC pauses, slow disks, noisy neighbors. Watch timeouts and cascading delays.",
  },
  {
    id: "chaos-surge",
    section: "Chaos",
    label: "Surge",
    summary: "Traffic spike (e.g. ×10).",
    detail: "Models flash sales / viral load. Check autoscaling, queues, and rate limits.",
  },
];

export const GUIDE_LABS: LabDefinition[] = [
  {
    id: "request-path",
    title: "Basic request path",
    subtitle: "Client → API Gateway → App Server → SQL DB",
    duration: "5 min",
    level: "beginner",
    architectureWhy:
      "This is the default shape of almost every CRUD API: a client talks to a front door (gateway), which forwards to app logic, which persists in a relational database. Learn this before adding caches, queues, or microservices.",
    learningGoals: [
      "Trace a request hop-by-hop",
      "Explain why the gateway sits in front of app servers",
      "Spot the DB as a common bottleneck under load",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "sql_db"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Entry point",
        whyHere: "Represents the user — starts HTTPS requests and waits for responses.",
      },
      {
        componentId: "api_gateway",
        role: "Front door",
        whyHere: "Auth, rate limits, and routing so app servers stay focused on business logic.",
      },
      {
        componentId: "app_server",
        role: "Business logic",
        whyHere: "Validates input, enforces rules, orchestrates DB reads/writes.",
      },
      {
        componentId: "sql_db",
        role: "Source of truth",
        whyHere: "Durable ACID storage for core entities (users, orders, etc.).",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Basic request path\n\nWhy: simplest production web API shape.\nFlow: Browser → Gateway → App → SQL.\n\nWatch for: DB becoming the bottleneck as traffic rises.\nInterview line: “Stateless app tier + durable relational store.”",
    steps: [
      {
        title: "See the happy path",
        body: "Follow left→right: every user request enters at the browser, passes the gateway, hits app logic, then reads/writes SQL.",
      },
      {
        title: "Why a gateway?",
        body: "Without it, every app server must re-implement auth, throttling, and TLS termination. Gateway centralizes the cross-cutting concerns.",
      },
      {
        title: "Try simulation",
        body: "Press Play. Raise traffic and watch which hop saturates first — usually SQL if queries aren’t indexed/cached.",
      },
    ],
    tryIt: "Start simulation, raise traffic to 3×. Which node becomes the bottleneck, and why?",
    quiz: [
      {
        question: "What is the usual role of the API gateway in this path?",
        options: [
          "Store durable user data",
          "Centralize auth, rate limits, and routing",
          "Replace the database",
          "Render the browser UI",
        ],
        answer: 1,
      },
      {
        question: "Under rising traffic, which hop often saturates first?",
        options: ["CDN only", "The SQL database", "DNS", "The browser"],
        answer: 1,
      },
    ],
  },
  {
    id: "caching",
    title: "Add a cache",
    subtitle: "Client → Gateway → App → Cache + SQL",
    duration: "7 min",
    level: "beginner",
    architectureWhy:
      "Most products are read-heavy. A cache sits beside the DB so hot keys return in sub-milliseconds and the database survives peak load. The app still owns correctness — cache is an optimization layer.",
    learningGoals: [
      "Explain cache-aside vs hitting SQL every time",
      "Know what happens on cache miss",
      "Name staleness / TTL trade-offs",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "cache", "sql_db"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Entry point",
        whyHere: "Same client path — latency budget is what caching protects.",
      },
      {
        componentId: "api_gateway",
        role: "Front door",
        whyHere: "Still terminates TLS / auth before app tier.",
      },
      {
        componentId: "app_server",
        role: "Cache orchestrator",
        whyHere: "Implements cache-aside: check cache → on miss load SQL → fill cache.",
      },
      {
        componentId: "cache",
        role: "Hot-key store",
        whyHere: "In-memory speed for repeated reads; not the source of truth.",
      },
      {
        componentId: "sql_db",
        role: "Source of truth",
        whyHere: "Authoritative durable data when cache misses or on writes.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Caching layer\n\nWhy: cut read latency + shield SQL from hot keys.\nPattern: cache-aside (app owns fill/invalidate).\n\nTrade-off: possible stale reads → use TTL + invalidation.\nInterview line: “Cache is optional for correctness, required for scale.”",
    steps: [
      {
        title: "Why cache?",
        body: "If 80% of reads hit the same keys, SQL burns CPU on identical queries. Cache those keys in memory.",
      },
      {
        title: "Cache-aside pattern",
        body: "App checks Cache first. Miss → SQL → populate Cache. Open Properties → Patterns → Cache strategy.",
      },
      {
        title: "Trade-offs",
        body: "Stale data is the cost of speed. Pick TTLs; invalidate on writes for critical fields.",
      },
    ],
    tryIt: "Select App Server → set Cache strategy to cache-aside. When would write-through be better?",
  },
  {
    id: "crash-chaos",
    title: "Survive a crash",
    subtitle: "Cache failure vs app failure",
    duration: "6 min",
    level: "intermediate",
    architectureWhy:
      "Resilience is a first-class design goal. By making the cache optional, the system can degrade (slower) instead of dying when Redis crashes. Crashing the app tier is far worse — that’s why we replicate app servers.",
    learningGoals: [
      "Distinguish dependency failure vs core-path failure",
      "Practice injecting chaos and reading metrics",
      "Argue for graceful degradation",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "cache", "sql_db"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Observes errors/latency",
        whyHere: "User experience is the scoreboard for chaos experiments.",
      },
      {
        componentId: "api_gateway",
        role: "Failure boundary",
        whyHere: "Can rate-limit retries and return fast errors when backends die.",
      },
      {
        componentId: "app_server",
        role: "Degradation logic",
        whyHere: "Should fall back to SQL if Cache is down — not fail the request.",
      },
      {
        componentId: "cache",
        role: "Optional dependency",
        whyHere: "Crash this first — system should slow down, not brick.",
      },
      {
        componentId: "sql_db",
        role: "Fallback source of truth",
        whyHere: "Keeps serving correct data when cache is unavailable.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Failure modes\n\nWhy: learn blast radius.\nCrash Cache → degrade to SQL (slower, still correct).\nCrash App → user-facing outage (replicate + LB).\n\nInterview line: “Caches are performance, not correctness — unless you designed them to be.”",
    steps: [
      {
        title: "Run the baseline",
        body: "Load the lab and start simulation so you see healthy traffic first.",
      },
      {
        title: "Inject Crash on Cache",
        body: "Chaos panel, Chat (“crash Cache”), or Properties → Chaos. Watch errors and fallback pressure on SQL.",
      },
      {
        title: "Compare to app crash",
        body: "Clear chaos, then crash App Server. Notice how much worse that is — argue for replicas + load balancer next.",
      },
    ],
    tryIt: "Crash Cache, then crash App Server. Which failure is more catastrophic, and how would you harden each?",
  },
  {
    id: "async-queue",
    title: "Async with a queue",
    subtitle: "API → Queue → Worker → Email",
    duration: "8 min",
    level: "intermediate",
    architectureWhy:
      "User-facing requests should not wait on slow side effects (email, image processing, webhooks). The API enqueues work; workers process it asynchronously with retries.",
    learningGoals: [
      "Separate sync path from async path",
      "Explain at-least-once delivery",
      "Know why workers must be idempotent",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "message_queue", "worker", "email"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Triggers the action",
        whyHere: "User clicks “sign up” — expects a fast 200, not a 8s email send.",
      },
      {
        componentId: "api_gateway",
        role: "Front door",
        whyHere: "Same auth/rate-limit entry as sync APIs.",
      },
      {
        componentId: "app_server",
        role: "Producer",
        whyHere: "Writes the durable intent (user row) then enqueues “send welcome email”.",
      },
      {
        componentId: "message_queue",
        role: "Buffer",
        whyHere: "Absorbs spikes; retries if workers are down.",
      },
      {
        componentId: "worker",
        role: "Consumer",
        whyHere: "Pulls jobs, calls email provider, acks on success.",
      },
      {
        componentId: "email",
        role: "External side effect",
        whyHere: "Third-party deliverability — expect latency and transient failures.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Async side effects\n\nWhy: keep HTTP fast; do slow work later.\nSync: Browser → Gateway → App (write DB).\nAsync: App → Queue → Worker → Email.\n\nMust-haves: idempotent workers, DLQ, timeouts.\nInterview line: “Enqueue then respond — never block on email.”",
    steps: [
      {
        title: "Sync vs async",
        body: "The left side answers the user quickly. The right side does work that can fail/retry without holding the HTTP connection.",
      },
      {
        title: "Why a queue?",
        body: "If SendGrid is slow, the queue buffers jobs. Workers scale independently from the API tier.",
      },
      {
        title: "Failure thinking",
        body: "Assume at-least-once delivery: the same email job might run twice → use idempotency keys.",
      },
    ],
    tryIt: "If the email provider is down for 10 minutes, what happens to user signup? What happens to the queue depth?",
  },
  {
    id: "edge-cdn",
    title: "Edge + origin",
    subtitle: "Browser → CDN → Gateway → App → Object Store",
    duration: "7 min",
    level: "intermediate",
    architectureWhy:
      "Global users shouldn’t pull every static byte from your origin. A CDN caches assets near the user; the origin serves dynamic API traffic and uploads land in object storage.",
    learningGoals: [
      "Separate static vs dynamic paths",
      "Explain origin offload",
      "Know when CDN caching is unsafe",
    ],
    nodes: ["web_browser", "cdn", "api_gateway", "app_server", "object_store"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Loads assets + API",
        whyHere: "HTML/JS from CDN; JSON from API path.",
      },
      {
        componentId: "cdn",
        role: "Edge cache",
        whyHere: "Serves JS/CSS/images from PoPs worldwide — huge latency win.",
      },
      {
        componentId: "api_gateway",
        role: "Dynamic front door",
        whyHere: "API calls still need auth and routing to origin.",
      },
      {
        componentId: "app_server",
        role: "Origin logic",
        whyHere: "Generates personalized responses; issues upload URLs.",
      },
      {
        componentId: "object_store",
        role: "Blob storage",
        whyHere: "Durable files; often paired with CDN for public reads.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — CDN + origin\n\nWhy: put bytes close to users; keep origin for dynamic work.\nStatic: Browser → CDN (→ Object Store).\nDynamic: Browser → CDN/Gateway → App.\n\nCaution: don’t cache private/personalized JSON without keys.\nInterview line: “CDN for static, origin for personalized.”",
    steps: [
      {
        title: "Two paths",
        body: "Static assets should rarely hit your app servers. Dynamic API calls should.",
      },
      {
        title: "Object store role",
        body: "Uploads go to object storage (often via presigned URLs). CDN can sit in front for public reads.",
      },
      {
        title: "Cache safety",
        body: "Ask: is this response the same for every user? If not, skip CDN cache or vary by key.",
      },
    ],
    tryIt: "List three things you would cache at the CDN and two you would never cache.",
  },
  {
    id: "observe",
    title: "See production",
    subtitle: "App + Metrics + Logs + Tracing + Alerting",
    duration: "6 min",
    level: "beginner",
    architectureWhy:
      "Shipping features without observability is flying blind. Metrics tell you something is wrong, traces tell you where, logs tell you why, alerts wake a human.",
    learningGoals: [
      "Map golden signals to components",
      "Explain metrics vs logs vs traces",
      "Tie alerts to user impact",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "metrics", "logs", "tracing", "alerting"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 6],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "User experience",
        whyHere: "SLOs are about what users feel — latency and errors here matter most.",
      },
      {
        componentId: "api_gateway",
        role: "Edge telemetry",
        whyHere: "Great place for request counts, auth failures, and regional latency.",
      },
      {
        componentId: "app_server",
        role: "Instrumented service",
        whyHere: "Emits metrics/logs/spans for each request.",
      },
      {
        componentId: "metrics",
        role: "Golden signals",
        whyHere: "RPS, latency, errors, saturation — dashboard + alert inputs.",
      },
      {
        componentId: "logs",
        role: "Detail",
        whyHere: "Per-request debugging with correlation IDs.",
      },
      {
        componentId: "tracing",
        role: "Cross-service view",
        whyHere: "Shows which hop burned the time budget.",
      },
      {
        componentId: "alerting",
        role: "Human loop",
        whyHere: "Pages on-call when SLOs burn — not on every CPU blip.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Observability stack\n\nWhy: detect → locate → diagnose → wake a human.\nMetrics = what/how bad. Traces = where. Logs = why.\nAlerts = based on SLOs, not vanity graphs.\n\nInterview line: “RED metrics + distributed tracing + structured logs.”",
    steps: [
      {
        title: "Three pillars",
        body: "Metrics for trends, traces for path latency, logs for forensics. You usually need all three.",
      },
      {
        title: "Alert wisely",
        body: "Alert on error rate / latency SLO burn — not “CPU > 70%” alone.",
      },
      {
        title: "Correlation",
        body: "Propagate a request/trace ID from gateway through app so logs and spans stitch together.",
      },
    ],
    tryIt: "If p99 latency doubles but error rate is flat, which tool do you open first — metrics, traces, or logs — and why?",
    quiz: [
      {
        question: "Which signal best answers “where did the time go?” across services?",
        options: ["Metrics dashboards", "Distributed traces", "CPU alerts alone", "Disk IOPS"],
        answer: 1,
      },
      {
        question: "What should on-call alerts primarily track?",
        options: ["Vanity CPU graphs", "SLO burn / user impact", "Every deploy", "Cache hit rate only"],
        answer: 1,
      },
    ],
  },
  {
    id: "read-replicas",
    title: "Scale reads with replicas",
    subtitle: "App → Primary SQL + Read Replica",
    duration: "8 min",
    level: "intermediate",
    architectureWhy:
      "When reads dominate, a single primary DB becomes the bottleneck. Read replicas serve SELECT traffic while the primary owns writes. You trade a bit of replication lag for horizontal read scale.",
    learningGoals: [
      "Separate write path from read path",
      "Name replication lag as the main trade-off",
      "Know when not to read from a replica",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "sql_db", "sql_db"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Entry point",
        whyHere: "User traffic — mostly reads for feeds/lists.",
      },
      {
        componentId: "api_gateway",
        role: "Front door",
        whyHere: "Auth and routing before the app tier.",
      },
      {
        componentId: "app_server",
        role: "Routing logic",
        whyHere: "Sends writes to primary, reads to replica (with lag-aware exceptions).",
      },
      {
        componentId: "sql_db",
        role: "Primary (writes)",
        whyHere: "Source of truth for INSERT/UPDATE/DELETE.",
      },
      {
        componentId: "sql_db",
        role: "Read replica",
        whyHere: "Serves SELECTs; may lag behind primary by milliseconds–seconds.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Read replicas\n\nWhy: scale reads without sharding yet.\nWrites → Primary. Reads → Replica.\n\nWatch: replication lag after a write — don’t read-your-writes from a stale replica.\nInterview line: “Replica for throughput; primary for consistency.”",
    steps: [
      {
        title: "Two DB roles",
        body: "Same SQL engine, different jobs: primary takes writes; replica mirrors and serves reads.",
      },
      {
        title: "App routing",
        body: "Connection pools / ORMs often expose read vs write endpoints. Route carefully after writes.",
      },
      {
        title: "Lag cases",
        body: "After creating an account, read-your-write should hit the primary (or wait for lag).",
      },
    ],
    tryIt: "Raise traffic in simulation. Which DB node saturates first if everything still hits the primary?",
    quiz: [
      {
        question: "Where should INSERT/UPDATE traffic go?",
        options: ["Any replica", "The primary only", "CDN", "Message queue"],
        answer: 1,
      },
      {
        question: "Main downside of serving reads from a replica?",
        options: ["Higher disk cost only", "Replication lag / stale reads", "No indexes", "No TLS"],
        answer: 1,
      },
    ],
  },
  {
    id: "rate-limit-waf",
    title: "Protect the edge",
    subtitle: "Browser → WAF → Gateway → App",
    duration: "7 min",
    level: "intermediate",
    architectureWhy:
      "Public APIs attract bots, scrapers, and abusive clients. A WAF and rate limits at the edge drop bad traffic before it burns app CPU or DB connections.",
    learningGoals: [
      "Explain defense-in-depth at the edge",
      "Distinguish WAF rules vs application rate limits",
      "Argue why origin should still validate input",
    ],
    nodes: ["web_browser", "waf", "api_gateway", "app_server", "sql_db"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Client (good + bad)",
        whyHere: "Includes legitimate users and abusive traffic.",
      },
      {
        componentId: "waf",
        role: "Edge filter",
        whyHere: "Blocks OWASP-style attacks and known bad IPs early.",
      },
      {
        componentId: "api_gateway",
        role: "Auth + throttle",
        whyHere: "Per-user / per-key rate limits and JWT validation.",
      },
      {
        componentId: "app_server",
        role: "Business logic",
        whyHere: "Still validates input — never trust the edge alone.",
      },
      {
        componentId: "sql_db",
        role: "Source of truth",
        whyHere: "Protected by upstream throttles from connection storms.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — Edge protection\n\nWhy: drop abuse before origin cost.\nFlow: Browser → WAF → Gateway (rate limit) → App → SQL.\n\nInterview line: “WAF for patterns, gateway for quotas, app for correctness.”",
    steps: [
      {
        title: "Layers",
        body: "WAF looks at request shape/signatures. Gateway enforces auth + quotas. App still validates.",
      },
      {
        title: "Rate limits",
        body: "Pick keys carefully (user id, API key, IP). Too coarse → punish shared NATs; too fine → easy to bypass.",
      },
      {
        title: "Chaos thinking",
        body: "Simulate a surge. Without limits, app and SQL die together — with limits, you shed load gracefully.",
      },
    ],
    tryIt: "Inject a traffic surge. How would you tune gateway rate limits vs scaling app replicas?",
    quiz: [
      {
        question: "Best place for per-API-key quotas?",
        options: ["Only inside SQL triggers", "API gateway / edge", "CDN static cache", "Object store"],
        answer: 1,
      },
      {
        question: "Why keep validation in the app if WAF exists?",
        options: [
          "WAF is enough alone",
          "Defense in depth — WAF rules miss business cases",
          "Apps should ignore auth",
          "SQL should parse HTTP",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "llm-gateway",
    title: "Safe LLM feature",
    subtitle: "App → LLM Gateway → Model + Memory",
    duration: "9 min",
    level: "advanced",
    architectureWhy:
      "AI features need cost control, latency budgets, and safety. An LLM gateway centralizes auth, rate limits, prompt logging, and model routing; memory stores conversation context separately from the model.",
    learningGoals: [
      "Place a gateway in front of model calls",
      "Separate durable memory from ephemeral prompts",
      "Name cost, latency, and safety as first-class constraints",
    ],
    nodes: ["web_browser", "api_gateway", "app_server", "llm_gateway", "vector_db"],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
    nodeRoles: [
      {
        componentId: "web_browser",
        role: "Chat UI",
        whyHere: "User sends prompts and expects streaming replies.",
      },
      {
        componentId: "api_gateway",
        role: "Product front door",
        whyHere: "Auth the user before any expensive model spend.",
      },
      {
        componentId: "app_server",
        role: "Orchestrator",
        whyHere: "Builds prompts, retrieves memory, enforces product rules.",
      },
      {
        componentId: "llm_gateway",
        role: "Model front door",
        whyHere: "Quotas, caching, provider failover, safety filters.",
      },
      {
        componentId: "vector_db",
        role: "Memory / RAG store",
        whyHere: "Embeddings for retrieval — not the model weights.",
      },
    ],
    architectureNote:
      "ARCHITECTURE — LLM feature path\n\nWhy: control cost + safety of model calls.\nUser → Gateway → App → (Vector memory + LLM gateway).\n\nInterview line: “Never call the model from the browser with a secret key.”",
    steps: [
      {
        title: "Never expose keys",
        body: "Browser talks to your API. Your backend (via LLM gateway) holds provider credentials.",
      },
      {
        title: "Memory vs model",
        body: "Vector DB holds embeddings/docs. The model is stateless per call unless you send history.",
      },
      {
        title: "Budgets",
        body: "Cap tokens, cache identical prompts, and fail soft when the provider is down.",
      },
    ],
    tryIt: "If the model provider times out, what does the user see, and where do you put retries?",
    quiz: [
      {
        question: "Where should the LLM API key live?",
        options: [
          "In the browser localStorage",
          "Only on the server / LLM gateway",
          "In the CDN config as a public header",
          "Inside the vector DB documents",
        ],
        answer: 1,
      },
      {
        question: "Primary job of an LLM gateway?",
        options: [
          "Replace the app server",
          "Centralize quotas, routing, and safety for model calls",
          "Store user passwords",
          "Serve static JS",
        ],
        answer: 1,
      },
    ],
  },
];
