#!/usr/bin/env bash
# Install the Archly CLI — one command, no clone required.
#
#   curl -fsSL https://raw.githubusercontent.com/sand1027/Archly/main/archly-cli/install.sh | bash
#
# Options (env):
#   INSTALL_DIR   where to put the binary (default: ~/.local/bin)
#   ARCHLY_VERSION  release tag, e.g. v0.1.0 (default: latest GitHub release, else go install)

set -euo pipefail

REPO="sand1027/Archly"
MODULE="github.com/sand1027/Archly/archly-cli"
BIN="archly"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/bin}"
VERSION="${ARCHLY_VERSION:-}"

info() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux)  echo "linux" ;;
    *)      die "unsupported OS: $(uname -s) (use: go install ${MODULE}@latest)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) die "unsupported arch: $(uname -m)" ;;
  esac
}

ensure_install_dir() {
  mkdir -p "$INSTALL_DIR"
}

install_from_release() {
  local os arch tag url tmpdir asset name
  os="$(detect_os)"
  arch="$(detect_arch)"
  need_cmd curl
  need_cmd tar

  if [ -z "$VERSION" ]; then
    need_cmd curl
    tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')" || return 1
  else
    tag="$VERSION"
  fi

  [ -n "$tag" ] || return 1
  name="${BIN}_${os}_${arch}.tar.gz"
  url="https://github.com/${REPO}/releases/download/${tag}/${name}"

  info "Downloading ${tag} (${os}/${arch})…"
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  if ! curl -fsSL "$url" -o "${tmpdir}/${name}"; then
    return 1
  fi

  tar -xzf "${tmpdir}/${name}" -C "$tmpdir"
  ensure_install_dir
  install -m 0755 "${tmpdir}/${BIN}" "${INSTALL_DIR}/${BIN}"
  info "Installed ${BIN} → ${INSTALL_DIR}/${BIN}"
  return 0
}

install_from_go() {
  need_cmd go
  ensure_install_dir

  local gopath bin
  gopath="$(go env GOPATH)"
  bin="${gopath}/bin/${BIN}"

  info "Building with go install ${MODULE}@latest …"
  if [ -n "$VERSION" ]; then
    GO111MODULE=on go install "${MODULE}@${VERSION}"
  else
    GO111MODULE=on go install "${MODULE}@latest"
  fi

  [ -x "$bin" ] || die "go install succeeded but binary not found at $bin"

  if [ "$bin" != "${INSTALL_DIR}/${BIN}" ]; then
    install -m 0755 "$bin" "${INSTALL_DIR}/${BIN}"
    info "Installed ${BIN} → ${INSTALL_DIR}/${BIN}"
  else
    info "Installed ${BIN} → $bin"
  fi
}

path_hint() {
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      warn "${INSTALL_DIR} is not on your PATH."
      warn "Add this to ~/.zshrc or ~/.bashrc:"
      warn "  export PATH=\"${INSTALL_DIR}:\$PATH\""
      ;;
  esac
}

main() {
  info "Archly CLI installer"

  if install_from_release; then
    path_hint
    "${INSTALL_DIR}/${BIN}" version 2>/dev/null || true
    exit 0
  fi

  warn "No release binary found — falling back to go install"
  install_from_go
  path_hint
  "${INSTALL_DIR}/${BIN}" version 2>/dev/null || true
}

main "$@"
