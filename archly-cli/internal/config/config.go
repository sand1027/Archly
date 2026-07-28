package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const (
	defaultAPIURL = "https://api.archly.sbs"
	defaultAppURL = "https://archly.sbs"
)

// Config holds non-secret CLI settings.
type Config struct {
	APIURL          string `yaml:"api_url"`
	AppURL          string `yaml:"app_url"`
	DefaultProvider string `yaml:"default_provider"`
	DefaultMode     string `yaml:"default_mode"` // architecture | schema
}

// Overrides applied after loading file + env.
type Overrides struct {
	APIURL   string
	AppURL   string
	Provider string
	Mode     string
	JSON     bool
	Quiet    bool
	Strict   bool
}

func Dir() string {
	if p := os.Getenv("ARCHLY_CONFIG"); p != "" {
		return filepath.Dir(p)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return filepath.Join(home, ".archly")
}

func ConfigPath() string {
	if p := os.Getenv("ARCHLY_CONFIG"); p != "" {
		return p
	}
	return filepath.Join(Dir(), "config.yaml")
}

func Load() (*Config, error) {
	cfg := &Config{
		APIURL:      defaultAPIURL,
		AppURL:      defaultAppURL,
		DefaultMode: "architecture",
	}

	path := ConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return applyEnv(cfg), nil
		}
		return nil, err
	}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return applyEnv(cfg), nil
}

func applyEnv(cfg *Config) *Config {
	if v := os.Getenv("ARCHLY_API_URL"); v != "" {
		cfg.APIURL = v
	}
	if v := os.Getenv("ARCHLY_APP_URL"); v != "" {
		cfg.AppURL = v
	}
	if v := os.Getenv("ARCHLY_PROVIDER"); v != "" {
		cfg.DefaultProvider = v
	}
	if v := os.Getenv("ARCHLY_MODE"); v != "" {
		cfg.DefaultMode = v
	}
	return cfg
}

func (o Overrides) Merge(cfg *Config) (apiURL, appURL, provider, mode string) {
	apiURL = cfg.APIURL
	appURL = cfg.AppURL
	provider = cfg.DefaultProvider
	mode = cfg.DefaultMode

	if o.APIURL != "" {
		apiURL = o.APIURL
	}
	if o.AppURL != "" {
		appURL = o.AppURL
	}
	if o.Provider != "" {
		provider = o.Provider
	}
	if o.Mode != "" {
		mode = o.Mode
	}
	return
}

func EnsureDir() error {
	return os.MkdirAll(Dir(), 0o700)
}

func Save(cfg *Config) error {
	if err := EnsureDir(); err != nil {
		return err
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(ConfigPath(), data, 0o600)
}
