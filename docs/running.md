# コンテナ起動手順

Node 24、Svelte、Fastifyを共通の `Containerfile` にまとめます。アプリと保存先を分け、ホスト側ディレクトリを `/data` にマウントします。起動・初期化・保存先変更は別の操作です。

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

## Windows（WSL Ubuntu）

WSL 2.9.3以降と `wslc.exe` が必要です。[Microsoftの公式手順](https://learn.microsoft.com/en-us/windows/wsl/tutorials/wsl-containers) を確認してください。Ubuntuのターミナルから実行します。

```sh
sh scripts/run-windows.sh build
sh scripts/run-windows.sh init '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data'
sh scripts/run-windows.sh up '/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data' 3000
```

Windowsブラウザで `http://localhost:3000` を開きます。保存先にはWindowsのディレクトリを `/mnt/c/...` 形式で渡し、スクリプトが `wslpath` で変換します。

```sh
sh scripts/run-windows.sh stop
sh scripts/run-windows.sh start
```

これらのスクリプトは本環境（Linux開発コンテナ）では実機実行していません。特にWSLのビルドコンテキストとWindowsパスのマウント・公開ポートは実機で確認が必要です。失敗時は `wslc.exe build --help`、`wslc.exe run --help` で利用中のCLIの仕様を確認してください。

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
