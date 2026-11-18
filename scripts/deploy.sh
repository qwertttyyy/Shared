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
test -s "$build_dir/index.html"
test -d "$build_dir/assets"
"${compose[@]}" up --detach --build --wait --wait-timeout 120

# Publish new assets before switching HTML. Open tabs can still load older chunks.
sudo install -d -m 0755 "$docroot/assets"
publish_dir=$(sudo mktemp -d "$docroot/.publish.XXXXXX")
for asset in "$build_dir"/assets/*; do
  filename=${asset##*/}
  sudo install -m 0644 "$asset" "$publish_dir/$filename"
  sudo mv -f -- "$publish_dir/$filename" "$docroot/assets/$filename"
done
sudo install -m 0644 "$build_dir/index.html" "$publish_dir/index.html"
sudo mv -f -- "$publish_dir/index.html" "$docroot/index.html"
