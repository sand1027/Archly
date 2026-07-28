package cmd

import (
	"github.com/sand1027/Archly/archly-cli/internal/auth"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(logoutCmd)
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove stored credentials",
	Run: func(cmd *cobra.Command, args []string) {
		if err := auth.ClearCredentials(); err != nil {
			output.ExitAPI(err.Error())
		}
		if outFlags.JSON {
			_ = output.PrintJSON(map[string]string{"status": "logged_out"})
			return
		}
		output.Info(outFlags, "Logged out")
	},
}
