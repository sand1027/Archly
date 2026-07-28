/** AI provider keys exposed in the UI. Empty = backend auto fallback chain. */
export type AiProvider =
  | ""
  | "ollama"
  | "groq"
  | "nvidia"
  | "nvidia-nemotron"
  | "nvidia-deepseek"
  | "github"
  | "openrouter";

export const AI_PROVIDER_STORAGE_KEY = "archly-ai-provider";

export const AI_PROVIDER_OPTIONS: {
  value: AiProvider;
  label: string;
  /** Long form, used in expanded/field UI. */
  description: string;
  /** Short model tag shown on the right of a menu row. */
  hint: string;
}[] = [
  {
    value: "",
    label: "Auto",
    description: "Ollama → Groq → NVIDIA → GitHub → OpenRouter",
    hint: "fallback",
  },
  {
    value: "ollama",
    label: "Archly AI",
    description: "Local Ollama on your server",
    hint: "local",
  },
  {
    value: "groq",
    label: "Groq",
    description: "llama-3.3-70b — fast free tier (best for big schemas)",
    hint: "llama-3.3-70b",
  },
  {
    value: "nvidia",
    label: "NVIDIA",
    description: "Llama 3.3 70B via NIM (NVIDIA only — no fallback)",
    hint: "llama-3.3-70b",
  },
  {
    value: "nvidia-nemotron",
    label: "NVIDIA Nemotron",
    description: "Nemotron Super 49B (NVIDIA only — no fallback)",
    hint: "nemotron-49b",
  },
  {
    value: "nvidia-deepseek",
    label: "NVIDIA DeepSeek",
    description: "DeepSeek V4 Pro (NVIDIA only — no fallback)",
    hint: "deepseek-v4-pro",
  },
  {
    value: "github",
    label: "OpenAI",
    description: "gpt-4o-mini via GitHub Models",
    hint: "gpt-4o-mini",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Free cloud models with auto fallback if one is empty",
    hint: "free+",
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
    case "nvidia":
    case "nvidia-nemotron":
    case "nvidia-deepseek":
      return "N";
    case "github":
      return "O";
    case "openrouter":
      return "R";
    default:
      return "✦";
  }
}
