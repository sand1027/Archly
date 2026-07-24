/**
 * Chaos engineering definitions — matching archly.dev screenshots exactly.
 *
 * Categories from screenshots:
 *   1. Infrastructure Failures
 *   2. Network Chaos
 *   3. Application-Level Chaos
 *   4. Global Events
 */

import type { ChaosType } from "@/types";

// ─── Infrastructure chaos types (the 7 injectable types) ──────────────────

export interface ChaosTypeDefinition {
  type: ChaosType;
  label: string;
  description: string;
  icon: string;   // emoji for inline use
  color: string;  // hex color
  cssClass: string;
  defaultParams: {
    latencyMs?: number;
    surgeMultiplier?: number;
    throttleKbps?: number;
    canaryPercent?: number;
  };
}

export const CHAOS_TYPES: ChaosTypeDefinition[] = [
  { type: "crash",     label: "Crash",       icon: "💥", color: "#e53e3e", cssClass: "sim-chaos-pill--crash",
    description: "Kill the node — process crash, OOM kill, instance failure.",
    defaultParams: {} },
  { type: "slow",      label: "Slow",        icon: "🐢", color: "#d97706", cssClass: "sim-chaos-pill--slow",
    description: "Inject latency (+500ms). Models GC pause, slow disk, network lag.",
    defaultParams: { latencyMs: 500 } },
  { type: "surge",     label: "Surge",       icon: "📈", color: "#7c3aed", cssClass: "sim-chaos-pill--surge",
    description: "Traffic spike ×10. Models flash sale, viral event, bot flood.",
    defaultParams: { surgeMultiplier: 10 } },
  { type: "partition", label: "Partition",   icon: "✂️", color: "#db2777", cssClass: "sim-chaos-pill--partition",
    description: "Network partition — node cannot reach its dependencies.",
    defaultParams: {} },
  { type: "throttle",  label: "Throttle",    icon: "🚰", color: "#ea6c00", cssClass: "sim-chaos-pill--throttle",
    description: "Bandwidth throttle / rate limit — egress capped.",
    defaultParams: { throttleKbps: 100 } },
  { type: "canary",    label: "Canary",      icon: "🐦", color: "#0891b2", cssClass: "sim-chaos-pill--canary",
    description: "Canary traffic asymmetry — split misconfiguration.",
    defaultParams: { canaryPercent: 10 } },
  { type: "zero",      label: "Zero-weight", icon: "⚫", color: "#6b7280", cssClass: "sim-chaos-pill--zero",
    description: "Node in pool but receives no traffic — silent black hole.",
    defaultParams: {} },
];

export function getChaosType(type: ChaosType): ChaosTypeDefinition {
  return CHAOS_TYPES.find((c) => c.type === type) ?? CHAOS_TYPES[0];
}

// ─── Chaos scenario (clickable card in the chaos panel) ───────────────────

export type ChaosGroup =
  | "infrastructure"
  | "network"
  | "application"
  | "global";

export interface ChaosScenario {
  id: string;
  label: string;
  group: ChaosGroup;
  description: string;
  /** SVG path (24×24 viewBox) for the icon */
  icon: string;
  /** Which injectable type to apply when triggered */
  chaosType: ChaosType;
  params: {
    latencyMs?: number;
    surgeMultiplier?: number;
    throttleKbps?: number;
    canaryPercent?: number;
  };
}

// ─── Infrastructure Failures ──────────────────────────────────────────────
const INFRA_ICON = {
  availability_zone: "M3 12l9-9 9 9M5 10v9h5v-6h4v6h5v-9",
  data_center:       "M3 3h18v18H3V3zm4 4h3v3H7V7zm7 0h3v3h-3V7zM7 14h3v3H7v-3zm7 0h3v3h-3v-3z",
  instance_crash:    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0zM4.22 4.22l15.56 15.56",
  instance_slow:     "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5v7l4 4",
  disk_failure:      "M22 12H2M12 2v10M4.93 19.07 12 12l7.07 7.07M2 18h4v4H2v-4zm16 0h4v4h-4v-4z",
  disk_corruption:   "M3 5h18v4H3V5zm0 5h18v4H3v-4zm0 5h18v4H3v-4zm5-8v10m4-10v10m4-10v10",
  storage_iops:      "M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4 8-1.79 8-4-3.58-4-8-4zM4 12v3c0 2.21 3.58 4 8 4s8-1.79 8-4v-3c0 2.21-3.58 4-8 4S4 14.21 4 12zm5-2l6 3",
  file_system:       "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z",
  vm_cpu:            "M12 6a2 2 0 100 4 2 2 0 000-4zm-6 8a6 6 0 1112 0H6zm0 0H3m18 0h-3M12 3V1m0 22v-2M4.22 4.22 2.81 2.81m15.56 15.56 1.41 1.41M1 12h2m18 0h2M4.22 19.78l-1.41 1.41m15.56-15.56 1.41-1.41",
  host_hardware:     "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
};

const NET_ICON = {
  network_partition: "M8 3v4m8-4v4M3 7h18M3 17h18m-4 4v-4m-8 4v-4M8 12h8",
  cross_region:      "M3 12l9-9 9 9M5 10v9h5v-6h4v6h5v-9m-6-7v4",
  packet_loss:       "M3 12h4l3-9 3 18 3-9h5m-5-3 3 3-3 3",
  high_latency:      "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l3 3",
  bandwidth_throttle:"M8 6h8M8 12h8M8 18h8m0-12l3 3-3 3m-8-6L5 9l3 3",
  connection_flap:   "M5 12h14M12 5l7 7-7 7",
  load_balancer_net: "M12 3v4M12 17v4M4 12H3m18 0h-1M7 7l-1-1m10 10 1 1M7 17l-1 1m10-10 1-1M8 12a4 4 0 108 0 4 4 0 00-8 0",
  backend_port:      "M4 4h16v16H4V4zm4 4h8M8 12h8M8 16h4",
  health_check_net:  "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78zM9 12l2 2 4-4",
  tls_cert:          "M12 2L4 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
  dns_resolution:    "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9",
};

const APP_ICON = {
  memory_leak:   "M9 17H7A5 5 0 017 7h1M15 7h1a5 5 0 010 10h-1M8 12h8",
  out_of_memory: "M9.5 2A2.5 2.5 0 017 4.5v15A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v-15A2.5 2.5 0 0014.5 2h-5zM12 18h.01",
  thread_pool:   "M12 6v4m0 0l-2-2m2 2 2-2M3 12h18M7 15l2 2-2 2m10-4l-2 2 2 2",
  deadlock:      "M12 2a10 10 0 100 20A10 10 0 0012 2zm-4 8a4 4 0 018 0m-8 0v4m8-4v4m-4 4v2",
  cache_stampede:"M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6zm8-2a2 2 0 110 4 2 2 0 010-4z",
  error_storm:   "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
};

const GLOBAL_ICON = {
  traffic_surge: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
};

// ─── All scenarios ─────────────────────────────────────────────────────────

export const CHAOS_SCENARIOS: ChaosScenario[] = [
  // ── Infrastructure Failures ──
  { id: "availability-zone",  label: "Availability Zone",  group: "infrastructure",
    description: "Entire AZ becomes unreachable — multi-AZ failover test.",
    icon: INFRA_ICON.availability_zone,  chaosType: "crash",    params: {} },
  { id: "data-center",        label: "Data Center",        group: "infrastructure",
    description: "Full data center failure — DR test.",
    icon: INFRA_ICON.data_center,        chaosType: "crash",    params: {} },
  { id: "instance-crash",     label: "Instance Crash",     group: "infrastructure",
    description: "Process crash, OOM kill, or unexpected reboot.",
    icon: INFRA_ICON.instance_crash,     chaosType: "crash",    params: {} },
  { id: "instance-slow",      label: "Instance Slow",      group: "infrastructure",
    description: "VM becomes slow — high CPU steal, noisy neighbour.",
    icon: INFRA_ICON.instance_slow,      chaosType: "slow",     params: { latencyMs: 800 } },
  { id: "disk-failure",       label: "Disk Failure",       group: "infrastructure",
    description: "Block device fails — I/O errors, data unavailable.",
    icon: INFRA_ICON.disk_failure,       chaosType: "crash",    params: {} },
  { id: "disk-corruption",    label: "Disk Corruption",    group: "infrastructure",
    description: "Silent data corruption — reads return wrong data.",
    icon: INFRA_ICON.disk_corruption,    chaosType: "slow",     params: { latencyMs: 300 } },
  { id: "storage-iops",       label: "Storage IOPS",       group: "infrastructure",
    description: "IOPS limit exhausted — all disk ops queue or fail.",
    icon: INFRA_ICON.storage_iops,       chaosType: "slow",     params: { latencyMs: 500 } },
  { id: "file-system",        label: "File System",        group: "infrastructure",
    description: "Filesystem fills up or mounts read-only.",
    icon: INFRA_ICON.file_system,        chaosType: "crash",    params: {} },
  { id: "vm-cpu",             label: "VM CPU",             group: "infrastructure",
    description: "CPU saturation — runaway process or noisy neighbour.",
    icon: INFRA_ICON.vm_cpu,             chaosType: "slow",     params: { latencyMs: 600 } },
  { id: "host-hardware",      label: "Host Hardware",      group: "infrastructure",
    description: "Physical hardware failure — NIC, DIMM, PCIe error.",
    icon: INFRA_ICON.host_hardware,      chaosType: "crash",    params: {} },

  // ── Network Chaos ──
  { id: "network-partition",  label: "Network Partition",  group: "network",
    description: "Network split — node cannot reach its peers.",
    icon: NET_ICON.network_partition,    chaosType: "partition", params: {} },
  { id: "cross-region-loss",  label: "Cross-Region Loss",  group: "network",
    description: "Cross-region connectivity interrupted.",
    icon: NET_ICON.cross_region,         chaosType: "partition", params: {} },
  { id: "packet-loss",        label: "Packet Loss",        group: "network",
    description: "Random packet drop — 5–30% loss rate injected.",
    icon: NET_ICON.packet_loss,          chaosType: "slow",      params: { latencyMs: 200 } },
  { id: "high-latency",       label: "High Latency",       group: "network",
    description: "Network latency spike — +500ms injected.",
    icon: NET_ICON.high_latency,         chaosType: "slow",      params: { latencyMs: 500 } },
  { id: "bandwidth-throttle", label: "Bandwidth Throttle", group: "network",
    description: "Egress bandwidth capped — throughput limited.",
    icon: NET_ICON.bandwidth_throttle,   chaosType: "throttle",  params: { throttleKbps: 100 } },
  { id: "connection-flap",    label: "Connection Flap",    group: "network",
    description: "Connections repeatedly drop and reconnect.",
    icon: NET_ICON.connection_flap,      chaosType: "slow",      params: { latencyMs: 300 } },
  { id: "load-balancer-net",  label: "Load Balancer",      group: "network",
    description: "Load balancer routing failure or misconfiguration.",
    icon: NET_ICON.load_balancer_net,    chaosType: "canary",    params: { canaryPercent: 50 } },
  { id: "backend-port",       label: "Backend Port",       group: "network",
    description: "Backend port unreachable — connection refused.",
    icon: NET_ICON.backend_port,         chaosType: "crash",     params: {} },
  { id: "health-check-net",   label: "Health Check",       group: "network",
    description: "Health checks fail — node removed from rotation.",
    icon: NET_ICON.health_check_net,     chaosType: "crash",     params: {} },
  { id: "tls-certificate",    label: "TLS Certificate",    group: "network",
    description: "TLS cert expired or mismatched — connections refused.",
    icon: NET_ICON.tls_cert,             chaosType: "crash",     params: {} },
  { id: "dns-resolution",     label: "DNS Resolution",     group: "network",
    description: "DNS lookup failures — names don't resolve.",
    icon: NET_ICON.dns_resolution,       chaosType: "crash",     params: {} },

  // ── Application-Level Chaos ──
  { id: "memory-leak",        label: "Memory Leak",        group: "application",
    description: "Memory grows unbounded — eventual OOM kill.",
    icon: APP_ICON.memory_leak,          chaosType: "slow",     params: { latencyMs: 400 } },
  { id: "out-of-memory",      label: "Out of Memory",      group: "application",
    description: "OOM event — process killed by kernel.",
    icon: APP_ICON.out_of_memory,        chaosType: "crash",    params: {} },
  { id: "thread-pool",        label: "Thread Pool",        group: "application",
    description: "Thread pool exhausted — new requests queue or drop.",
    icon: APP_ICON.thread_pool,          chaosType: "slow",     params: { latencyMs: 800 } },
  { id: "deadlock",           label: "Deadlock",           group: "application",
    description: "Two or more threads wait forever for each other.",
    icon: APP_ICON.deadlock,             chaosType: "slow",     params: { latencyMs: 2000 } },
  { id: "cache-stampede",     label: "Cache Stampede",     group: "application",
    description: "Cache miss thundering herd — all requests hit origin.",
    icon: APP_ICON.cache_stampede,       chaosType: "surge",    params: { surgeMultiplier: 5 } },
  { id: "error-storm",        label: "Error Storm",        group: "application",
    description: "Cascading errors trigger retry storms downstream.",
    icon: APP_ICON.error_storm,          chaosType: "surge",    params: { surgeMultiplier: 8 } },

  // ── Global Events ──
  { id: "traffic-surge",      label: "Traffic Surge",      group: "global",
    description: "Global traffic spike — flash sale, viral event, DDoS.",
    icon: GLOBAL_ICON.traffic_surge,     chaosType: "surge",    params: { surgeMultiplier: 10 } },
];

// ─── Grouped lookup ────────────────────────────────────────────────────────

export const CHAOS_GROUP_LABELS: Record<ChaosGroup, string> = {
  infrastructure: "Infrastructure Failures",
  network:        "Network Chaos",
  application:    "Application-Level Chaos",
  global:         "Global Events",
};

export const CHAOS_BY_GROUP = CHAOS_SCENARIOS.reduce<Record<ChaosGroup, ChaosScenario[]>>(
  (acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  },
  {} as Record<ChaosGroup, ChaosScenario[]>
);

// Keep old export name for backward compat
export const APP_CHAOS_SCENARIOS = CHAOS_SCENARIOS;
export const APP_CHAOS_BY_CATEGORY = Object.fromEntries(
  Object.entries(CHAOS_BY_GROUP).map(([k, v]) => [k, v])
);
export type AppChaosScenario = ChaosScenario;
