# 起動手順

Node 24、Svelte、Fastifyを共通の `Containerfile` にまとめます。アプリと保存先を分け、ホスト側ディレクトリを `/data` にマウントします。起動・初期化・保存先変更は別の操作です。

## Windows（WSL Ubuntuから直接起動）

環境への変更を少なくしたい場合は、[専用Node.jsで直接起動する手順](wsl-direct.md)を利用してください。`scripts/run-wsl-direct.sh` が専用実行環境の準備・ビルド・保存先の初期化・起動を行います。DockerやシステムへのNode.jsインストールは不要です。

## Mac

2026-10-02に利用者がApple containerでの起動・画面確認を実施済み。保存・接続制限・性能などの個別確認と、追加要望反映後の再確認は残っています。

Apple Silicon、macOS 26、Apple `container` が必要です。[公式コマンド資料](https://github.com/apple/container/blob/main/docs/command-reference.md) に従ってループバックのみへポートを公開します。

```sh
container system start
sh scripts/run-mac.sh build
sh scripts/run-mac.sh init "$HOME/Documents/TaskOtter data"
sh scripts/run-mac.sh up "$HOME/Documents/TaskOtter data" 3000
```

ブラウザで `http://localhost:3000` を開きます。`init` は初回のみで、既存JSONがある場合は実行不要です。

```sh
sh scripts/run-mac.sh stop
sh scripts/run-mac.sh start
```

イメージ更新・保存先変更では停止後に `sh scripts/run-mac.sh delete` でコンテナを削除し、build/upを実行します。マウントされたホストのデータは削除されません。

## Windows（WSL Ubuntu + Docker Engine）

wslc方式が動かない場合や、従来のDocker Engineを使用したい場合は、[WSL UbuntuのDocker起動手順](wsl-docker.md)を利用してください。Dockerの導入から、保存先指定・起動・更新・既存データの引き継ぎまで記載しています。

Docker導入済みのUbuntuでの起動例：

```sh
export TASKOTTER_DOCKER_SUDO=1
sh scripts/run-wsl-docker.sh build
sh scripts/run-wsl-docker.sh init '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data'
sh scripts/run-wsl-docker.sh up '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data' 3000
```

sudoなしでDockerを利用できる場合はexport不要です。既存JSONがある場合はinit不要です。Windowsブラウザで `http://localhost:3000` を開きます。

## Windows（PowerShellから直接実行）

WindowsのPowerShellから、WSLに組み込まれた `wslc.exe` を直接使用します。Ubuntuのインストール・起動や、ホスト側のNode.js・Docker Desktopのインストールは必要ありません。コンテナ内のLinux環境はWSLが管理します。[Microsoftの公式手順](https://learn.microsoft.com/en-us/windows/wsl/tutorials/wsl-containers) はPowerShellからの実行を案内しています。

2026-10-02に公式情報を確認した時点では、最新安定版は **WSLパッケージ3.0.1**、WSLコンテナーの正式公開は2026-09-29です。[公式リリース](https://github.com/microsoft/WSL/releases/tag/3.0.1)、[正式公開の案内](https://blogs.windows.com/windowsdeveloper/2026/09/29/wsl-containers-now-generally-available/) を参照してください。Microsoft Learnに記載されている機能の最小バージョンは2.9.3ですが、この手順では `wsl --update` で安定版へ更新して利用します。WSLパッケージの3.xと、Linux実行方式の「WSL 2」（`wsl --list --verbose` のVERSION）は別の番号です。

### WSLの準備（初回）

WSLが未導入の場合は、管理者PowerShellで次を実行し、Windowsから再起動を求められたら再起動します。`--no-distribution` はUbuntuなどのディストリビューションを追加しない指定です。[WSLの公式コマンド資料](https://learn.microsoft.com/en-us/windows/wsl/basic-commands) を参照してください。

```powershell
wsl --install --no-distribution
```

WSLが導入済みならインストールは不要です。PowerShellで更新と利用可能なCLIを確認します。通常のTaskOtter操作はWindowsのPowerShellで行います。

```powershell
wsl --update
wsl --version
wslc.exe version
```

### ビルド・初期化・起動

プロジェクトをWindows側のディレクトリに置き、そのディレクトリでPowerShellを開きます。Windows PowerShell 5.1またはPowerShell 7を使用できます。保存先は `C:\...` や `D:\...` の絶対パスを指定します。空白・日本語・角括弧を含む場合も引用符で囲んで一つの引数として渡します。

```powershell
$dataDirectory = Join-Path $env:USERPROFILE 'Documents\TaskOtter data'
.\scripts\run-windows.ps1 build
.\scripts\run-windows.ps1 init $dataDirectory
.\scripts\run-windows.ps1 up $dataDirectory 3000
```

Windowsブラウザで `http://localhost:3000` を開きます。保存先は `$dataDirectory\taskotter.json` です。保存先を省略するとエラーになり、既定の保存先は作りません。`init` は空の保存先への初回のみ実行し、既存JSONがある場合は不要です。初期化は既存ファイルを上書きせず、CLI失敗時はスクリプトもエラーで停止します。

```powershell
.\scripts\run-windows.ps1 stop
.\scripts\run-windows.ps1 start
```

イメージ更新では停止・コンテナ削除・ビルド・再作成を行います。

```powershell
.\scripts\run-windows.ps1 stop
.\scripts\run-windows.ps1 delete
.\scripts\run-windows.ps1 build
.\scripts\run-windows.ps1 up $dataDirectory 3000
```

`delete` はコンテナのみを削除し、Windowsの保存ディレクトリは削除しません。保存先を変更する場合もstop/delete/upで再作成し、新しい保存先が空なら初回のみinitを実行します。既存タスクを引き継ぐ場合は、停止後に `taskotter.json` を新しい保存先へコピーします。

スクリプトの実行がPowerShellの実行ポリシーで拒否された場合は、信頼するファイルか確認し、組織のポリシーに従って実行を許可してください。スクリプトからポリシーは変更しません。

### 既存のWSLターミナルから使う場合

以前の `scripts/run-windows.sh` は互換用として残しています。`/mnt/c/...` の保存先をWindowsパスに変換し、Windows PowerShellの新スクリプトを呼びます。WSLターミナルからの利用は任意で、Windowsから実行する場合は不要です。

```sh
sh scripts/run-windows.sh up '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data' 3000
```

### 検証範囲とトラブル確認

Linux環境のPowerShell 7で構文・CLIの引数・失敗処理を検証しました。Windows PowerShell 5.1、実際の `wslc.exe` によるビルド・Windowsパスのマウント・保存・再起動後の保持・ポート公開はWindows実機での検証が必要です。問題がある場合はPowerShellで以下を確認してください。

```powershell
wslc.exe build --help
wslc.exe run --help
wslc.exe container list --all
wslc.exe container logs taskotter
```

## 保存先・接続

- 保存先を変更するときは停止・コンテナ再作成を行います。空の新規保存先には初期化が必要です。
- ポート公開は必ず `127.0.0.1:<ホスト側ポート>:3000`。LAN全体への公開を行わないでください。
- コンテナ内は `HOST=0.0.0.0` で待ち受けます。ホスト側のループバック公開とは別の設定です。
- 保存ファイルがない、不正、読み込めない場合もサーバーは起動し、ブラウザに原因を表示します。空データでの上書きは行いません。
- 日本語・空白を含む保存先、再起動後の保持、保存失敗時のrename動作、別端末から接続できないこと、500件で5秒以内という性能条件は実際の保存先で確認します。

## 開発コンテナ

既存の [Mac開発コンテナ手順](mac-development-container.md) を使えます。アプリをブラウザで開く場合、開発コンテナの `up` に次の公開設定を加え、停止・削除・再作成します。

```sh
--publish 127.0.0.1:3000:3000
--publish 127.0.0.1:5173:5173
```

ブラウザテスト用のChromium依存ライブラリは管理者権限でコンテナ内に追加します。

```sh
container exec --user root taskotter-dev sh -c 'cd /workspace && npx playwright install-deps chromium'
```

その後開発ユーザーで `npx playwright install chromium`、`npm run test:e2e` を実行します。ブラウザ検証用のOSライブラリはアプリ実行イメージには不要です。

## 更新後の画面が変わらない場合

既存Taskにも詳細4タブが表示されます。表示が旧版のままなら、実行中のアプリが更新されているかを確認してください。コンテナはイメージをbuildしただけでは更新されません。stop → delete → build → 同じ保存先でupを実行し、ブラウザを強制再読み込みします（MacはCommand＋Shift＋R、WindowsはCtrl＋F5）。既存JSONのinitは不要です。

Macの更新例（保存先・ポートは現在使用している値に合わせる）：

```sh
sh scripts/run-mac.sh stop
sh scripts/run-mac.sh delete
sh scripts/run-mac.sh build
sh scripts/run-mac.sh up "$HOME/Documents/TaskOtter data" 3000
```

WSL Ubuntuで直接起動している場合は、Ctrl＋Cで停止 → `sh scripts/run-wsl-direct.sh build` → 同じ保存先で `sh scripts/run-wsl-direct.sh start '/使用中の保存先' 3000` を実行します。Docker方式やPowerShell方式も各起動スクリプトのstop／delete／build／upを使います。保存先の変更やJSONの初期化で画面を更新する必要はありません。

## カレンダーの操作

空白のダブルクリックによる追加、予定の移動と上下端の時間調整、週・月の締切移動の手順は[カレンダーの操作](calendar.md)を参照してください。更新時は上記の再ビルド・再起動を行い、現在の保存先を引き続き利用します。初期化は不要です。
