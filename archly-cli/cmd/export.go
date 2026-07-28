package cmd

import (
	"os"
	"strings"

	"github.com/sand1027/Archly/archly-cli/internal/mermaid"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

var exportFlags struct {
	File   string
	Format string
	Out    string
}

func init() {
	exportCmd.Flags().StringVarP(&exportFlags.File, "file", "f", "", "Mermaid source file (required)")
	exportCmd.Flags().StringVar(&exportFlags.Format, "format", "docker-compose", "terraform|docker-compose|kubernetes")
	exportCmd.Flags().StringVarP(&exportFlags.Out, "out", "o", "", "write code to file")
	_ = exportCmd.MarkFlagRequired("file")
	rootCmd.AddCommand(exportCmd)
}

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "Convert a Mermaid diagram to infra code",
	Long: `Calls POST /v1/ai/diagram-to-code/generate with a Mermaid wrapper payload
until POST /v1/ai/mermaid-to-code ships (see cliplan.md B1).`,
	Run: func(cmd *cobra.Command, args []string) {
		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}

		raw, err := os.ReadFile(exportFlags.File)
		if err != nil {
			output.ExitUsage(err.Error())
		}
		text := mermaid.Normalize(string(raw))
		if err := mermaid.Validate(text); err != nil {
			output.ExitUsage(err.Error())
		}

		format := strings.ToLower(exportFlags.Format)
		switch format {
		case "terraform", "docker-compose", "kubernetes":
		default:
			output.ExitUsage("--format must be terraform, docker-compose, or kubernetes")
		}

		output.Info(outFlags, "export format=%s …", format)

		resp, err := client.DiagramToCode(bgCtx(), text, format)
		if err != nil {
			output.ExitAPI(err.Error())
		}

		code := strings.TrimSpace(resp.Code)
		if outFlags.JSON {
			_ = output.PrintJSON(map[string]string{
				"code":   code,
				"format": resp.Format,
			})
			return
		}

		if err := output.WriteOut(outFlags, exportFlags.Out, code+"\n"); err != nil {
			output.ExitAPI(err.Error())
		}
	},
}
