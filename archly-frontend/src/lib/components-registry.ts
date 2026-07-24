/**
 * Archly component library — 80+ components matching archly.dev exactly.
 * Categories and colors match the real app screenshots.
 *
 * Color scheme by category:
 *   clients      → gray    (#6b7280 / #f3f4f6)
 *   traffic_edge → blue    (#2563eb / #dbeafe)
 *   compute      → green   (#16a34a / #dcfce7)
 *   storage      → purple  (#7c3aed / #f3e8ff)
 *   messaging    → orange  (#d97706 / #fef3c7)
 *   observability→ red     (#dc2626 / #fee2e2)
 *   network      → indigo  (#4f46e5 / #e0e7ff)
 *   ai_agents    → violet  (#7c3aed / #ede9fe)
 *   external     → slate   (#64748b / #f1f5f9)
 */

export type ComponentCategory =
  | "clients"
  | "traffic_edge"
  | "compute"
  | "storage"
  | "messaging"
  | "observability"
  | "network"
  | "ai_agents"
  | "external";

export interface ComponentDefinition {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  color: string;       // fill background
  strokeColor: string; // border / icon color
  icon: string;        // SVG path data (viewBox 0 0 24 24)
  tags: string[];
  defaultWidth: number;
  defaultHeight: number;
}

// ─── SVG icon paths (24×24 viewBox) ────────────────────────────────────────
// Each is a <path d="..."> string for a single-color stroke icon
const ICONS: Record<string, string> = {
  // Clients
  client:       "M4 6h16v10H4V6zm0 10l-2 4h20l-2-4M8 6V4h8v2",
  mobile:       "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 17a1 1 0 100-2 1 1 0 000 2z",
  web_browser:  "M3 5h18v14H3V5zm0 4h18M7 5v4",
  // Traffic & Edge
  dns:          "M4 6h3v12H4V6zm13 0h3v12h-3V6zM4 12h16M9 6h6v12H9V6z",
  cdn:          "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0c-2.5 2.5-4 6-4 10s1.5 7.5 4 10m0-20c2.5 2.5 4 6 4 10s-1.5 7.5-4 10M2 12h20",
  load_balancer:"M12 3v4M12 17v4M4 12H3m18 0h-1M6.3 6.3l-.7-.7m12.8 12.8-.7-.7M6.3 17.7l-.7.7M19.1 6.3l-.7.7M8 12a4 4 0 108 0 4 4 0 00-8 0",
  waf:          "M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4zm0 5v6m0 4h.01",
  api_gateway:  "M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3m8-18h3a2 2 0 012 2v14a2 2 0 01-2 2h-3m-5-3V3m0 18V3m5 6H6m12 6H6",
  ingress:      "M12 16V8m0 8l-3-3m3 3l3-3M3 21h18M3 3h18",
  fastly:       "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  cloudflare:   "M18 10a6 6 0 10-12 0H4a4 4 0 000 8h16a4 4 0 000-8h-2z",
  // Compute
  app_server:   "M4 4h16v12H4V4zm0 8h16M9 20h6M12 16v4",
  worker:       "M12 6a2 2 0 100 4 2 2 0 000-4zm-6 8a6 6 0 1112 0H6zm6-8V4m0 16v-2",
  serverless:   "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  auth_service: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10h.01M12 7v4",
  search:       "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  scheduler:    "M8 2v4m8-4v4M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm5 10h.01M12 14h.01M14 14h.01",
  notifications:"M15 17H5a2 2 0 01-2-2V9a2 2 0 012-2h10m4-1v10m0-10l-4-4m4 4l-4 4M9 21h6",
  analytics:    "M3 3v18h18M7 16l4-4 4 4 4-8",
  nodejs:       "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l7 4.5-7 4.5z",
  python:       "M12 2a5 5 0 00-5 5v2h-2a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2h-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H9V7a3 3 0 013-3z",
  go_service:   "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  cloud_function:"M18 10a6 6 0 10-12 0H4a4 4 0 000 8h16a4 4 0 000-8h-2zm-6-2v6m-3-3h6",
  sidekiq:      "M12 6v6l4 2M12 2a10 10 0 100 20A10 10 0 0012 2z",
  jwt_validator:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  embedding:    "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  temporal:     "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l3 3",
  keycloak:     "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4a3 3 0 110 6 3 3 0 010-6z",
  vault:        "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 7h.01M12 12v4",
  apache_spark: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  dbt:          "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5l5 5-5 5V7z",
  // Storage
  sql_db:       "M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23C7.53 15.56 9.68 16 12 16s4.47-.44 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77C7.53 10.56 9.68 11 12 11s4.47-.44 6-1.23V12z",
  nosql_db:     "M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm-5.09 5.29C8.27 11.7 10.07 12 12 12s3.73-.3 5.09-.71L18 17c0 .5-2.13 2-6 2s-6-1.5-6-2l.91-6.71z",
  cache:        "M3 5h18v4H3V5zm0 6h18v4H3v-4zm0 6h18v2H3v-2z",
  object_store: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  data_warehouse:"M3 3h18v18H3V3zm4 4h10v10H7V7zm2 2v6h6V9H9z",
  vector_db:    "M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  mysql:        "M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zM4 9v3c0 2.21 3.58 4 8 4s8-1.79 8-4V9c0 2.21-3.58 4-8 4S4 11.21 4 9zm0 5v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4s-8-1.79-8-4z",
  cockroachdb:  "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a1 1 0 110 2 1 1 0 010-2zm-4 4a1 1 0 110 2 1 1 0 010-2zm8 0a1 1 0 110 2 1 1 0 010-2zm-4 4a1 1 0 110 2 1 1 0 010-2z",
  dynamodb:     "M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm6 14c0 .5-2.13 2-6 2s-6-1.5-6-2V7c0-.5 2.13-2 6-2s6 1.5 6 2v10z",
  memcached:    "M3 5h18v4H3V5zm0 5h18v4H3v-4zm0 5h18v4H3v-4z",
  gcs:          "M18 10a6 6 0 10-12 0H4a4 4 0 000 8h16a4 4 0 000-8h-2zm-3 3H9m3-3v6",
  pinecone:     "M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7l2-7z",
  weaviate:     "M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5",
  opensearch:   "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0zm-6-2v4m-2-2h4",
  influxdb:     "M3 3v18h18M7 12l3-3 3 3 4-7",
  neo4j:        "M12 5a3 3 0 100 6 3 3 0 000-6zm-7 9a3 3 0 100 6 3 3 0 000-6zm14 0a3 3 0 100 6 3 3 0 000-6zm-7-3l-7 5m14-5l-7 5",
  clickhouse:   "M3 3h4v18H3V3zm6 0h4v18H9V3zm6 6h4v12h-4V9z",
  cassandra:    "M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zM4 12v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4S4 14.21 4 12z",
  scylladb:     "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5l4 5-4 5-4-5 4-5z",
  vitess:       "M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 0v18M4 10h16M4 14h16",
  timescaledb:  "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l3 3",
  dragonfly:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  qdrant:       "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zm-9-9l6 3.46v.08L12 14l-6-3.46v-.08L12 7z",
  milvus:       "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  // Messaging
  message_queue:"M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 4l8 5 8-5",
  pubsub:       "M8 6h8M8 12h8m-4-8v16M4 8l4-4-4-4m12 4l4-4-4-4",
  event_stream: "M3 12h4l3-9 3 18 3-9h5",
  kafka:        "M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83",
  sqs:          "M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm-7 8H7m6-4H7m10 8H7",
  redis_pubsub: "M3 12h4l3-9 3 18 3-9h5m-9-8a3 3 0 100 6",
  nats:         "M12 2a10 10 0 100 20A10 10 0 0012 2zm-4 8l8-4-4 8-8 4 4-8z",
  redpanda:     "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l7 4.5-7 4.5z",
  // Observability
  metrics:      "M3 3v18h18M7 12l3-3 3 3 4-7",
  logs:         "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 0v6h6M8 13h8M8 17h5",
  tracing:      "M3 12c0 0 4-8 9-8s9 8 9 8-4 8-9 8-9-8-9-8zm9-3a3 3 0 100 6 3 3 0 000-6z",
  alerting:     "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01",
  health_check: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78zM9 12l2 2 4-4",
  jaeger:       "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l3 3m-6 2l3-3",
  loki:         "M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  // Network
  vpc:          "M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z",
  subnet:       "M3 3h18v18H3V3zm4 4h10v10H7V7z",
  nat_gateway:  "M4 14h6v-4H4v4zm0 4h6v-2H4v2zm0-8h6V8H4v2zm8 8h8v-2h-8v2zm0-4h8v-2h-8v2zm0-6v2h8V8h-8z",
  vpn:          "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6h.01M12 11v4",
  service_mesh: "M12 5a2 2 0 100 4 2 2 0 000-4zm-7 9a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7 0a2 2 0 100 4 2 2 0 000-4zm-7-9l7 9m14-9l-7 9m0 0l-7 0",
  anycast_lb:   "M12 3v4M12 17v4M4 12H3m18 0h-1m-3.07-6.93-.71-.71m-8.48 8.48-.71-.71m0-8.48-.71.71m12.73 12.73-.71.71M8 12a4 4 0 108 0 4 4 0 00-8 0",
  kong:         "M4 4h4v16H4V4zm12 0h4v16h-4V4zm-6 4h4v8h-4V8z",
  nginx:        "M12 2l9 7-9 13L3 9l9-7zm0 3.5L5.5 10l6.5 9.5 6.5-9.5L12 5.5z",
  haproxy:      "M3 12h4l3-9 3 18 3-9h5",
  envoy:        "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  firewall:     "M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4zm0 5h.01M12 11v4",
  linkerd:      "M12 5a2 2 0 100 4 2 2 0 000-4zm0 10a2 2 0 100 4 2 2 0 000-4zm7-5a2 2 0 100 4 2 2 0 000-4zm-14 0a2 2 0 100 4 2 2 0 000-4zm7-5v5m0 4v5m5-9l-5 4m-5-4l5 4m5 0l-5 4m-5-4l5 4",
  traefik:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  consul:       "M12 2a10 10 0 100 20A10 10 0 0012 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z",
  // AI & Agents
  llm_gateway:  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
  orchestrator: "M12 5a2 2 0 100 4 2 2 0 000-4zm-7 9a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7-4l-7 5m14-5l-7 5",
  tool_registry:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM12 9a3 3 0 100 6 3 3 0 000-6z",
  memory_fabric:"M4 4h16v4H4V4zm0 8h16v4H4v-4zm-1-3h18m0 8H3",
  safety_mesh:  "M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4zm0 8a2 2 0 110 4 2 2 0 010-4z",
  // External
  third_party:  "M12 2a3 3 0 100 6 3 3 0 000-6zM5 8a3 3 0 100 6 3 3 0 000-6zm14 0a3 3 0 100 6 3 3 0 000-6zM5 17h14M12 8v9",
  payment:      "M3 5h18v4H3V5zm0 4h18v10H3V9zm4 4h2m3 0h4",
  email:        "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2l8 5 8-5",
  daily_batch:  "M8 2v4m8-4v4M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm3 10l2 2 4-4",
  cron_trigger: "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l3 3",
  webhook:      "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
};

// ─── Color palette per category ────────────────────────────────────────────
const C = {
  clients:       { fill: "#f3f4f6", stroke: "#6b7280" },
  traffic_edge:  { fill: "#dbeafe", stroke: "#2563eb" },
  compute:       { fill: "#dcfce7", stroke: "#16a34a" },
  storage:       { fill: "#f3e8ff", stroke: "#7c3aed" },
  messaging:     { fill: "#fef3c7", stroke: "#d97706" },
  observability: { fill: "#fee2e2", stroke: "#dc2626" },
  network:       { fill: "#e0e7ff", stroke: "#4f46e5" },
  ai_agents:     { fill: "#ede9fe", stroke: "#6d28d9" },
  external:      { fill: "#f1f5f9", stroke: "#64748b" },
};

function c(cat: ComponentCategory, iconKey: string, name: string, desc: string, tags: string[], w = 140, h = 80): ComponentDefinition {
  return {
    id: iconKey,
    name,
    category: cat,
    description: desc,
    color: C[cat].fill,
    strokeColor: C[cat].stroke,
    icon: ICONS[iconKey] ?? ICONS.app_server,
    tags,
    defaultWidth: w,
    defaultHeight: h,
  };
}

// ─── Component definitions ─────────────────────────────────────────────────
export const COMPONENTS: ComponentDefinition[] = [
  // ── CLIENTS ──
  c("clients", "client",      "Client",      "Generic client (browser, desktop, mobile app).", ["client","user","frontend"], 120, 72),
  c("clients", "mobile",      "Mobile",      "Mobile client — iOS or Android.", ["mobile","app","client"], 120, 72),
  c("clients", "web_browser", "Web Browser", "Browser-based web client.", ["browser","web","client"], 120, 72),

  // ── TRAFFIC & EDGE ──
  c("traffic_edge", "dns",          "DNS",          "Domain Name System — resolves hostnames to IPs.", ["dns","routing"], 130, 72),
  c("traffic_edge", "cdn",          "CDN",          "Content Delivery Network — edge caching at global PoPs.", ["cdn","edge","cache"], 120, 72),
  c("traffic_edge", "load_balancer","Load Balancer","Distributes traffic across backend instances.", ["lb","traffic","scaling"], 140, 72),
  c("traffic_edge", "waf",          "WAF",          "Web Application Firewall — blocks malicious traffic.", ["waf","security","edge"], 120, 72),
  c("traffic_edge", "api_gateway",  "API Gateway",  "Entry point for all API requests — routing, auth, rate limiting.", ["api","gateway","routing"], 140, 72),
  c("traffic_edge", "ingress",      "Ingress",      "Kubernetes ingress controller — routes HTTP into the cluster.", ["ingress","k8s","routing"], 120, 72),
  c("traffic_edge", "fastly",       "Fastly",       "Fastly CDN and edge compute platform.", ["fastly","cdn","edge"], 120, 72),
  c("traffic_edge", "cloudflare",   "Cloudflare",   "Cloudflare CDN, DDoS protection, and edge network.", ["cloudflare","cdn","ddos"], 140, 72),

  // ── COMPUTE ──
  c("compute", "app_server",    "App Server",     "Application server handling business logic.", ["server","backend","compute"], 130, 72),
  c("compute", "worker",        "Worker",         "Background worker — async job processing.", ["worker","async","queue"], 120, 72),
  c("compute", "serverless",    "Serverless",     "Function-as-a-service. Scales to zero, cold starts apply.", ["lambda","serverless","faas"], 130, 72),
  c("compute", "auth_service",  "Auth Service",   "Authentication and authorization service.", ["auth","jwt","oauth"], 130, 72),
  c("compute", "search",        "Search",         "Search service — full-text or vector-based.", ["search","indexing","query"], 120, 72),
  c("compute", "scheduler",     "Scheduler",      "Job scheduler — runs tasks on a cron schedule.", ["cron","scheduler","jobs"], 120, 72),
  c("compute", "notifications", "Notifications",  "Notification service — push, email, SMS dispatch.", ["notifications","push","alerts"], 140, 72),
  c("compute", "analytics",     "Analytics",      "Analytics processing service — events, funnels, reporting.", ["analytics","metrics","events"], 130, 72),
  c("compute", "nodejs",        "Node.js",        "Node.js application server — event-driven, non-blocking I/O.", ["nodejs","js","backend"], 120, 72),
  c("compute", "python",        "Python",         "Python application or service — ML, APIs, scripting.", ["python","backend","ml"], 120, 72),
  c("compute", "go_service",    "Go Service",     "Go (Golang) microservice — high performance, low memory.", ["go","golang","backend"], 130, 72),
  c("compute", "cloud_function","Cloud Function", "Cloud-native function (GCF, Azure Functions, Lambda).", ["function","serverless","event"], 140, 72),
  c("compute", "sidekiq",       "Sidekiq",        "Sidekiq background job processor for Ruby.", ["sidekiq","ruby","jobs"], 120, 72),
  c("compute", "jwt_validator", "JWT Validator",  "Validates JWT tokens — standalone or sidecar.", ["jwt","auth","validation"], 130, 72),
  c("compute", "embedding",     "Embedding Model","Embedding inference endpoint — dense vector generation.", ["embedding","ml","ai"], 140, 72),
  c("compute", "temporal",      "Temporal",       "Temporal workflow orchestration engine.", ["temporal","workflow","orchestration"], 120, 72),
  c("compute", "keycloak",      "Keycloak",       "Keycloak identity and access management.", ["keycloak","iam","oauth"], 130, 72),
  c("compute", "vault",         "Vault",          "HashiCorp Vault — secrets management.", ["vault","secrets","security"], 120, 72),
  c("compute", "apache_spark",  "Apache Spark",   "Distributed data processing engine.", ["spark","batch","bigdata"], 140, 72),
  c("compute", "dbt",           "dbt",            "dbt data transformation — SQL-based data modeling.", ["dbt","sql","transform"], 110, 72),

  // ── STORAGE ──
  c("storage", "sql_db",       "SQL Database",  "Relational database — ACID transactions, joins.", ["sql","rdbms","postgres","mysql"], 140, 80),
  c("storage", "nosql_db",     "NoSQL DB",      "NoSQL database — flexible schema, horizontal scaling.", ["nosql","mongo","document"], 130, 80),
  c("storage", "cache",        "Cache",         "In-memory cache — Redis, Memcached. Sub-millisecond reads.", ["cache","redis","memory"], 120, 72),
  c("storage", "object_store", "Object Store",  "Blob / object storage — S3, GCS. Unlimited scale.", ["s3","gcs","blob","storage"], 130, 72),
  c("storage", "data_warehouse","Data Warehouse","Columnar OLAP warehouse — Snowflake, BigQuery, Redshift.", ["warehouse","olap","analytics"], 150, 80),
  c("storage", "vector_db",    "Vector DB",     "Vector database — ANN search over embeddings.", ["vector","ann","search","ai"], 130, 72),
  c("storage", "mysql",        "MySQL",         "MySQL relational database.", ["mysql","sql","relational"], 120, 72),
  c("storage", "cockroachdb",  "CockroachDB",   "Distributed SQL database — Postgres-compatible.", ["cockroach","sql","distributed"], 140, 80),
  c("storage", "dynamodb",     "DynamoDB",      "AWS DynamoDB — managed NoSQL key-value store.", ["dynamodb","aws","nosql"], 130, 72),
  c("storage", "memcached",    "Memcached",     "Memcached — simple distributed memory caching.", ["memcached","cache","memory"], 130, 72),
  c("storage", "gcs",          "GCS",           "Google Cloud Storage — object storage.", ["gcs","google","storage"], 110, 72),
  c("storage", "pinecone",     "Pinecone",      "Pinecone managed vector database.", ["pinecone","vector","managed"], 120, 72),
  c("storage", "weaviate",     "Weaviate",      "Weaviate open-source vector database.", ["weaviate","vector","graph"], 120, 72),
  c("storage", "opensearch",   "OpenSearch",    "OpenSearch — distributed search and analytics engine.", ["opensearch","search","elk"], 130, 72),
  c("storage", "influxdb",     "InfluxDB",      "InfluxDB time-series database.", ["influx","timeseries","metrics"], 120, 72),
  c("storage", "neo4j",        "Neo4j",         "Neo4j property graph database.", ["neo4j","graph","relationships"], 120, 72),
  c("storage", "clickhouse",   "ClickHouse",    "ClickHouse columnar OLAP database — fast aggregations.", ["clickhouse","olap","analytics"], 130, 72),
  c("storage", "cassandra",    "Cassandra",     "Apache Cassandra — wide-column, linear scaling.", ["cassandra","nosql","wide-column"], 130, 72),
  c("storage", "scylladb",     "ScyllaDB",      "ScyllaDB — Cassandra-compatible, C++ rewrite.", ["scylladb","cassandra","nosql"], 120, 72),
  c("storage", "vitess",       "Vitess",        "Vitess — horizontal MySQL sharding.", ["vitess","mysql","sharding"], 120, 72),
  c("storage", "timescaledb",  "TimescaleDB",   "TimescaleDB — PostgreSQL extension for time-series.", ["timescale","timeseries","postgres"], 140, 80),
  c("storage", "dragonfly",    "Dragonfly",     "Dragonfly — drop-in Redis replacement, 25× faster.", ["dragonfly","redis","cache"], 120, 72),
  c("storage", "qdrant",       "Qdrant",        "Qdrant — high-performance vector search engine.", ["qdrant","vector","rust"], 120, 72),
  c("storage", "milvus",       "Milvus",        "Milvus — open-source vector database for AI.", ["milvus","vector","ai"], 120, 72),

  // ── MESSAGING ──
  c("messaging", "message_queue","Message Queue","Async message queue — SQS, RabbitMQ, BullMQ.", ["queue","async","sqs"], 140, 72),
  c("messaging", "pubsub",       "Pub/Sub",      "Publish-subscribe broker — fan-out to many subscribers.", ["pubsub","fanout","events"], 120, 72),
  c("messaging", "event_stream", "Event Stream", "Event streaming platform — ordered, durable log.", ["stream","events","log"], 130, 72),
  c("messaging", "kafka",        "Kafka",        "Apache Kafka — distributed event streaming.", ["kafka","streaming","log"], 120, 72),
  c("messaging", "sqs",          "SQS",          "AWS Simple Queue Service — managed message queue.", ["sqs","aws","queue"], 110, 72),
  c("messaging", "redis_pubsub", "Redis Pub/Sub","Redis pub/sub for lightweight message fanout.", ["redis","pubsub","fanout"], 140, 72),
  c("messaging", "nats",         "NATS",         "NATS — cloud-native messaging, lightweight and fast.", ["nats","messaging","cloud"], 110, 72),
  c("messaging", "redpanda",     "Redpanda",     "Redpanda — Kafka-compatible streaming, no ZooKeeper.", ["redpanda","kafka","streaming"], 130, 72),

  // ── OBSERVABILITY ──
  c("observability", "metrics",      "Metrics",      "Metrics collection — Prometheus, Datadog, CloudWatch.", ["metrics","prometheus","monitoring"], 130, 72),
  c("observability", "logs",         "Logs",         "Centralised log aggregation — ELK, Loki, CloudWatch.", ["logs","elk","loki"], 110, 72),
  c("observability", "tracing",      "Tracing",      "Distributed tracing — Jaeger, Zipkin, OTLP.", ["tracing","jaeger","spans"], 120, 72),
  c("observability", "alerting",     "Alerting",     "Alert routing and notification — PagerDuty, OpsGenie.", ["alerting","pagerduty","oncall"], 120, 72),
  c("observability", "health_check", "Health Check", "Health probe endpoint — liveness and readiness checks.", ["health","probe","kubernetes"], 140, 80),
  c("observability", "jaeger",       "Jaeger",       "Jaeger distributed tracing backend.", ["jaeger","tracing","opentelemetry"], 120, 72),
  c("observability", "loki",         "Loki",         "Grafana Loki — log aggregation system.", ["loki","logs","grafana"], 110, 72),

  // ── NETWORK ──
  c("network", "vpc",         "VPC",         "Virtual Private Cloud — network isolation boundary.", ["vpc","network","isolation"], 120, 72),
  c("network", "subnet",      "Subnet",      "Subnet — IP address range within a VPC.", ["subnet","network","vpc"], 120, 72),
  c("network", "nat_gateway", "NAT Gateway", "NAT Gateway — outbound internet for private subnets.", ["nat","network","gateway"], 140, 80),
  c("network", "vpn",         "VPN",         "VPN — encrypted tunnel to on-premise or cloud.", ["vpn","tunnel","security"], 110, 72),
  c("network", "service_mesh","Service Mesh","Service mesh — mTLS, retries, circuit breaker (Istio).", ["mesh","istio","envoy"], 140, 72),
  c("network", "anycast_lb",  "Anycast LB",  "Anycast load balancer — routes to nearest PoP.", ["anycast","lb","edge"], 130, 72),
  c("network", "kong",        "Kong",        "Kong API gateway and service mesh.", ["kong","gateway","plugins"], 110, 72),
  c("network", "nginx",       "Nginx",       "Nginx — high-performance HTTP server and reverse proxy.", ["nginx","proxy","http"], 110, 72),
  c("network", "haproxy",     "HAProxy",     "HAProxy — reliable high-performance TCP/HTTP load balancer.", ["haproxy","lb","proxy"], 120, 72),
  c("network", "envoy",       "Envoy",       "Envoy proxy — L7 observability and service mesh.", ["envoy","proxy","mesh"], 110, 72),
  c("network", "firewall",    "Firewall",    "Network firewall — stateful traffic filtering.", ["firewall","security","network"], 120, 72),
  c("network", "linkerd",     "Linkerd",     "Linkerd — ultralight Kubernetes service mesh.", ["linkerd","mesh","k8s"], 120, 72),
  c("network", "traefik",     "Traefik",     "Traefik — cloud-native edge router and proxy.", ["traefik","proxy","k8s"], 120, 72),
  c("network", "consul",      "Consul",      "HashiCorp Consul — service discovery and mesh.", ["consul","discovery","mesh"], 120, 72),

  // ── AI & AGENTS ──
  c("ai_agents", "llm_gateway",  "LLM Gateway",   "LLM gateway — rate limiting, routing, cost control.", ["llm","ai","gateway"], 140, 80),
  c("ai_agents", "orchestrator", "Orchestrator",  "AI agent orchestrator — multi-step task execution.", ["agent","orchestrator","ai"], 130, 80),
  c("ai_agents", "tool_registry","Tool Registry", "Tool registry — AI function/tool discovery.", ["tools","registry","ai"], 130, 72),
  c("ai_agents", "memory_fabric","Memory Fabric", "Memory fabric — long-term agent memory store.", ["memory","agent","ai"], 130, 72),
  c("ai_agents", "safety_mesh",  "Safety Mesh",   "AI safety layer — guardrails, content filtering.", ["safety","guardrails","ai"], 130, 72),

  // ── EXTERNAL ──
  c("external", "third_party", "3rd Party API",  "External third-party API dependency.", ["api","external","third-party"], 140, 72),
  c("external", "payment",     "Payment",        "Payment processor — Stripe, PayPal, Braintree.", ["payment","stripe","billing"], 120, 72),
  c("external", "email",       "Email",          "Email service — SendGrid, SES, Mailgun.", ["email","smtp","notifications"], 110, 72),
  c("external", "daily_batch", "Daily Batch",    "Daily batch job — scheduled data processing run.", ["batch","cron","etl"], 130, 72),
  c("external", "cron_trigger","Cron Trigger",   "Cron trigger — time-based event source.", ["cron","scheduler","trigger"], 130, 72),
  c("external", "webhook",     "Webhook",        "Webhook — HTTP callback from external system.", ["webhook","callback","events"], 120, 72),
];

// ─── Category metadata ────────────────────────────────────────────────────

export const CATEGORIES: ComponentCategory[] = [
  "clients", "traffic_edge", "compute", "storage",
  "messaging", "observability", "network", "ai_agents", "external",
];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  clients:       "Clients",
  traffic_edge:  "Traffic & Edge",
  compute:       "Compute",
  storage:       "Storage",
  messaging:     "Messaging",
  observability: "Observability",
  network:       "Network",
  ai_agents:     "AI & Agents",
  external:      "External",
};

export const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  clients:       "#6b7280",
  traffic_edge:  "#2563eb",
  compute:       "#16a34a",
  storage:       "#7c3aed",
  messaging:     "#d97706",
  observability: "#dc2626",
  network:       "#4f46e5",
  ai_agents:     "#6d28d9",
  external:      "#64748b",
};

// Keep CATEGORY_ICONS for backward compat
export const CATEGORY_ICONS: Record<ComponentCategory, string> = {
  clients:       "👤",
  traffic_edge:  "🌐",
  compute:       "⚙️",
  storage:       "🗄️",
  messaging:     "📨",
  observability: "📊",
  network:       "🔲",
  ai_agents:     "🧠",
  external:      "🔌",
};

// ─── Lookup helpers ────────────────────────────────────────────────────────

export function getComponent(id: string): ComponentDefinition | undefined {
  return COMPONENTS.find((c) => c.id === id);
}

export function getComponentsByCategory(cat: ComponentCategory): ComponentDefinition[] {
  return COMPONENTS.filter((c) => c.category === cat);
}

export function searchComponents(query: string): ComponentDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return COMPONENTS;
  return COMPONENTS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
  );
}

export const COMPONENT_COUNT = COMPONENTS.length;
