/**
 * Per-node learning cards: why used, when to use, when to avoid.
 * Covers common system-design building blocks; others get category defaults.
 */

import {
  getComponent,
  type ComponentCategory,
  type ComponentDefinition,
} from "@/lib/components-registry";

export interface NodeLesson {
  why: string;
  when: string;
  avoid: string;
  pairsWith: string[];
  interviewTip: string;
}

const CATEGORY_DEFAULTS: Record<
  ComponentCategory,
  Omit<NodeLesson, "pairsWith"> & { pairsWith: string[] }
> = {
  clients: {
    why: "Clients are where users start — they define the request shape and latency budget.",
    when: "Every user-facing system needs at least one client type.",
    avoid: "Don’t model internal service-to-service calls as clients.",
    pairsWith: ["api_gateway", "cdn", "load_balancer"],
    interviewTip: "Clarify mobile vs web — they differ in offline, auth, and payload size.",
  },
  traffic_edge: {
    why: "Edge/traffic layers absorb abuse, route efficiently, and keep origin load down.",
    when: "Public internet traffic, multi-region users, or high read fan-out.",
    avoid: "Don’t put edge components inside a private VPC-only service mesh.",
    pairsWith: ["web_browser", "api_gateway", "app_server"],
    interviewTip: "Explain what is cached at the edge vs what must hit origin.",
  },
  compute: {
    why: "Compute runs business logic — APIs, workers, auth, search, jobs.",
    when: "You need to transform requests, enforce rules, or run async work.",
    avoid: "Don’t put heavy compute on the client for sensitive/trusted logic.",
    pairsWith: ["sql_db", "cache", "message_queue"],
    interviewTip: "Separate sync request path from async workers early.",
  },
  storage: {
    why: "Storage persists state. Choice depends on access pattern and consistency.",
    when: "You need durable or fast temporary data (DB, cache, objects, vectors).",
    avoid: "Don’t use one DB for every workload — OLTP ≠ OLAP ≠ cache.",
    pairsWith: ["app_server", "worker", "cdn"],
    interviewTip: "Say what is strongly consistent vs eventually consistent.",
  },
  messaging: {
    why: "Queues/streams decouple producers from consumers and smooth spikes.",
    when: "Async work, fan-out, buffering, or event-driven architectures.",
    avoid: "Don’t use a queue for request/response latency-critical paths.",
    pairsWith: ["worker", "app_server", "notifications"],
    interviewTip: "Mention at-least-once delivery and idempotent consumers.",
  },
  observability: {
    why: "You can’t operate what you can’t see — metrics, logs, traces, alerts.",
    when: "Production systems, SLOs, debugging distributed failures.",
    avoid: "Don’t treat logs alone as enough for microservices (need traces).",
    pairsWith: ["app_server", "api_gateway", "alerting"],
    interviewTip: "Tie alerts to user-facing SLOs, not raw CPU alone.",
  },
  network: {
    why: "Network controls isolation, reachability, and zero-trust between services.",
    when: "Multi-tier cloud setups, private subnets, mTLS, service mesh.",
    avoid: "Don’t overdraw network boxes if the interviewer wants app architecture first.",
    pairsWith: ["vpc", "app_server", "sql_db"],
    interviewTip: "Private DB subnet + public/private app tiers is a classic answer.",
  },
  ai_agents: {
    why: "AI components add LLM routing, tools, memory, and safety controls.",
    when: "RAG, agents, or LLM product features with cost/rate limits.",
    avoid: "Don’t call raw LLM APIs from every service without a gateway.",
    pairsWith: ["vector_db", "embedding", "app_server"],
    interviewTip: "Call out latency, cost, and hallucination/safety risks.",
  },
  external: {
    why: "External deps provide payments, email, webhooks — you don’t rebuild them.",
    when: "Commodity capabilities where SaaS is faster/safer.",
    avoid: "Don’t make the critical path depend on an external API without timeouts/fallback.",
    pairsWith: ["app_server", "message_queue", "worker"],
    interviewTip: "Always mention retries, circuit breakers, and provider failure modes.",
  },
};

/** Hand-authored lessons for the nodes students hit most. */
export const NODE_LESSONS: Record<string, NodeLesson> = {
  web_browser: {
    why: "The browser is the most common client — HTML/JS talking over HTTPS to your APIs.",
    when: "Web apps, dashboards, marketing sites that call backends.",
    avoid: "Not for native mobile-specific constraints (push, offline-first).",
    pairsWith: ["cdn", "api_gateway", "waf"],
    interviewTip: "Mention CORS, cookies/JWT storage, and CDN for static assets.",
  },
  mobile: {
    why: "Mobile clients have flaky networks, battery limits, and push notifications.",
    when: "iOS/Android apps with offline or background sync needs.",
    avoid: "Don’t assume the same payload sizes as desktop web.",
    pairsWith: ["api_gateway", "cdn", "notifications"],
    interviewTip: "Talk about exponential backoff and delta sync.",
  },
  client: {
    why: "A generic client stands in for any user-facing entry point.",
    when: "Early sketches before you specialize web vs mobile.",
    avoid: "Replace with a specific client once requirements are clear.",
    pairsWith: ["api_gateway", "load_balancer"],
    interviewTip: "Ask how many concurrent users and peak QPS.",
  },
  dns: {
    why: "DNS maps your domain to IPs (often load balancers / anycast).",
    when: "Any public hostname; multi-region failover via DNS TTL strategies.",
    avoid: "DNS alone is a slow failover mechanism — pair with health checks.",
    pairsWith: ["cdn", "load_balancer", "cloudflare"],
    interviewTip: "Low TTL = faster failover, more DNS traffic.",
  },
  cdn: {
    why: "CDN caches static (and sometimes dynamic) content near users — lower latency, less origin load.",
    when: "Images, JS/CSS, video segments, or edge-cacheable API GETs.",
    avoid: "Personalized/private responses unless carefully cache-keyed.",
    pairsWith: ["object_store", "web_browser", "cloudflare"],
    interviewTip: "Explain cache hit ratio and origin shield.",
  },
  load_balancer: {
    why: "Spreads traffic across healthy app instances so one box isn’t the SPOF.",
    when: "Horizontal scaling of stateless services.",
    avoid: "Sticky sessions unless you must — prefer shared session store.",
    pairsWith: ["app_server", "api_gateway", "health_check"],
    interviewTip: "L4 vs L7 balancing and health-check probes.",
  },
  waf: {
    why: "Blocks common web attacks (SQLi, XSS, bots) before they hit your app.",
    when: "Public internet apps with compliance/security needs.",
    avoid: "WAF isn’t a substitute for secure coding and auth.",
    pairsWith: ["cdn", "api_gateway", "cloudflare"],
    interviewTip: "Mention rate limiting + bot management at the edge.",
  },
  api_gateway: {
    why: "Single front door: auth, rate limits, routing, request shaping for many backends.",
    when: "Multiple microservices or mobile/web clients sharing one API surface.",
    avoid: "Don’t put heavy business logic in the gateway.",
    pairsWith: ["auth_service", "app_server", "load_balancer"],
    interviewTip: "Gateway + service mesh is a common senior-level answer.",
  },
  app_server: {
    why: "Runs your core business logic for synchronous user requests.",
    when: "CRUD APIs, orchestration, authorization checks.",
    avoid: "Don’t do long CPU jobs inline — offload to workers.",
    pairsWith: ["sql_db", "cache", "message_queue"],
    interviewTip: "Keep servers stateless; store sessions in Redis/DB.",
  },
  worker: {
    why: "Processes jobs asynchronously so user requests stay fast.",
    when: "Emails, image processing, webhooks, batch fan-out.",
    avoid: "Don’t use workers for ultra-low-latency user reads.",
    pairsWith: ["message_queue", "notifications", "object_store"],
    interviewTip: "Idempotency keys + dead-letter queues.",
  },
  serverless: {
    why: "Pay-per-use compute that scales to zero — great for spiky or infrequent work.",
    when: "Event handlers, light APIs, cron-like triggers.",
    avoid: "Long-running or ultra-low-latency warm-path APIs (cold starts).",
    pairsWith: ["sqs", "object_store", "api_gateway"],
    interviewTip: "Call out cold start and execution time limits.",
  },
  auth_service: {
    why: "Centralizes login, tokens, and permissions instead of reinventing auth per service.",
    when: "Multi-service products needing SSO, OAuth, JWT.",
    avoid: "Don’t store passwords in every microservice.",
    pairsWith: ["api_gateway", "keycloak", "jwt_validator"],
    interviewTip: "Access token TTL + refresh tokens + revoke strategy.",
  },
  sql_db: {
    why: "Relational DB gives ACID transactions, joins, and strong consistency for core data.",
    when: "Users, orders, payments, relationships that must stay correct.",
    avoid: "Mega-scale write fan-out without sharding — or analytics-heavy scans.",
    pairsWith: ["app_server", "cache", "worker"],
    interviewTip: "Indexes, read replicas, and transaction boundaries.",
  },
  nosql_db: {
    why: "Flexible schemas and easy horizontal scale for high-volume key/document access.",
    when: "Profiles, catalogs, session-like docs with known access keys.",
    avoid: "Complex multi-row transactions / heavy joins.",
    pairsWith: ["app_server", "cdn", "cache"],
    interviewTip: "Model access patterns first, then the document shape.",
  },
  cache: {
    why: "In-memory store for hot keys — cuts DB load and latency dramatically.",
    when: "Read-heavy endpoints, session data, rate-limit counters.",
    avoid: "Source of truth for money/critical writes without a durable store.",
    pairsWith: ["app_server", "sql_db", "load_balancer"],
    interviewTip: "Cache-aside vs write-through; TTL + stampede prevention.",
  },
  object_store: {
    why: "Cheap durable blobs for images, videos, backups, exports.",
    when: "Large files and static assets; not row-level queries.",
    avoid: "Don’t use S3 as a primary transactional database.",
    pairsWith: ["cdn", "worker", "app_server"],
    interviewTip: "Presigned URLs for direct client uploads.",
  },
  message_queue: {
    why: "Buffers work between producers and consumers so spikes don’t melt your DB.",
    when: "Async tasks, retries, decoupling services.",
    avoid: "Request/response with hard latency SLAs.",
    pairsWith: ["worker", "app_server", "notifications"],
    interviewTip: "Visibility timeout, DLQ, and poison messages.",
  },
  kafka: {
    why: "Durable ordered log for high-throughput event streaming and replay.",
    when: "Activity feeds, analytics pipelines, event sourcing, fan-out at scale.",
    avoid: "Simple job queues with a few consumers — SQS/Rabbit is simpler.",
    pairsWith: ["analytics", "worker", "app_server"],
    interviewTip: "Partitions, consumer groups, and retention.",
  },
  pubsub: {
    why: "One publish, many subscribers — great for fan-out notifications/events.",
    when: "Broadcast domain events to many independent consumers.",
    avoid: "When you need competing consumers on a work queue.",
    pairsWith: ["notifications", "analytics", "worker"],
    interviewTip: "Contrast pub/sub vs queue semantics clearly.",
  },
  metrics: {
    why: "Numeric time-series (RPS, latency, errors) for SLOs and dashboards.",
    when: "Always in production — golden signals.",
    avoid: "Metrics without alerts tied to user impact.",
    pairsWith: ["alerting", "app_server", "api_gateway"],
    interviewTip: "RED/USE methods; p99 over averages.",
  },
  logs: {
    why: "Detailed event history for debugging individual requests/failures.",
    when: "Error investigation, audit trails.",
    avoid: "Logging PII; using logs as your only metrics system.",
    pairsWith: ["tracing", "alerting", "app_server"],
    interviewTip: "Structured logs + correlation IDs.",
  },
  tracing: {
    why: "Follows a request across services to find slow/error hops.",
    when: "Microservices / any multi-hop architecture.",
    avoid: "Tracing 100% forever without sampling (cost/noise).",
    pairsWith: ["jaeger", "api_gateway", "app_server"],
    interviewTip: "Trace ID propagation on every hop.",
  },
  vector_db: {
    why: "Stores embeddings for semantic/ANN search (RAG).",
    when: "Similarity search, recommendations, LLM context retrieval.",
    avoid: "Exact relational queries — use SQL for that.",
    pairsWith: ["embedding", "llm_gateway", "app_server"],
    interviewTip: "Chunking strategy + freshness of embeddings.",
  },
  llm_gateway: {
    why: "Centralizes LLM provider routing, rate limits, caching, and cost control.",
    when: "Multiple models/providers or high LLM spend.",
    avoid: "Bypassing the gateway from every microservice.",
    pairsWith: ["orchestrator", "vector_db", "safety_mesh"],
    interviewTip: "Timeouts, fallback models, and prompt injection defenses.",
  },
  payment: {
    why: "PCI-heavy money movement is best left to Stripe/PayPal-class providers.",
    when: "Checkout, subscriptions, payouts.",
    avoid: "Storing raw card data in your DB.",
    pairsWith: ["app_server", "webhook", "sql_db"],
    interviewTip: "Idempotent charges + webhook verification.",
  },
};

export function getNodeLesson(
  componentId: string,
  comp?: ComponentDefinition
): NodeLesson {
  const known = NODE_LESSONS[componentId];
  if (known) return known;
  const c = comp ?? getComponent(componentId);
  if (!c) {
    return {
      why: "A building block in your architecture.",
      when: "When the problem domain needs this capability.",
      avoid: "When a simpler component already covers the need.",
      pairsWith: [],
      interviewTip: "Explain the trade-off vs the next-best alternative.",
    };
  }
  const base = CATEGORY_DEFAULTS[c.category];
  return {
    why: `${c.description} ${base.why}`,
    when: base.when,
    avoid: base.avoid,
    pairsWith: base.pairsWith,
    interviewTip: base.interviewTip,
  };
}
