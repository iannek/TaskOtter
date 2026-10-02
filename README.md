# TaskOtter

ローカルで動く個人用タスク管理ツールです。Svelteのブラウザ画面とFastify APIを1つのNode.jsプロセスから配信し、Task・Outcome・設定をホスト側の `taskotter.json` に保存します。

- ダッシュボード：残数・完了数、今日の対応予定期間、日付で絞り込める次の対応予定
- Task・Outcome：階層一覧とOutcomeカード、名前だけでInboxへ追加、サイドバーから編集・削除
- ガント：親子の期間、無期限の両端、カテゴリ・ステータスの絞り込み、表示順、期間外の警告
- カレンダー：日・日曜始まりの週・月、締切、時間帯、重複予定、Done表示切り替え
- 外部JSON更新の読み込み、Schemaと業務ルールの検証、不正ファイルの保存禁止

## 起動

WindowsのPowerShell（WSLコンテナー）、WSL UbuntuのDocker Engine、MacでホストにNode.jsを入れずに利用する手順は [コンテナ起動手順](docs/running.md) を参照してください。

現在の開発コンテナ内では次のコマンドで起動できます。データの初期化は初回のみです。既存ファイルがあれば初期化コマンドは失敗し、上書きしません。

```sh
npm ci --ignore-scripts
npm run init
npm run check
npm run build
HOST=0.0.0.0 npm start
```

同じPCのブラウザで `http://localhost:3000` を開きます。開発コンテナを使う場合は、起動時にホストの `127.0.0.1:3000` からコンテナの3000番への公開が必要です。保存先は `DATA_DIR` 環境変数（既定 `./data`）で指定します。コンテナの利用時にはホストの保存ディレクトリをマウントしてください。

開発用ホットリロードは `npm run dev`（画面5173番、API3000番）です。本番利用では `npm run build` と `npm start` を使用します。

## 検証

```sh
npm audit
npm run check
npm run build
npm test
npx playwright install --with-deps chromium
npm run test:e2e
```

PlaywrightのOSライブラリのインストールには開発コンテナの管理者権限が必要です。ブラウザテストは一時データを使用し、通常の保存先を変更しません。500件の表示・画面切り替えの測定結果は `test-results/performance.json` に出力します。

## 資料

- [要件](ドキュメント/要件.md)
- [技術構成・アーキテクチャ](ドキュメント/技術構成・アーキテクチャ.md)
- [保存データとAPIの仕様](docs/data-and-api.md)
- [検証結果と実機確認](docs/verification.md)
- [Macの開発コンテナ](docs/mac-development-container.md)

- [要件別の実装状況](ドキュメント/実装状況.md)
- [確認結果・追加要望と反映状況](ドキュメント/確認結果・追加要望.md)

WSL UbuntuにDockerを導入して使う場合は [Docker起動手順](docs/wsl-docker.md) と [起動スクリプト](scripts/run-wsl-docker.sh) を参照してください。

WSL Ubuntuでシステムへのインストールを避けて直接動かす場合は、[専用Node.js起動手順](docs/wsl-direct.md)を参照してください。
