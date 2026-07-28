package cmd

import (
	"context"

	"github.com/sand1027/Archly/archly-cli/internal/api"
	"github.com/sand1027/Archly/archly-cli/internal/auth"
	"github.com/sand1027/Archly/archly-cli/internal/config"
	"github.com/sand1027/Archly/archly-cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	cliVersion string
	outFlags   output.Flags
	globalOverrides config.Overrides
)

func SetVersion(v string) {
	cliVersion = v
}

func Execute() error {
	return rootCmd.Execute()
}

var rootCmd = &cobra.Command{
	Use:   "archly",
	Short: "Archly CLI — headless architecture & schema generation",
	Long:  "Scriptable client for the Archly API: generate Mermaid diagrams, save sessions, export infra code.",
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&outFlags.JSON, "json", false, "machine-readable JSON output")
	rootCmd.PersistentFlags().BoolVar(&outFlags.Quiet, "quiet", false, "suppress status on stderr")
	rootCmd.PersistentFlags().StringVar(&globalOverrides.APIURL, "api-url", "", "Archly API base URL (overrides config)")
	rootCmd.PersistentFlags().StringVar(&globalOverrides.Provider, "provider", "", "default AI provider")
}

func loadRuntime() (*config.Config, *api.Client, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, nil, err
	}
	apiURL, _, _, _ := globalOverrides.Merge(cfg)

	cred, err := auth.LoadCredentials()
	if err != nil {
		return nil, nil, err
	}

	client := api.New(apiURL).WithCredentials(cred)
	client.OnTokenUpdate(func(access, refresh string) {
		_ = auth.SaveCredentials(&auth.Credentials{
			AccessToken:  access,
			RefreshToken: refresh,
		})
	})
	return cfg, client, nil
}

func bgCtx() context.Context {
	return context.Background()
}
