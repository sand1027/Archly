#!/usr/bin/env bash
# Update Homebrew formulas with release tarball URLs and sha256 checksums.
#
# Usage: ./archly-cli/scripts/bump-brew-formula.sh v0.1.0
#
# Requires: curl, shasum (macOS) or sha256sum (Linux)
# Run after GitHub Release assets are published (tag push / release workflow).

set -euo pipefail

TAG="${1:?usage: bump-brew-formula.sh v0.1.0}"
VERSION="${TAG#v}"
REPO="sand1027/Archly"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

sha256_of() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

fetch_sha() {
  local asset="$1"
  local url="https://github.com/${REPO}/releases/download/${TAG}/${asset}"
  local tmp
  tmp="$(mktemp)"
  echo "  fetching ${asset}…" >&2
  curl -fsSL "$url" -o "$tmp"
  sha256_of "$tmp"
  rm -f "$tmp"
}

SHA_DARWIN_ARM64="$(fetch_sha "archly_darwin_arm64.tar.gz")"
SHA_DARWIN_AMD64="$(fetch_sha "archly_darwin_amd64.tar.gz")"
SHA_LINUX_ARM64="$(fetch_sha "archly_linux_arm64.tar.gz")"
SHA_LINUX_AMD64="$(fetch_sha "archly_linux_amd64.tar.gz")"

write_formula() {
  local dest="$1"
  cat >"$dest" <<RUBY
class Archly < Formula
  desc "Headless CLI for Archly — AI architecture diagrams and database ERDs"
  homepage "https://github.com/sand1027/Archly"
  version "${VERSION}"
  license "MIT"

  head do
    url "https://github.com/sand1027/Archly.git", branch: "main"
  end

  on_macos do
    on_arm do
      url "https://github.com/sand1027/Archly/releases/download/${TAG}/archly_darwin_arm64.tar.gz"
      sha256 "${SHA_DARWIN_ARM64}"
    end
    on_intel do
      url "https://github.com/sand1027/Archly/releases/download/${TAG}/archly_darwin_amd64.tar.gz"
      sha256 "${SHA_DARWIN_AMD64}"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/sand1027/Archly/releases/download/${TAG}/archly_linux_arm64.tar.gz"
      sha256 "${SHA_LINUX_ARM64}"
    end
    on_intel do
      url "https://github.com/sand1027/Archly/releases/download/${TAG}/archly_linux_amd64.tar.gz"
      sha256 "${SHA_LINUX_AMD64}"
    end
  end

  depends_on "go" => :build if build.head?

  def install
    if build.head?
      cd "archly-cli" do
        system "go", "build", *std_go_args(ldflags: "-s -w -X main.version=HEAD")
      end
      return
    end

    bin.install "archly"
  end

  test do
    out = shell_output("\#{bin}/archly version")
    assert_match(/\d+\.\d+/, out)
  end
end
RUBY
}

write_formula "${ROOT}/Formula/archly.rb"
write_formula "${ROOT}/homebrew-tap/Formula/archly.rb"

echo "Updated Formula/archly.rb and homebrew-tap/Formula/archly.rb for ${TAG}"
