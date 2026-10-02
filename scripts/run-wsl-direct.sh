#!/bin/sh
# Portable Node runtime; no system installation or persistent PATH changes.
set -eu
usage() { echo 'Usage: run-wsl-direct.sh setup|build|init DATA_DIRECTORY|start DATA_DIRECTORY [PORT]' >&2; }
case "${1:-}" in setup|build) [ "$#" -eq 1 ] || { usage; exit 2; } ;; init) [ "$#" -eq 2 ] || { usage; exit 2; } ;; start) [ "$#" -ge 2 ] && [ "$#" -le 3 ] || { usage; exit 2; } ;; *) usage; exit 2 ;; esac
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=v24.21.0
case "$(uname -m)" in x86_64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) echo 'x64 / ARM64のLinuxが必要です。' >&2; exit 1 ;; esac
runtime=${TASKOTTER_RUNTIME_DIR:-"$HOME/TaskOtter-runtime"}
case "$runtime" in /*) ;; *) echo 'TASKOTTER_RUNTIME_DIR は絶対パスを指定してください。' >&2; exit 2 ;; esac
node_dir="$runtime/node-$version-linux-$arch"
if [ "$1" = setup ]; then
  if [ ! -d "$node_dir" ]; then
    for tool in curl tar xz sha256sum awk mktemp; do
      command -v "$tool" >/dev/null 2>&1 || { echo "$tool が必要です。docs/wsl-direct.md を参照してください。" >&2; exit 1; }
    done
    mkdir -p -- "$runtime"
    download_dir=$(mktemp -d "$runtime/.download.XXXXXX")
    trap 'rm -rf -- "$download_dir"' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    archive="node-$version-linux-$arch.tar.xz"
    base="https://nodejs.org/dist/$version"
    curl --fail --location --proto '=https' --tlsv1.2 "$base/$archive" -o "$download_dir/$archive"
    curl --fail --location --proto '=https' --tlsv1.2 "$base/SHASUMS256.txt" -o "$download_dir/SHASUMS256.txt"
    awk -v file="$archive" '$2 == file {print}' "$download_dir/SHASUMS256.txt" > "$download_dir/checksum.txt"
    [ -s "$download_dir/checksum.txt" ] || { echo '公式チェックサムが見つかりません。' >&2; exit 1; }
    (cd "$download_dir" && sha256sum -c checksum.txt)
    tar -xJf "$download_dir/$archive" -C "$download_dir"
    [ -x "$download_dir/node-$version-linux-$arch/bin/node" ] || { echo 'Node.jsの展開に失敗しました。' >&2; exit 1; }
    # Do not replace an existing runtime, including one installed concurrently.
    [ ! -e "$node_dir" ] || { echo '同じ実行環境が既にあります。再実行してください。' >&2; exit 1; }
    mv -T -- "$download_dir/node-$version-linux-$arch" "$node_dir"
  fi
fi
[ -x "$node_dir/bin/node" ] && [ -f "$node_dir/bin/npm" ] || { echo '先に sh scripts/run-wsl-direct.sh setup を実行してください。' >&2; exit 1; }
export PATH="$node_dir/bin:$PATH"
export npm_config_cache="$runtime/npm-cache"
[ "$(node --version)" = "$version" ] || { echo '専用Node.jsのバージョンが一致しません。' >&2; exit 1; }
case "$1" in
  setup) echo "実行環境: $node_dir" ;;
  build)
    cd "$project_dir"
    npm ci --ignore-scripts
    npm audit
    npm run check
    npm run build
    ;;
  init|start)
    directory=$2
    [ -n "$directory" ] || { usage; exit 2; }
    port=${3:-3000}
    case "$port" in ''|*[!0-9]*) echo 'ポートは1～65535の整数を指定してください。' >&2; exit 2 ;; esac
    [ "${#port}" -le 5 ] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { echo 'ポートは1～65535の整数を指定してください。' >&2; exit 2; }
    [ -f "$project_dir/dist/server/main.js" ] && [ -f "$project_dir/dist/server/init.js" ] || { echo '先にbuildを実行してください。' >&2; exit 1; }
    mkdir -p -- "$directory"
    DATA_DIR=$(CDPATH= cd -- "$directory" && pwd -P)
    export DATA_DIR
    cd "$project_dir"
    if [ "$1" = init ]; then
      exec node dist/server/init.js
    else
      export HOST=127.0.0.1 PORT="$port"
      echo "TaskOtter: http://localhost:$port（停止: Ctrl+C）"
      exec node dist/server/main.js
    fi
    ;;
esac
