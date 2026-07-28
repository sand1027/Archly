package cmd

import (
	"fmt"

	"github.com/sand1027/Archly/archly-cli/internal/auth"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(whoamiCmd)
}

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show the authenticated user",
	Run: func(cmd *cobra.Command, args []string) {
		cred, err := auth.LoadCredentials()
		if err != nil {
			output.ExitAPI(err.Error())
		}
		if cred == nil || cred.AccessToken == "" {
			output.ExitAPI("not logged in — run `archly login`")
		}

		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}

		user, err := client.Me(bgCtx())
		if err != nil {
			output.ExitAPI(err.Error())
		}

		if outFlags.JSON {
			_ = output.PrintJSON(user)
			return
		}
		fmt.Printf("%s <%s>\n", user.DisplayName, user.Email)
	},
}
