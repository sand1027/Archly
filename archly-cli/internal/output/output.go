package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"text/tabwriter"
)

var (
	Stdout = os.Stdout
	Stderr = os.Stderr
)

type Flags struct {
	JSON  bool
	Quiet bool
}

func Info(f Flags, format string, args ...any) {
	if f.Quiet {
		return
	}
	fmt.Fprintf(Stderr, format+"\n", args...)
}

func ErrorMsg(msg string) {
	fmt.Fprintln(Stderr, "error:", msg)
}

func ExitUsage(msg string) {
	ErrorMsg(msg)
	os.Exit(1)
}

func ExitAPI(msg string) {
	ErrorMsg(msg)
	os.Exit(2)
}

func ExitPartial(msg string) {
	ErrorMsg(msg)
	os.Exit(3)
}

func PrintJSON(v any) error {
	enc := json.NewEncoder(Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func PrintTable(headers []string, rows [][]string) {
	w := tabwriter.NewWriter(Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, joinTab(headers))
	for _, row := range rows {
		fmt.Fprintln(w, joinTab(row))
	}
	_ = w.Flush()
}

func joinTab(cols []string) string {
	out := cols[0]
	for i := 1; i < len(cols); i++ {
		out += "\t" + cols[i]
	}
	return out
}

func WriteFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0o644)
}

func WriteOut(f Flags, path string, content string) error {
	if path != "" {
		return WriteFile(path, content)
	}
	_, err := io.WriteString(Stdout, content)
	if err == nil && len(content) > 0 && content[len(content)-1] != '\n' {
		_, err = io.WriteString(Stdout, "\n")
	}
	return err
}
