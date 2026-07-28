package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/sand1027/Archly/archly-cli/internal/api"
	"github.com/sand1027/Archly/archly-cli/internal/auth"
	"github.com/sand1027/Archly/archly-cli/internal/mermaid"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	sessionCmd.AddCommand(sessionListCmd)
	sessionCmd.AddCommand(sessionGetCmd)
	sessionCmd.AddCommand(sessionSaveCmd)
	sessionCmd.AddCommand(sessionDeleteCmd)
	rootCmd.AddCommand(sessionCmd)
}

var sessionCmd = &cobra.Command{
	Use:   "session",
	Short: "Manage saved design sessions",
}

var sessionListCmd = &cobra.Command{
	Use:   "list",
	Short: "List your saved sessions",
	Run: func(cmd *cobra.Command, args []string) {
		requireAuth()
		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}

		resp, err := client.ListMine(bgCtx(), 1, 50)
		if err != nil {
			output.ExitAPI(err.Error())
		}

		if outFlags.JSON {
			_ = output.PrintJSON(resp)
			return
		}

		if len(resp.Designs) == 0 {
			output.Info(outFlags, "No saved sessions")
			return
		}

		rows := make([][]string, 0, len(resp.Designs))
		for _, d := range resp.Designs {
			rows = append(rows, []string{
				d.ID,
				d.Kind,
				d.Title,
				formatTime(d.UpdatedAt),
			})
		}
		output.PrintTable([]string{"ID", "KIND", "TITLE", "UPDATED"}, rows)
	},
}

var sessionGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Export Mermaid from a saved session",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		requireAuth()
		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}

		d, err := client.GetDesign(bgCtx(), args[0])
		if err != nil {
			output.ExitAPI(err.Error())
		}

		text, err := api.ExtractMermaid(d)
		if err != nil {
			output.ExitAPI(err.Error())
		}
		text = mermaid.Normalize(text)

		out, _ := cmd.Flags().GetString("out")
		if outFlags.JSON {
			_ = output.PrintJSON(map[string]any{
				"id":      d.ID,
				"title":   d.Title,
				"kind":    d.Kind,
				"mermaid": text,
			})
			return
		}

		if err := output.WriteOut(outFlags, out, text); err != nil {
			output.ExitAPI(err.Error())
		}
	},
}

func init() {
	sessionGetCmd.Flags().StringP("out", "o", "", "write Mermaid to file")
}

var sessionSaveCmd = &cobra.Command{
	Use:   "save",
	Short: "Save a Mermaid file as a design session",
	Run: func(cmd *cobra.Command, args []string) {
		requireAuth()
		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}

		title, _ := cmd.Flags().GetString("title")
		file, _ := cmd.Flags().GetString("file")

		if title == "" {
			output.ExitUsage("--title is required")
		}
		if file == "" {
			output.ExitUsage("--file is required")
		}

		raw, err := os.ReadFile(file)
		if err != nil {
			output.ExitUsage(err.Error())
		}
		text := mermaid.Normalize(string(raw))
		if err := mermaid.Validate(text); err != nil {
			output.ExitUsage(err.Error())
		}

		kind := sessionSaveKind
		if kind == "" {
			kind = mermaid.DetectKind(text)
		}

		req, err := api.MermaidSavePayload(text, kind)
		if err != nil {
			output.ExitAPI(err.Error())
		}
		req.Title = title

		d, err := client.SaveDesign(bgCtx(), req)
		if err != nil {
			output.ExitAPI(err.Error())
		}

		if outFlags.JSON {
			_ = output.PrintJSON(d)
			return
		}
		fmt.Printf("saved %s (%s)\n", d.ID, d.Title)
	},
}

func init() {
	sessionSaveCmd.Flags().StringP("title", "t", "", "session title (required)")
	sessionSaveCmd.Flags().StringP("file", "f", "", "Mermaid file (required)")
	sessionSaveCmd.Flags().StringVar(&sessionSaveKind, "kind", "", "flow|schema (auto-detected from erDiagram)")
}

var sessionSaveKind string

var sessionDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a saved session",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		requireAuth()
		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}
		if err := client.DeleteDesign(bgCtx(), args[0]); err != nil {
			output.ExitAPI(err.Error())
		}
		if outFlags.JSON {
			_ = output.PrintJSON(map[string]string{"deleted": args[0]})
			return
		}
		output.Info(outFlags, "deleted %s", args[0])
	},
}

func requireAuth() {
	cred, err := auth.LoadCredentials()
	if err != nil {
		output.ExitAPI(err.Error())
	}
	if cred == nil || cred.AccessToken == "" {
		output.ExitAPI("not logged in — run `archly login`")
	}
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Local().Format("2006-01-02 15:04")
}
