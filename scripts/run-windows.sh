#!/bin/sh
# Run from Ubuntu on WSL; pass a Windows directory via /mnt/c/... .
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
image=taskotter:local
name=taskotter
case "${1:-}" in
  build) cd "$project_dir"; wslc.exe build -f Containerfile -t "$image" . ;;
  init|up)
    directory=${2:?Usage: run-windows.sh init|up /mnt/c/PATH [PORT]}
    port=${3:-3000}
    case "$directory" in /mnt/[a-zA-Z]/*) ;; *) echo '保存先はWindowsのディレクトリを /mnt/c/... 形式で指定してください。' >&2; exit 2 ;; esac
    mkdir -p "$directory"
    windows_directory=$(wslpath -w "$directory")
    if [ "$1" = init ]; then
      wslc.exe run --rm -v "$windows_directory:/data" "$image" node --input-type=module -e 'import {Store} from "/app/dist/server/store.js"; await new Store("/data").initialize();'
    else
      wslc.exe run -d --name "$name" -p "127.0.0.1:$port:3000" -v "$windows_directory:/data" "$image"
      echo "TaskOtter: http://localhost:$port"
    fi
    ;;
  stop) wslc.exe container stop "$name" ;;
  start) wslc.exe container start "$name" ;;
  delete) wslc.exe container rm "$name" ;;
  *) echo 'Usage: run-windows.sh build|init DATA_DIRECTORY|up DATA_DIRECTORY [PORT]|stop|start|delete' >&2; exit 2 ;;
esac
