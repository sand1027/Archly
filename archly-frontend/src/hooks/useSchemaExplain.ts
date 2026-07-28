"use client";

import { useCallback, useRef, useState } from "react";
import { apiChatStream } from "@/lib/api/client";
import { aiApi } from "@/lib/api/endpoints";
import {
  buildSchemaDiagramSnapshot,
  explainSchemaPrompt,
  explainTablePrompt,
} from "@/lib/schema/schema-explain";
import type { AiProvider } from "@/lib/ai/providers";
import type { SchemaEdge, SchemaNode } from "@/store/schema.store";

export function useSchemaExplain() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setText("");
    setError(null);
  }, []);

  const explain = useCallback(
    (
      prompt: string,
      nodes: SchemaNode[],
      edges: SchemaEdge[],
      selectedTableId: string | null,
      provider: AiProvider = "groq"
    ) => {
      const trimmed = prompt.trim();
      if (!trimmed || isStreaming) return;

      abortRef.current?.abort();
      setError(null);
      setText("");
      setIsStreaming(true);

      const diagram = buildSchemaDiagramSnapshot(nodes, edges, selectedTableId);

      let accumulated = "";
      abortRef.current = apiChatStream(
        aiApi.canvasChatPath,
        {
          messages: [{ role: "user", content: trimmed }],
          diagram,
          canvas: "schema",
          provider,
        },
        {
          onToken: (chunk) => {
            accumulated += chunk;
            setText(accumulated);
          },
          onActions: () => {},
          onDone: () => setIsStreaming(false),
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
          },
        }
      );
    },
    [isStreaming]
  );

  const explainTable = useCallback(
    (
      tableName: string,
      nodes: SchemaNode[],
      edges: SchemaEdge[],
      selectedTableId: string | null,
      provider: AiProvider = "groq"
    ) => {
      explain(explainTablePrompt(tableName, nodes, edges), nodes, edges, selectedTableId, provider);
    },
    [explain]
  );

  const explainFullSchema = useCallback(
    (nodes: SchemaNode[], edges: SchemaEdge[], provider: AiProvider = "groq") => {
      explain(explainSchemaPrompt(nodes, edges), nodes, edges, null, provider);
    },
    [explain]
  );

  return { text, isStreaming, error, explain, explainTable, explainFullSchema, cancel, clear };
}
