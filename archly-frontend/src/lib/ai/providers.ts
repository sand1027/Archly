/** AI provider keys exposed in the UI. Empty = backend auto fallback chain. */
export type AiProvider = "" | "ollama" | "groq" | "github" | "openrouter";

export const AI_PROVIDER_STORAGE_KEY = "archly-ai-provider";

export const AI_PROVIDER_OPTIONS: {
  value: AiProvider;
  label: string;
  description: string;
}[] = [
  {
    value: "",
    label: "Auto",
    description: "Ollama → Groq → GitHub → OpenRouter",
  },
  {
    value: "ollama",
    label: "Archly AI",
    description: "Local Ollama on your server",
  },
  {
    value: "groq",
    label: "Groq",
    description: "llama-3.3-70b — fast free tier",
  },
  {
    value: "github",
    label: "OpenAI",
    description: "gpt-4o-mini via GitHub Models",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Cloud fallback models",
  },
];

export function readStoredAiProvider(fallback: AiProvider = "groq"): AiProvider {
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

export function providerIconLetter(provider: AiProvider): string {
  switch (provider) {
    case "ollama":
      return "A";
    case "groq":
      return "G";
    case "github":
      return "O";
    case "openrouter":
      return "R";
    default:
      return "✦";
  }
}
