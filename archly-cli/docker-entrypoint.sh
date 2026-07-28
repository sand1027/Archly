#!/bin/sh
# Fix named-volume ownership (often root) then drop to archly.
set -e
mkdir -p /home/archly/.archly
chown -R archly:archly /home/archly/.archly 2>/dev/null || true

if [ "$#" -eq 0 ]; then
  set -- sleep infinity
fi

exec su-exec archly "$@"
