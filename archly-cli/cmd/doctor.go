package cmd

import (
	"fmt"

	"github.com/sand1027/Archly/archly-cli/internal/auth"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(doctorCmd)
}

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Check API health and authentication",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, client, err := loadRuntime()
		if err != nil {
			output.ExitAPI(err.Error())
		}
		_, _, provider, mode := globalOverrides.Merge(cfg)

		health, err := client.Health(bgCtx())
		apiOK := err == nil
		apiMsg := "ok"
		apiVersion := ""
		if err != nil {
			apiMsg = err.Error()
		} else {
			apiVersion = health.Version
		}

		authStatus := "not logged in"
		var userEmail string
		cred, _ := auth.LoadCredentials()
		if cred != nil && cred.AccessToken != "" {
			if user, err := client.Me(bgCtx()); err == nil {
				authStatus = "authenticated"
				userEmail = user.Email
			} else {
				authStatus = "token invalid: " + err.Error()
			}
		}

		if outFlags.JSON {
			_ = output.PrintJSON(map[string]any{
				"api_url":          cfg.APIURL,
				"api_ok":           apiOK,
				"api_version":      apiVersion,
				"auth":             authStatus,
				"email":            userEmail,
				"default_provider": provider,
				"default_mode":     mode,
			})
		} else {
			output.Info(outFlags, "Archly doctor")
			fmt.Printf("  API URL:     %s\n", cfg.APIURL)
			if apiOK {
				fmt.Printf("  API health:  ok (version %s)\n", apiVersion)
			} else {
				fmt.Printf("  API health:  FAIL — %s\n", apiMsg)
			}
			fmt.Printf("  Auth:        %s\n", authStatus)
			if userEmail != "" {
				fmt.Printf("  Email:       %s\n", userEmail)
			}
			if provider != "" {
				fmt.Printf("  Provider:    %s (pinned)\n", provider)
			} else {
				fmt.Printf("  Provider:    auto\n")
			}
			fmt.Printf("  Mode:        %s\n", mode)
		}

		if !apiOK {
			output.ExitAPI("API unreachable — check ARCHLY_API_URL and that the backend is running")
		}
	},
}
