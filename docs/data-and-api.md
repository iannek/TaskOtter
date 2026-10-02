# 保存データとAPI

## ファイルと初期化

保存先の `taskotter.json` 1ファイルに全件を保存します。空の保存データを作成する操作は明示的な `npm run init`（コンテナでは起動スクリプトの `init`）のみです。サーバーは欠落したファイルを自動作成しません。初期化は排他的な新規作成で、既存ファイルを上書きしません。

JSON Schemaは [schemas/taskotter.schema.json](../schemas/taskotter.schema.json) です。生成元は `src/shared/schema.ts`、TypeScript型もこのSchemaから得ます。Schemaを変更したときは `npm run init -- --schema` で書き出します。両者の一致はテストで確認します。

```json
{
  "schemaVersion": 1,
  "settings": { "timeStep": 15 },
  "tasks": [
    {
      "id": "task-unique-id",
      "name": "資料を確認する",
      "memo": "自由記述",
      "category": "プロジェクト",
      "status": "Inbox",
      "due": "2026-10-09",
      "start": "before",
      "end": "2026-10-09",
      "next": "2026-10-02T09:15",
      "nextEnd": "10:30",
      "outcomeId": "outcome-unique-id"
    }
  ],
  "outcomes": [
    {
      "id": "outcome-unique-id",
      "name": "提案を提出する",
      "memo": "",
      "start": "2026-10-01",
      "end": "2026-10-09",
      "priority": "High",
      "complete": false
    }
  ]
}
```

- ファイル内ではSchemaで指定した全項目が必須です。任意項目の未設定は空文字 `""` です。未知の項目・不正な型は拒否し、変換・削除しません。
- IDはTask・Outcome全体で一意な空でない文字列です。外部AIもIDを割り当てられます。UI/APIの新規作成ではサーバーがUUIDを割り当てます。
- Taskのステータスは `Inbox / NextAction / Waiting / Doing / Done / Someday`。カテゴリは任意の文字列です。
- 日付は `YYYY-MM-DD`、次の対応予定はタイムゾーンを持たないローカル日時 `YYYY-MM-DDTHH:mm` と終了時刻 `HH:mm`。開始・終了は同日で終了が後、時刻は00:00～23:59。画面の選択間隔は15分または30分ですが、外部データはこの間隔に限定しません。
- 期間は両端が未設定か、両端が設定された状態です。Taskの開始には `before`（以前）、終了には `after`（以降）も使えます。画面ではTaskの片側の日付を空欄にすると、もう片側の日付に応じて `before` / `after` を補完して保存します。両方空欄なら両端を空文字として保存します。APIや外部JSONでは引き続き両端を明記します。Outcomeには日付のみ設定できます。日付同士では終了は開始以降です。
- 今日と時間表示はブラウザを実行するPCのタイムゾーンを使用します。日付のみの値をUTC日時へ変換して保存しません。コンテナのタイムゾーンは判定に影響しません。
- Outcome完了時に未完了の子TaskがあるJSONは不正です。外部AIがTaskをDone以外へ変えるときは親の `complete` もfalseへ変更してください。

## API

全APIは同じオリジンの `/api` にあります。成功時は更新後の全データをJSONで返します。読み込みは `Cache-Control: no-store`。APIの入力は型変換や不明項目の削除を無効にして検証します。

| メソッド | パス | 入力と動作 |
| --- | --- | --- |
| GET | `/api/data` | ディスクのJSONを毎回読み込み、Schema・業務ルールを検証 |
| POST | `/api/tasks` | Taskの全フィールド（idは省略または空も可）。idはサーバーで生成 |
| PUT | `/api/tasks/:id` | Taskの全フィールド。対象Taskのみ置換。URLのidを保持 |
| DELETE | `/api/tasks/:id` | 指定Taskを削除 |
| POST | `/api/tasks/with-outcome` | `{ "task": Taskの全フィールド, "newOutcomeName": "名前" }`。Taskと新規Outcomeを一回で保存。Taskのidは省略・空も可 |
| PUT | `/api/tasks/with-outcome/:id` | 同じ入力で、既存Taskを更新し新規Outcomeへ紐づける。Taskのidは必須。URLのidを保持 |
| POST | `/api/outcomes` | Outcomeの全フィールド（idは省略または空も可）。idはサーバーで生成 |
| PUT | `/api/outcomes/:id` | Outcomeの全フィールド。対象Outcomeのみ置換 |
| DELETE | `/api/outcomes/:id` | 指定Outcomeを削除し、TaskのoutcomeIdだけ空にする |
| PUT | `/api/settings` | `{ "timeStep": 15 }` または30 |

UIの名前だけの追加では、他の項目を未設定・InboxにしてPOSTします。PUTは対象レコード全体を置換します。外部AIと同じTaskを編集した場合は後から保存したTaskの内容を優先し、無関係のTask・Outcomeはディスクから読み込んだ内容を維持します。アプリ内の変更要求は直列化します。外部エディタとのロック・競合検知は設けません。

Taskを未完了で登録・変更すると紐づくOutcomeの完了を解除します。子Taskが全てDoneになっても親の完了は自動で付きません。0件のOutcomeも手動で完了にできます。

エラーは `{ "error": "説明", "details": ["問題のパスと内容"] }`（detailsはデータ検証時のみ）です。400は入力形式、404は対象なし、409は同名Outcomeの競合、422はJSON・業務ルール不正、503は保存ファイル読み込み失敗、500は保存処理失敗です。画面にデータ不正を表示した間はフォームと保存を無効にし、APIも現在の不正ファイルを上書きしません。外部で修正後、画面の再読み込みで再開できます。

保存は同じディレクトリの一時ファイルへ書き込み・fsync後にrenameします。途中で失敗した場合は元ファイルを保持し、一時ファイルを片付けます。外部AIが同時に書く場合はアプリ内の直列化の対象外です。復元には保存ディレクトリの外部バックアップを利用してください。


Outcome同時作成APIでは、TaskのoutcomeIdは空文字で指定する。Outcome名は前後の空白を除去し、同名の既存Outcomeがあれば409で拒否する。サーバーでIDを生成し、Outcomeは期間なし・優先度Medium・未完了とする。新規OutcomeとTaskの追加・更新は一回の検証・ファイル置換で確定し、途中失敗でOutcomeだけが残ることはない。
