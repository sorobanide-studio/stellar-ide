#!/bin/sh
# Report whether a path exists inside a running sandbox container.
#
# Usage: path-exists.sh <container> <f|d> <path>
#
# The TypeScript call sites used to build this check as a template literal
# (`docker exec ... test -f ... && echo "exists" || echo "missing"`), which no
# shell linter ever saw and which left the path unquoted. Running it as a real
# script keeps both arguments quoted and the shell explicit.
set -eu

container=$1
kind=$2
path=$3

if docker exec "$container" test "-$kind" "$path" >/dev/null 2>&1; then
  echo "exists"
else
  echo "missing"
fi
