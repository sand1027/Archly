"use client";

/**
 * Multi-node chaos scenario packs (Black Friday, AZ outage, etc.).
 * Applied to the first N Flow nodes when simulation is running.
 */

import type { ChaosType } from "@/types";

export interface ChaosPack {
  id: string;
  name: string;
  description: string;
  /** Ordered chaos types applied to distinct flow nodes */
  injections: ChaosType[];
}

export const CHAOS_PACKS: ChaosPack[] = [
  {
    id: "black-friday",
    name: "Black Friday",
    description: "Traffic surge + latency on edge + throttle on checkout path",
    injections: ["surge", "slow", "throttle"],
  },
  {
    id: "az-outage",
    name: "AZ outage",
    description: "Crash a compute node + network partition on a dependency",
    injections: ["crash", "partition"],
  },
  {
    id: "noisy-neighbor",
    name: "Noisy neighbor",
    description: "Canary asymmetry + bandwidth throttle",
    injections: ["canary", "throttle"],
  },
  {
    id: "silent-failure",
    name: "Silent black hole",
    description: "Zero-weight a service so traffic never arrives",
    injections: ["zero"],
  },
];
