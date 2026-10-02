# WSL Ubuntuで直接起動する（専用Node.js）

Dockerを使わず、Ubuntu上でTaskOtterを実行します。Node.jsはユーザーの専用フォルダに展開し、npmキャッシュもそこに置きます。sudo、システムへのNode.js導入、グローバルnpmパッケージ、`.bashrc`の変更は行いません。PATHはスクリプト実行中だけ変更します。

## 初回の準備

WSLのUbuntuでプロジェクトのディレクトリを開きます。Ubuntu 24.04を推奨します。プロジェクトはUbuntu側（例：`~/projects/TaskOtter`）に置くと、Windowsマウント上より依存関係の展開が速くなります。保存先はWindows側も指定できます。

`curl`、`tar`、`xz`、`sha256sum`、`awk`、`mktemp`が必要です。足りないものがある場合はスクリプトが停止します。必要なら自分でUbuntuのパッケージを追加してください（curl / xzは `curl` / `xz-utils` パッケージ）。スクリプトからaptを実行しません。

```sh
sh scripts/run-wsl-direct.sh setup
sh scripts/run-wsl-direct.sh build
sh scripts/run-wsl-direct.sh init '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data'
sh scripts/run-wsl-direct.sh start '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data' 3000
```

`YOUR_NAME`を実際のWindowsユーザー名に置き換えます。Windowsブラウザで `http://localhost:3000` を開きます。ターミナルを開いたまま使用し、**Ctrl+C**で停止します。常駐サービスや自動起動設定は作成しません。

`setup`は[公式Node.js v24.21.0配布](https://nodejs.org/en/download/archive/v24.21.0)からCPUに合わせてLinux x64 / ARM64版を取得します。HTTPSで取得した公式SHASUMS256.txtとのSHA-256照合後に展開します（署名検証は行いません）。実行環境があれば再ダウンロードしません。バージョンはスクリプトで固定しています。

`build`は `npm ci --ignore-scripts` → `npm audit` → `npm run check` → `npm run build` の順です。エラーや監査の脆弱性報告があれば、その段階で停止します。ciはロックファイルのバージョンを使い、package.json / package-lock.jsonを書き換えません。既存node_modulesは再作成されるため、他OSとの共用は避けてください。

`init`は初回のみです。既存の `taskotter.json` がある場合は省略します。初期化で既存ファイルを上書きしません。保存先は必須で、指定したフォルダの `taskotter.json` を使用します。空白・日本語のパスは引用符で囲みます。相対パスは実行したディレクトリから解決します。

## 次回の起動・更新・保存先変更

次回はstartだけ実行します。ポート省略時は3000です。

```sh
sh scripts/run-wsl-direct.sh start '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data'
```

更新時はCtrl+Cで停止し、コードを更新してbuild、startを実行します。保存先変更は停止後、startに新しいフォルダを指定します。データを引き継ぐなら停止した状態でtaskotter.jsonをコピーし、initを実行しません。空の保存先にはinitを実行してください。Docker/wslc方式から引き継ぐ場合も、旧コンテナを停止してから起動します。同じJSONを複数のアプリから同時に更新しないでください。

127.0.0.1のみで待ち受けます。Windowsからのlocalhost接続は[WSLの公式ネットワーク資料](https://learn.microsoft.com/en-us/windows/wsl/networking)を参照してください。接続できない場合はまずUbuntu内で `curl http://127.0.0.1:3000` を確認します。ポート使用中なら3001などを指定します。保存ファイルがない・不正の場合は画面に原因を表示し、自動初期化はしません。

## 作成されるもの・片付け方

| 場所 | 内容 |
| --- | --- |
| `~/TaskOtter-runtime/node-v24.21.0-linux-x64` または `...-arm64` | 専用Node.jsと同梱npm |
| `~/TaskOtter-runtime/npm-cache` | npmキャッシュ |
| プロジェクト内 `node_modules` / `dist` | 依存関係・ビルド成果物 |
| 指定した保存フォルダ | taskotter.json |

実行環境の場所を変える場合は、**すべての操作で同じ設定**を使用します。

```sh
export TASKOTTER_RUNTIME_DIR="$HOME/apps/TaskOtter-runtime"
sh scripts/run-wsl-direct.sh setup
# build / init / start もこの設定のまま実行
```

片付ける場合はアプリを停止し、専用実行環境・プロジェクトのnode_modulesとdistを削除します。タスクの保存フォルダは別に保持してください。元のPATHやシステム設定を戻す作業は不要です。

Linux上でスクリプトの引数・チェックサム失敗処理などを検証しています。WSL実機のWindowsマウントでの保存、Windowsブラウザ接続は未検証です。
