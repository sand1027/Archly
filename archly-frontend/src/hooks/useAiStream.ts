"use client";

import { useState, useCallback, useRef } from "react";
import { apiStream } from "@/lib/api/client";
import { aiApi } from "@/lib/api/endpoints";

interface UseAiStreamOptions {
  onChunk?: (raw: string) => void;
  onDone?: (fullResponse: string) => void;
  onError?: (err: Error) => void;
}

export function useAiStream(options: UseAiStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [response, setResponse] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Keep callbacks in a ref so the stream function never gets recreated
  // when the parent re-renders with a new options object literal.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stream = useCallback((prompt: string, provider?: string, mode?: "architecture" | "schema") => {
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    setResponse("");
    setError(null);
    setIsStreaming(true);

    let accumulated = "";
    const diagramMode = mode === "schema" ? "schema" : "architecture";

    const controller = apiStream(
      aiApi.textToDiagramStreamPath,
      { prompt, provider: provider ?? "", mode: diagramMode },
      (chunk) => {
        accumulated += chunk;
        setResponse(accumulated);
        optionsRef.current.onChunk?.(chunk);
      },
      () => {
        setIsStreaming(false);
        optionsRef.current.onDone?.(accumulated);
      },
      (err) => {
        setIsStreaming(false);
        // Stream often dies mid-Ollama run; if we already have Mermaid, still convert it.
        const looksLikeMermaid =
          /flowchart\s/i.test(accumulated) ||
          /graph\s/i.test(accumulated) ||
          /erDiagram/i.test(accumulated);
        if (looksLikeMermaid && accumulated.trim().length > 40) {
          optionsRef.current.onDone?.(accumulated);
          setError(new Error("Stream ended early — used partial diagram. Re-run if nodes look incomplete."));
          return;
        }
        setError(err);
        optionsRef.current.onError?.(err);
      }
    );

    abortRef.current = controller;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — never recreated

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { stream, cancel, isStreaming, response, error };
}
