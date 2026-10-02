#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
image=taskotter:local
name=taskotter
case "${1:-}" in
  build) container build -f "$project_dir/Containerfile" -t "$image" "$project_dir" ;;
  init|up)
    directory=${2:?Usage: run-mac.sh init|up DATA_DIRECTORY [PORT]}
    port=${3:-3000}
    mkdir -p "$directory"
    directory=$(CDPATH= cd -- "$directory" && pwd)
    if [ "$1" = init ]; then
      container run --rm --volume "$directory:/data" "$image" node --input-type=module -e 'import {Store} from "/app/dist/server/store.js"; await new Store("/data").initialize();'
    else
      container run -d --name "$name" --publish "127.0.0.1:$port:3000" --volume "$directory:/data" "$image"
      echo "TaskOtter: http://localhost:$port"
    fi
    ;;
  stop) container stop "$name" ;;
  start) container start "$name" ;;
  delete) container delete "$name" ;;
  *) echo 'Usage: run-mac.sh build|init DATA_DIRECTORY|up DATA_DIRECTORY [PORT]|stop|start|delete' >&2; exit 2 ;;
esac
