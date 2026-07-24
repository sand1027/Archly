/**
 * Mermaid → Excalidraw element converter.
 *
 * Wraps @excalidraw/mermaid-to-excalidraw (which itself wraps mermaid v11).
 * Returns Excalidraw elements + files ready to be passed to
 * excalidrawAPI.updateScene({ elements, files }).
 *
 * All 20+ Mermaid diagram types are supported via the underlying library:
 * flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram,
 * gantt, pie, gitGraph, mindmap, C4Context, kanban, timeline, sankey,
 * quadrantChart, packet, radar, block, architecture, xychart, treemap.
 */

export interface MermaidConversionResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  files?: Record<string, any>;
}

export interface MermaidConversionError {
  message: string;
  line?: number;
}

export type MermaidConvertResult =
  | { ok: true; data: MermaidConversionResult }
  | { ok: false; error: MermaidConversionError };

/**
 * Convert a Mermaid diagram string to Excalidraw elements.
 * Returns a discriminated union — never throws.
 */
export async function convertMermaidToCanvas(
  mermaidSyntax: string
): Promise<MermaidConvertResult> {
  if (!mermaidSyntax.trim()) {
    return { ok: false, error: { message: "Empty diagram" } };
  }

  try {
    // Dynamic import — the library is large, only load when needed
    const { parseMermaidToExcalidraw } = await import(
      "@excalidraw/mermaid-to-excalidraw"
    );

    const result = await parseMermaidToExcalidraw(mermaidSyntax);

    return {
      ok: true,
      data: {
        elements: result.elements ?? [],
        files: result.files,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse Mermaid diagram";

    // Try to extract line number from error message
    const lineMatch = message.match(/line (\d+)/i);
    return {
      ok: false,
      error: {
        message,
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      },
    };
  }
}

/**
 * Quick syntax-only check — does NOT convert to Excalidraw.
 * Uses the mermaid parser directly for fast validation.
 */
export async function validateMermaidSyntax(
  mermaidSyntax: string
): Promise<MermaidConversionError | null> {
  if (!mermaidSyntax.trim()) return null;
  try {
    const mermaid = await import("mermaid");
    await mermaid.default.parse(mermaidSyntax);
    return null;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Syntax error";
    const lineMatch = message.match(/line (\d+)/i);
    return {
      message,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
    };
  }
}

/** Example Mermaid snippets shown in the editor placeholder */
export const MERMAID_EXAMPLES = {
  flowchart: `flowchart TD
    Client --> LB[Load Balancer]
    LB --> SvcA[Service A]
    LB --> SvcB[Service B]
    SvcA --> DB[(PostgreSQL)]
    SvcB --> Cache[(Redis)]
    Cache --> DB`,

  sequence: `sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant S as Service
    participant D as Database
    C->>G: POST /login
    G->>S: validate credentials
    S->>D: SELECT user
    D-->>S: user row
    S-->>G: JWT token
    G-->>C: 200 OK + token`,

  er: `erDiagram
    USERS ||--o{ DESIGNS : creates
    USERS ||--o{ DESIGN_STARS : stars
    DESIGNS ||--o{ DESIGN_FORKS : forked_into
    DESIGNS {
        uuid id PK
        string title
        jsonb elements
        bool published
    }`,
} as const;
