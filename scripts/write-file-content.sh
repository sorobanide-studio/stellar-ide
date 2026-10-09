#!/bin/sh
# Write base64-encoded content into a file inside a running sandbox container.
#
# Usage: write-file-content.sh <container> <target-path> <base64-content>
#
# The payload is base64 so neither the local shell nor the shell inside the
# container reinterprets a byte of it. The inner `sh -c` receives the content
# and the target as positional parameters, so the path is quoted even when it
# contains spaces.
set -eu

container=$1
target=$2
base64_content=$3

docker exec -u developer "$container" \
  sh -c 'printf %s "$1" | base64 -d > "$2"' sh "$base64_content" "$target"
