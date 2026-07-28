package mermaid

import "testing"

func TestNormalizeStripsFence(t *testing.T) {
	in := "```mermaid\nflowchart TD\n  A --> B\n```"
	got := Normalize(in)
	if got != "flowchart TD\n  A --> B" {
		t.Fatalf("got %q", got)
	}
}

func TestValidateErDiagram(t *testing.T) {
	if err := Validate("erDiagram\n  USERS ||--o{ ORDERS : places"); err != nil {
		t.Fatal(err)
	}
}

func TestDetectKind(t *testing.T) {
	if DetectKind("flowchart TD\nA-->B") != "flow" {
		t.Fatal("expected flow")
	}
	if DetectKind("erDiagram\nA ||--o{ B : x") != "schema" {
		t.Fatal("expected schema")
	}
}
