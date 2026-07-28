package mermaid

import (
	"fmt"
	"regexp"
	"strings"
)

var fenceRe = regexp.MustCompile(`(?is)^\s*` + "```" + `(?:mermaid)?\s*([\s\S]*?)` + "```" + `\s*$`)

// Normalize strips fences and leading/trailing whitespace.
func Normalize(src string) string {
	s := strings.TrimSpace(src)
	if m := fenceRe.FindStringSubmatch(s); len(m) == 2 {
		s = strings.TrimSpace(m[1])
	}
	s = strings.TrimPrefix(s, "```mermaid")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// Validate checks that text looks like a supported Mermaid diagram.
func Validate(src string) error {
	s := Normalize(src)
	if s == "" {
		return fmt.Errorf("empty mermaid")
	}
	lower := strings.ToLower(s)
	switch {
	case strings.HasPrefix(lower, "flowchart"),
		strings.HasPrefix(lower, "graph "),
		strings.HasPrefix(lower, "graph\n"),
		strings.HasPrefix(lower, "erdiagram"):
		return nil
	default:
		return fmt.Errorf("mermaid must start with flowchart, graph, or erDiagram")
	}
}

// IsComplete returns true when the diagram has a recognizable header and body.
func IsComplete(src string) bool {
	if err := Validate(src); err != nil {
		return false
	}
	s := Normalize(src)
	lines := strings.Split(s, "\n")
	return len(lines) >= 2
}

// DetectKind returns "schema" for erDiagram, else "flow".
func DetectKind(src string) string {
	s := strings.ToLower(Normalize(src))
	if strings.HasPrefix(s, "erdiagram") {
		return "schema"
	}
	return "flow"
}
