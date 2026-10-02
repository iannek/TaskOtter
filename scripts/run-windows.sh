#!/bin/sh
# Optional WSL bridge. Prefer run-windows.ps1 directly from Windows PowerShell.
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
script=$(wslpath -w "$project_dir/scripts/run-windows.ps1")
case "${1:-}" in
  init|up)
    directory=${2:?Usage: run-windows.sh init|up /mnt/c/PATH [PORT]}
    case "$directory" in /mnt/[a-zA-Z]/*) ;; *) echo '保存先は /mnt/c/... 形式で指定してください。Windowsからは run-windows.ps1 を使用してください。' >&2; exit 2 ;; esac
    windows_directory=$(wslpath -w "$directory")
    powershell.exe -NoProfile -File "$script" "$1" "$windows_directory" "${3:-3000}"
    ;;
  build|stop|start|delete) powershell.exe -NoProfile -File "$script" "$1" ;;
  *) echo 'Usage: run-windows.sh build|init DATA_DIRECTORY|up DATA_DIRECTORY [PORT]|stop|start|delete' >&2; exit 2 ;;
esac
