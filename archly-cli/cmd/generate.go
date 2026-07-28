package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/sand1027/Archly/archly-cli/internal/api"
	"github.com/sand1027/Archly/archly-cli/internal/mermaid"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

var generateFlags struct {
	File     string
	Out      string
	Provider string
	Mode     string
	NoStream bool
	Strict   bool
}

func init() {
	generateCmd.Flags().StringVarP(&generateFlags.File, "file", "f", "", "read prompt from file")
	generateCmd.Flags().StringVarP(&generateFlags.Out, "out", "o", "", "write Mermaid to file")
	generateCmd.Flags().StringVarP(&generateFlags.Provider, "provider", "p", "", "AI provider (ollama|groq|github|openrouter|nvidia|nvidia-nemotron|nvidia-deepseek)")
	generateCmd.Flags().StringVar(&generateFlags.Mode, "mode", "", "architecture (default) or schema")
	generateCmd.Flags().BoolVar(&generateFlags.NoStream, "no-stream", false, "buffer output then print once")
	generateCmd.Flags().BoolVar(&generateFlags.Strict, "strict", false, "exit 3 on partial/incomplete diagrams")
	rootCmd.AddCommand(generateCmd)
}

var generateCmd = &cobra.Command{
	Use:   "generate [prompt...]",
	Short: "Generate a Mermaid diagram from natural language (SSE)",
	Long: `Stream a Mermaid diagram from the Archly AI API.

Examples:
  archly generate "Design a Twitter-scale feed architecture"
  archly generate --mode schema "PostgreSQL e-commerce ERD with 35 tables"
  archly generate -p ollama -o design.mmd -f prompt.txt`,
	Args: cobra.MinimumNArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}
		_, _, defaultProvider, defaultMode := globalOverrides.Merge(cfg)

		provider := generateFlags.Provider
		if provider == "" {
			provider = defaultProvider
		}
		mode := strings.ToLower(generateFlags.Mode)
		if mode == "" {
			mode = strings.ToLower(defaultMode)
		}
		if mode == "" {
			mode = "architecture"
		}
		if mode != "architecture" && mode != "schema" {
			output.ExitUsage("--mode must be architecture or schema")
		}

		prompt, err := readPrompt(generateFlags.File, args)
		if err != nil {
			output.ExitUsage(err.Error())
		}

		output.Info(outFlags, "provider=%s mode=%s streaming…", providerLabel(provider), mode)

		var streamFn func(string)
		if !generateFlags.NoStream && generateFlags.Out == "" && !outFlags.JSON {
			streamFn = func(chunk string) {
				_, _ = os.Stdout.WriteString(chunk)
			}
		}

		result, err := client.TextToDiagramStream(bgCtx(), prompt, provider, mode, streamFn)
		if err != nil {
			if result != nil && result.Text != "" {
				emitGenerate(result, provider, mode, true)
				output.ExitPartial("stream ended early: " + err.Error())
			}
			output.ExitAPI(err.Error())
		}

		emitGenerate(result, provider, mode, result.Partial)
	},
}

func providerLabel(p string) string {
	if p == "" {
		return "auto"
	}
	return p
}

func readPrompt(file string, args []string) (string, error) {
	if file != "" {
		b, err := os.ReadFile(file)
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(b)), nil
	}
	if len(args) == 0 {
		return "", fmt.Errorf("prompt required as argument or --file")
	}
	return strings.TrimSpace(strings.Join(args, " ")), nil
}

func emitGenerate(result *api.StreamResult, provider, mode string, partial bool) {
	text := mermaid.Normalize(result.Text)
	if err := mermaid.Validate(text); err != nil {
		if generateFlags.Strict {
			output.ExitPartial("invalid mermaid: " + err.Error())
		}
		output.Info(outFlags, "warning: %v", err)
	}

	complete := mermaid.IsComplete(text)
	if partial || !complete {
		if generateFlags.Strict {
			output.ExitPartial("incomplete diagram")
		}
		output.Info(outFlags, "warning: partial or incomplete diagram")
	}

	if outFlags.JSON {
		_ = output.PrintJSON(map[string]any{
			"mermaid":  text,
			"provider": providerLabel(provider),
			"mode":     mode,
			"partial":  partial || !complete,
		})
		return
	}

	if generateFlags.NoStream || generateFlags.Out != "" {
		if err := output.WriteOut(outFlags, generateFlags.Out, text); err != nil {
			output.ExitAPI(err.Error())
		}
		return
	}

	if len(text) > 0 && text[len(text)-1] != '\n' {
		_, _ = os.Stdout.WriteString("\n")
	}
}
