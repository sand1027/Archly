package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"

	"github.com/sand1027/Archly/archly-cli/internal/auth"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var loginFlags struct {
	Email    string
	Password string
}

func init() {
	loginCmd.Flags().StringVar(&loginFlags.Email, "email", "", "account email")
	loginCmd.Flags().StringVar(&loginFlags.Password, "password", "", "password (prefer prompt or ARCHLY_PASSWORD)")
	rootCmd.AddCommand(loginCmd)
}

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with Archly",
	Run: func(cmd *cobra.Command, args []string) {
		_, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}

		email := loginFlags.Email
		if email == "" {
			email = strings.TrimSpace(os.Getenv("ARCHLY_EMAIL"))
		}
		if email == "" {
			fmt.Fprint(os.Stderr, "Email: ")
			email, _ = bufio.NewReader(os.Stdin).ReadString('\n')
			email = strings.TrimSpace(email)
		}

		password := loginFlags.Password
		if password == "" {
			password = os.Getenv("ARCHLY_PASSWORD")
		}
		if password == "" {
			fmt.Fprint(os.Stderr, "Password: ")
			b, err := term.ReadPassword(int(syscall.Stdin))
			fmt.Fprintln(os.Stderr)
			if err != nil {
				output.ExitUsage("could not read password")
			}
			password = string(b)
		}

		if email == "" || password == "" {
			output.ExitUsage("email and password are required")
		}

		resp, err := client.Login(bgCtx(), email, password)
		if err != nil {
			output.ExitAPI(err.Error())
		}

		if err := auth.SaveCredentials(&auth.Credentials{
			AccessToken:  resp.AccessToken,
			RefreshToken: resp.RefreshToken,
		}); err != nil {
			output.ExitAPI("save credentials: " + err.Error())
		}

		if outFlags.JSON {
			_ = output.PrintJSON(map[string]any{
				"email":        resp.User.Email,
				"display_name": resp.User.DisplayName,
				"id":           resp.User.ID,
			})
			return
		}
		output.Info(outFlags, "Logged in as %s (%s)", resp.User.DisplayName, resp.User.Email)
	},
}
