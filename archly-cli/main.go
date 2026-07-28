package main

import (
	"os"

	"github.com/sand1027/Archly/archly-cli/cmd"
)

// Set at build time: go build -ldflags "-X main.version=0.1.0"
var version = "0.1.0-dev"

func main() {
	cmd.SetVersion(version)
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
