#!/bin/sh
# Run in WSL Ubuntu using its local Docker Engine.
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
image=taskotter:local
name=taskotter-docker
usage() { echo 'Usage: run-wsl-docker.sh build|init DATA_DIRECTORY|up DATA_DIRECTORY [PORT]|stop|start|delete|logs|status' >&2; }
case "${1:-}" in build|init|up|stop|start|delete|logs|status) ;; *) usage; exit 2 ;; esac
command -v docker >/dev/null 2>&1 || { echo 'Docker EngineをUbuntuにインストールしてください。docs/wsl-docker.md を参照。' >&2; exit 1; }
case "${TASKOTTER_DOCKER_SUDO:-0}" in 0|1) ;; *) echo 'TASKOTTER_DOCKER_SUDO は0または1を指定してください。' >&2; exit 2 ;; esac
run_docker() {
    if [ "${TASKOTTER_DOCKER_SUDO:-0}" = 1 ]; then sudo docker "$@"; else docker "$@"; fi
}
case "$1" in
  build) run_docker build -f "$project_dir/Containerfile" -t "$image" "$project_dir" ;;
  init|up)
    directory=${2:-}
    [ -n "$directory" ] || { usage; echo '保存先ディレクトリを指定してください。' >&2; exit 2; }
    port=${3:-3000}
    case "$port" in ''|*[!0-9]*) echo 'ポートは1～65535の整数を指定してください。' >&2; exit 2 ;; esac
    [ "${#port}" -le 5 ] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { echo 'ポートは1～65535の整数を指定してください。' >&2; exit 2; }
    mkdir -p -- "$directory"
    directory=$(CDPATH= cd -- "$directory" && pwd -P)
    case "$directory" in *:*) echo '保存先にコロンを含むパスは使用できません。' >&2; exit 2 ;; esac
    # Use the caller's UID so Linux-backed data files remain editable outside Docker.
    user_id=$(id -u)
    group_id=$(id -g)
    if [ "$1" = init ]; then
      run_docker run --rm --user "$user_id:$group_id" --volume "$directory:/data" "$image" node --input-type=module -e 'import {Store} from "/app/dist/server/store.js"; await new Store("/data").initialize();'
    else
      run_docker run -d --name "$name" --user "$user_id:$group_id" --publish "127.0.0.1:$port:3000" --volume "$directory:/data" "$image"
      echo "TaskOtter: http://localhost:$port"
    fi
    ;;
  stop) run_docker stop "$name" ;;
  start) run_docker start "$name" ;;
  delete) run_docker rm "$name" ;;
  logs) run_docker logs "$name" ;;
  status) run_docker ps -a --filter "name=^/$name$" ;;
esac
