#!/bin/sh
# Remove stale WASM build artifacts from a running sandbox container.
#
# Usage: clean-wasm-artifacts.sh <container> <path> [<path> ...]
#
# `rm -f` never fails on a missing file, and each removal is best-effort so a
# container with no previous build still succeeds.
set -u

container=$1
shift

for path in "$@"; do
  docker exec "$container" rm -f "$path" || true
done
