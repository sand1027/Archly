/** AI provider keys exposed in the UI. Empty = backend auto fallback chain. */
export type AiProvider = "" | "ollama" | "openrouter";

export const AI_PROVIDER_STORAGE_KEY = "archly-ai-provider";

export const AI_PROVIDER_OPTIONS: {
  value: AiProvider;
  label: string;
  description: string;
}[] = [
  { value: "", label: "Auto", description: "Best available model" },
  { value: "ollama", label: "Archly AI", description: "Fast and private" },
  { value: "openrouter", label: "Cloud AI", description: "Detailed cloud model" },
];

export function readStoredAiProvider(fallback: AiProvider = "openrouter"): AiProvider {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    return AI_PROVIDER_OPTIONS.some((option) => option.value === value)
      ? (value as AiProvider)
      : fallback;
  } catch {
    return fallback;
  }
}

export function storeAiProvider(provider: AiProvider): void {
  try {
    window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
