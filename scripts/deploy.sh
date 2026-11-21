#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec 9< .
flock 9

compose=(docker compose --env-file .env.prod -f docker-compose.prod.yml)
docroot=/var/www/shared
build_dir=$(mktemp -d)
publish_dir=

cleanup() {
  rm -rf -- "$build_dir"
  if [[ -n "$publish_dir" ]]; then
    sudo rm -rf -- "$publish_dir"
  fi
}
trap cleanup EXIT

"${compose[@]}" config --quiet
docker buildx build --target static --output "type=local,dest=$build_dir" frontend
for file in index.html manifest.webmanifest sw.js; do
  test -s "$build_dir/$file"
done
test -d "$build_dir/assets"
test -d "$build_dir/icons"
"${compose[@]}" up --detach --build --wait --wait-timeout 120

# Keep earlier hashed assets available for open tabs.
sudo install -d -m 0755 "$docroot/assets" "$docroot/icons"
publish_dir=$(sudo mktemp -d "$docroot/.publish.XXXXXX")
for directory in assets icons; do
  for asset in "$build_dir/$directory"/*; do
    filename=${asset##*/}
    sudo install -m 0644 "$asset" "$publish_dir/$filename"
    sudo mv -f -- "$publish_dir/$filename" "$docroot/$directory/$filename"
  done
done

# The next worker must be able to precache the newly published HTML and assets.
for file in manifest.webmanifest index.html sw.js; do
  sudo install -m 0644 "$build_dir/$file" "$publish_dir/$file"
  sudo mv -f -- "$publish_dir/$file" "$docroot/$file"
done
