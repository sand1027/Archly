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

  const stream = useCallback(
    (prompt: string) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      setResponse("");
      setError(null);
      setIsStreaming(true);

      let accumulated = "";

      const controller = apiStream(
        aiApi.textToDiagramStreamPath,
        { prompt },
        (chunk) => {
          accumulated += chunk;
          setResponse(accumulated);
          options.onChunk?.(chunk);
        },
        () => {
          setIsStreaming(false);
          options.onDone?.(accumulated);
        },
        (err) => {
          setIsStreaming(false);
          setError(err);
          options.onError?.(err);
        }
      );

      abortRef.current = controller;
    },
    [options]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { stream, cancel, isStreaming, response, error };
}
