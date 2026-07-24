/**
 * Per-node metric calculations for the simulation engine.
 * All runs client-side — no backend round-trip needed.
 */

import type { NodeMetrics, ChaosInjection, ExcalidrawElement } from "@/types";

// Base RPS a "healthy" node handles at 1× traffic multiplier
const BASE_RPS_BY_TYPE: Record<string, number> = {
  "api-gateway":        5000,
  "load-balancer":      8000,
  "cdn":               20000,
  "service":            1000,
  "background-worker":   200,
  "lambda":              500,
  "container":           800,
  "kubernetes-pod":      600,
  "kubernetes-ingress": 3000,
  "postgresql":          300,
  "redis":              8000,
  "kafka":              5000,
  "object-store":       1000,
  "cassandra":          2000,
  "dynamodb":           3000,
  "elasticsearch":       400,
  "vector-db":           200,
  "graph-db":            150,
  "data-warehouse":       50,
  "time-series-db":      800,
  "message-queue":      2000,
  "dead-letter-queue":    50,
  "stream-processor":    500,
  "pubsub-broker":      3000,
  "rate-limiter":       5000,
  "auth-service":        800,
  "ml-model":             80,
  "feature-store":       600,
  "embedding-index":     300,
  "fine-tuned-model":     40,
  "payment-processor":   200,
  "email-service":       500,
  "metrics-collector":   400,
  "trace-collector":     300,
  "log-aggregator":      600,
};

const DEFAULT_BASE_RPS = 500;

// Base latency (ms) for each type at 1× traffic
const BASE_LATENCY_BY_TYPE: Record<string, number> = {
  "api-gateway":         5,
  "load-balancer":       2,
  "cdn":                 8,
  "service":            20,
  "background-worker":  50,
  "lambda":            100,  // cold start included avg
  "container":          25,
  "kubernetes-pod":     30,
  "kubernetes-ingress":  8,
  "postgresql":         10,
  "redis":               1,
  "kafka":               5,
  "object-store":       30,
  "cassandra":           5,
  "dynamodb":            3,
  "elasticsearch":      20,
  "vector-db":          15,
  "graph-db":           25,
  "data-warehouse":    200,
  "time-series-db":      8,
  "message-queue":       5,
  "dead-letter-queue":  10,
  "stream-processor":   30,
  "pubsub-broker":      10,
  "rate-limiter":        1,
  "auth-service":       15,
  "ml-model":          150,
  "feature-store":       5,
  "embedding-index":    20,
  "fine-tuned-model":  300,
  "payment-processor": 200,
  "email-service":      50,
  "metrics-collector":  10,
  "trace-collector":    10,
  "log-aggregator":      8,
};

const DEFAULT_BASE_LATENCY = 20;

/**
 * Calculate current metrics for a single node given:
 * - its element type (maps to base RPS / latency)
 * - current traffic multiplier (0.1 – 5.0)
 * - any active chaos injections targeting this node
 */
export function calculateNodeMetrics(
  element: ExcalidrawElement,
  trafficMultiplier: number,
  injections: ChaosInjection[]
): NodeMetrics {
  const type = (element.customData?.componentId as string) ?? element.type;
  const myInjections = injections.filter((i) => i.nodeId === element.id);

  const baseRps     = BASE_RPS_BY_TYPE[type]     ?? DEFAULT_BASE_RPS;
  const baseLatency = BASE_LATENCY_BY_TYPE[type] ?? DEFAULT_BASE_LATENCY;

  let rps         = baseRps * trafficMultiplier;
  let latencyAvg  = baseLatency;
  let errorRate   = 0;
  let cpuPercent  = Math.min(95, 10 + (trafficMultiplier / 5) * 70);
  let memPercent  = Math.min(95, 20 + (trafficMultiplier / 5) * 50);

  // Apply chaos effects
  for (const inj of myInjections) {
    switch (inj.type) {
      case "crash":
        rps        = 0;
        errorRate  = 1;
        cpuPercent = 0;
        memPercent = 0;
        latencyAvg = 0;
        break;

      case "slow":
        latencyAvg += inj.params.latencyMs ?? 500;
        errorRate  += 0.05;
        cpuPercent  = Math.min(99, cpuPercent + 20);
        break;

      case "surge":
        rps        *= inj.params.surgeMultiplier ?? 10;
        errorRate  += 0.3;
        cpuPercent  = Math.min(99, cpuPercent + 40);
        memPercent  = Math.min(99, memPercent + 30);
        latencyAvg *= 3;
        break;

      case "partition":
        errorRate  += 0.5;
        rps        *= 0.5;
        latencyAvg *= 2;
        break;

      case "throttle":
        rps        *= 0.3;
        latencyAvg *= 1.5;
        errorRate  += 0.1;
        break;

      case "canary":
        errorRate  += 0.15;
        latencyAvg *= 1.2;
        break;

      case "zero":
        rps        = 0;
        errorRate  = 0; // silently receives no traffic
        break;
    }
  }

  // Saturation: when RPS exceeds base capacity, latency spikes
  const capacity    = baseRps * 1.2;
  const saturation  = Math.min(1, rps / capacity);
  if (saturation > 0.8) {
    const overload = (saturation - 0.8) / 0.2; // 0 – 1
    latencyAvg    *= 1 + overload * 4;           // up to 5× latency spike
    errorRate     += overload * 0.2;
    cpuPercent     = Math.min(99, cpuPercent + overload * 20);
  }

  const latencyP99 = latencyAvg * (1.5 + Math.random() * 0.5);
  const throughput = rps * 1.2; // rough bytes/s approximation

  return {
    nodeId:       element.id,
    rps:          Math.round(rps),
    latencyAvg:   Math.round(latencyAvg * 10) / 10,
    latencyP99:   Math.round(latencyP99 * 10) / 10,
    throughput:   Math.round(throughput),
    errorRate:    Math.min(1, Math.max(0, parseFloat(errorRate.toFixed(3)))),
    cpuPercent:   Math.round(cpuPercent),
    memPercent:   Math.round(memPercent),
    isBottleneck: saturation > 0.85 || errorRate > 0.2,
  };
}

/**
 * Rank all nodes by bottleneck score (higher = worse).
 * Returns sorted list — first entry is the worst bottleneck.
 */
export function rankBottlenecks(
  metrics: Record<string, NodeMetrics>
): Array<{ nodeId: string; score: number; reason: string }> {
  return Object.values(metrics)
    .map((m) => {
      const score =
        m.errorRate * 50 +
        (m.latencyAvg > 500 ? 30 : m.latencyAvg > 100 ? 15 : 0) +
        (m.cpuPercent > 90 ? 20 : m.cpuPercent > 70 ? 10 : 0);

      let reason = "Healthy";
      if (m.errorRate >= 1)     reason = "CRASHED — NO FAILOVER";
      else if (m.errorRate > 0.3) reason = "High error rate";
      else if (m.latencyAvg > 500) reason = "Severe latency spike";
      else if (m.cpuPercent > 90)  reason = "CPU saturation";
      else if (m.isBottleneck)     reason = "BOTTLENECK";

      return { nodeId: m.nodeId, score, reason };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
}
