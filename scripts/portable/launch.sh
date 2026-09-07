#!/bin/sh
set -eu
# Generated release.env contains publisher-controlled literal assignments only.
base_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$base_dir/release.env"
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) target=linux-x64 ;;
  Darwin:arm64) target=darwin-arm64 ;;
  *) echo 'Graft portable: unsupported platform or architecture.' >&2; exit 1 ;;
esac
cache_base=${GRAFT_PORTABLE_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/digimbyte/Graft}
cache="$cache_base/$GRAFT_TAG"
runtime="$cache/graft-$target"
mkdir -p "$cache"
if [ ! -f "$runtime/.complete" ]; then
  temp=$(mktemp -d "$cache/install.XXXXXXXX")
  locked=0
  cleanup() {
    if [ "$locked" -eq 1 ]; then rmdir "$cache/$target.lock" 2>/dev/null || :; fi
    rm -rf -- "$temp"
  }
  trap cleanup EXIT
  trap 'exit 1' HUP INT TERM
  asset="graft-$target.tar.gz"
  url="https://github.com/$GRAFT_REPOSITORY/releases/download/$GRAFT_TAG"
  echo "Graft: downloading $GRAFT_TAG for $target" >&2
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 "$url/$asset" -o "$temp/$asset"
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 "$url/$asset.sha256" -o "$temp/checksum"
  expected=$(awk -v f="$asset" '$2 == f && length($1) == 64 && $1 !~ /[^0-9a-fA-F]/ {print $1}' "$temp/checksum")
  [ "${#expected}" -eq 64 ] || { echo 'Invalid Graft checksum file.' >&2; exit 1; }
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$temp/$asset" | cut -d ' ' -f 1)
  else actual=$(shasum -a 256 "$temp/$asset" | cut -d ' ' -f 1); fi
  [ "$actual" = "$expected" ] || { echo 'Graft checksum mismatch; refusing to launch.' >&2; exit 1; }
  tar -xzf "$temp/$asset" -C "$temp"
  [ -x "$temp/graft-$target/node" ] || { echo 'Incomplete Graft archive.' >&2; exit 1; }
  printf '%s\n' "$expected" > "$temp/graft-$target/.complete"
  # Atomic rename under a short installation lock; downloads remain independent.
  attempts=0
  until mkdir "$cache/$target.lock" 2>/dev/null; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 60 ] || { echo 'Graft install lock busy; retry later.' >&2; exit 1; }
    sleep 1
  done
  locked=1
  if [ -f "$runtime/.complete" ]; then :
  elif [ -e "$runtime" ]; then echo 'Incomplete Graft runtime; move it aside and retry.' >&2; exit 1
  else mv "$temp/graft-$target" "$runtime"; fi
  rmdir "$cache/$target.lock"
  locked=0
  cleanup
  trap - EXIT HUP INT TERM
fi
export DO_NOT_TRACK=1
if [ "$#" -eq 0 ] || { [ "$#" -eq 1 ] && [ "$1" = mcp ]; }; then
  exec "$runtime/node" "$runtime/app/scripts/portable/mcp.mjs"
fi
exec "$runtime/node" "$runtime/app/dist/cli.js" "$@"
