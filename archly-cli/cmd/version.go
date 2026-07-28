package cmd

import (
	"fmt"

	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(versionCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print CLI version",
	Run: func(cmd *cobra.Command, args []string) {
		if outFlags.JSON {
			_ = output.PrintJSON(map[string]string{"version": cliVersion})
			return
		}
		fmt.Println(cliVersion)
	},
}
