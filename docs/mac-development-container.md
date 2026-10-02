# Mac の開発コンテナ

TaskOtter のソース一式を Mac からマウントし、Linux コンテナ内で Node.js と Codex CLI を使って開発する手順です。アプリの実行用イメージとは独立した開発環境です。アプリのソースと `package.json` は実装済みです。実行用イメージとデータ保存先は [コンテナ起動手順](running.md) を参照してください。

## 構成

| 対象 | 場所 |
| --- | --- |
| Mac 上の作業ディレクトリ | `/Users/naito/Workspace/IT/TaskOtter` |
| コンテナ内の作業ディレクトリ | `/workspace` |
| 開発イメージ | `taskotter-dev:local` (`dev/Containerfile`) |
| 開発コンテナ | `taskotter-dev` |
| Codex の設定・ログイン情報 | 名前付きボリューム `taskotter-dev-codex` → `/home/dev/.codex` |

`/workspace` は読み書き可能なバインドマウントです。コンテナで編集したファイルは Mac の作業ディレクトリに直接反映されます。ビルド時に Mac の UID/GID と同じ `dev` ユーザーを作り、コンテナ内の開発コマンドをそのユーザーで実行します。Codex の認証情報はリポジトリに入れません。

## 前提

- Apple Silicon の Mac と macOS 26。Apple `container` の公式サポート条件です。
- Apple の [リリースページ](https://github.com/apple/container/releases)から `container` をインストール済みであること。
- イメージのビルド、Codex のログイン・利用にインターネット接続があること。
- Mac 側で `/Users/naito/Workspace/IT/TaskOtter` に書き込めること。

この Mac では確認時点で `container` 1.5.0、macOS 26.6.2、arm64 が検出されています。

## 初回セットアップ

Mac のターミナルで以下を実行します。`container system start` が初回設定を求めた場合は画面の案内に従います。

```sh
cd /Users/naito/Workspace/IT/TaskOtter
container system start
sh scripts/dev-container.sh build
sh scripts/dev-container.sh up
sh scripts/dev-container.sh shell
```

コンテナ内で以下を確認します。

```sh
pwd
node --version
npm --version
codex --version
git status --short
test -w /workspace && echo 'workspace is writable'
id
```

`pwd` が `/workspace` を示し、書き込み確認が成功すれば、マウントしたソースを編集できます。`exit` でシェルを閉じても開発コンテナは動作し続けます。

## Codex にログインして開発する

Mac のターミナルから次を実行します。

```sh
cd /Users/naito/Workspace/IT/TaskOtter
sh scripts/dev-container.sh shell
codex login --device-auth
codex login status
codex
```

デバイス認証の画面に表示される URL を Mac のブラウザで開き、ワンタイムコードを入力します。ChatGPT 側のセキュリティ設定、または組織の管理設定でデバイス認証を有効にする必要があります。ログイン情報は `taskotter-dev-codex` ボリュームに残るので、コンテナを削除・再作成しても再利用できます。認証情報を含むボリュームは共有しないでください。

Codex を直接開くときは、Mac から `sh scripts/dev-container.sh codex` も使えます。Codex の最初の依頼例は「`要件.md` と `技術構成・アーキテクチャ.md` を読み、次に実装すべき最小単位を提案して」です。

## 日常の操作

```sh
sh scripts/dev-container.sh up       # 停止中のコンテナを再開
sh scripts/dev-container.sh shell    # 開発用シェル
sh scripts/dev-container.sh codex    # Codex CLI
sh scripts/dev-container.sh status   # 状態確認
sh scripts/dev-container.sh stop     # 停止
```

`dev/Containerfile` を変更した場合や Codex CLI を更新したい場合は、次のように再作成します。作業ファイルと Codex ボリュームは残ります。

```sh
sh scripts/dev-container.sh stop
sh scripts/dev-container.sh delete
sh scripts/dev-container.sh build
sh scripts/dev-container.sh up
```

`delete` は停止済みの開発コンテナを消します。`taskotter-dev-codex` ボリュームは消しません。ログイン情報を消す場合のみ、停止・削除後に `container volume delete taskotter-dev-codex` を実行してください。

## アプリ実装後の開発コマンド

`shell` でコンテナに入り、`npm ci --ignore-scripts`、`npm run init`（初回のみ）、`npm run dev`、`npm test` などを実行します。実際のスクリプト名はその時点の `package.json` を確認してください。Mac 側に Node.js を入れる必要はありません。

Vite や Fastify を Mac のブラウザから開くときは、コンテナ内のサーバーを `0.0.0.0` で待ち受けさせ、コンテナ起動時に必要なポートを `--publish 127.0.0.1:<Mac側>:<コンテナ側>` で公開します。現在の開発コンテナにはポートを公開していません。ポート構成が確定したら `scripts/dev-container.sh` の `up` に追加し、停止・削除・再作成してください。

## 確認事項と制約

- `container` の操作は Mac のターミナルから実行します。Codex や npm はコンテナ内から実行します。
- ソースのマウントは同期コピーではありません。コンテナからの変更は Mac 側の同じファイルへの変更です。
- Mac のアカウント UID/GID を変更した場合は、開発イメージを再ビルドし、コンテナを再作成してください。
- 開発イメージに入る Codex CLI はビルド時の最新版です。更新するにはイメージを再ビルドします。
- アプリ本体用の `Containerfile`、JSONデータの `/data` マウント、公開ポートは [コンテナ起動手順](running.md) に定義しています。

## 公式資料

- [Apple container の導入](https://github.com/apple/container/blob/main/README.md)
- [Apple container のコマンド](https://github.com/apple/container/blob/main/docs/command-reference.md)
- [Apple container のマウント](https://github.com/apple/container/blob/main/docs/volumes.md)
- [OpenAI Docs: Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [OpenAI Docs: 認証とデバイス認証](https://learn.chatgpt.com/docs/auth)
