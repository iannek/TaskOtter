#!/bin/sh
set -eu

project_dir=/Users/naito/Workspace/IT/TaskOtter
image=taskotter-dev:local
name=taskotter-dev
codex_volume=taskotter-dev-codex

usage() {
  cat <<'EOF'
Usage: scripts/dev-container.sh build|up|shell|codex|status|stop|delete

  build   Build the development image
  up      Start the persistent development container
  shell   Open a shell in /workspace
  codex   Start Codex in /workspace
  status  Show the development container
  stop    Stop it without removing its filesystem
  delete  Delete a stopped development container (keeps volumes and source)
EOF
}

if ! command -v container >/dev/null 2>&1; then
  echo 'Apple container CLI is not installed. See docs/mac-development-container.md.' >&2
  exit 1
fi

case "${1:-}" in
  build)
    container build --platform linux/arm64 \
      --build-arg "DEV_UID=$(id -u)" --build-arg "DEV_GID=$(id -g)" \
      -f "$project_dir/dev/Containerfile" -t "$image" "$project_dir/dev"
    ;;
  up)
    if container inspect "$name" >/dev/null 2>&1; then
      container start "$name"
    else
      container run -d --name "$name" \
        --platform linux/arm64 \
        --cpus 4 --memory 8G \
        --volume "$project_dir:/workspace" \
        --volume "$codex_volume:/home/dev/.codex" \
        --workdir /workspace \
        "$image"
    fi
    container exec --user root "$name" chown -R "$(id -u):$(id -g)" /home/dev/.codex
    ;;
  shell)
    container exec -it --workdir /workspace "$name" bash
    ;;
  codex)
    container exec -it --workdir /workspace "$name" codex
    ;;
  status)
    container list --all
    ;;
  stop)
    container stop "$name"
    ;;
  delete)
    container delete "$name"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
