package auth

import (
	"os"
	"time"

	"github.com/sand1027/Archly/archly-cli/internal/config"
	"gopkg.in/yaml.v3"
)

// Credentials stores JWT tokens on disk (mode 0600).
type Credentials struct {
	AccessToken  string    `yaml:"access_token"`
	RefreshToken string    `yaml:"refresh_token,omitempty"`
	ExpiresAt    time.Time `yaml:"expires_at,omitempty"`
}

func CredentialsPath() string {
	return config.Dir() + "/credentials"
}

func LoadCredentials() (*Credentials, error) {
	if token := os.Getenv("ARCHLY_TOKEN"); token != "" {
		return &Credentials{AccessToken: token}, nil
	}

	path := CredentialsPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var cred Credentials
	if err := yaml.Unmarshal(data, &cred); err != nil {
		return nil, err
	}
	if cred.AccessToken == "" {
		return nil, nil
	}
	return &cred, nil
}

func SaveCredentials(c *Credentials) error {
	if err := config.EnsureDir(); err != nil {
		return err
	}
	data, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(CredentialsPath(), data, 0o600)
}

func ClearCredentials() error {
	path := CredentialsPath()
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func AccessToken() (string, error) {
	c, err := LoadCredentials()
	if err != nil {
		return "", err
	}
	if c == nil {
		return "", nil
	}
	return c.AccessToken, nil
}
