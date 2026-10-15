# 依存パッケージの脆弱性確認と修正

## 手元で確認・修正する

Node.js 24以降の開発環境で、リポジトリのルートから実行する。

```sh
npm ci --ignore-scripts
npm run security:check
```

`security:check` は開発用依存を含む `npm audit`。レジストリへのネットワーク接続が必要で、接続エラーも失敗として扱う。

脆弱性が見つかったら、次で修正と検証をまとめて実行できる。

```sh
npm run security:fix
```

`npm audit fix --ignore-scripts` で通常の修正を適用し、成功した場合に再監査・型チェック・単体/APIテスト・ビルドを実行する。途中で失敗した場合は終了コードが非0になり、後続処理を止める。修正できない脆弱性が残る場合も失敗する。依存のインストールスクリプトは自動実行しない。

依存更新後はブラウザテストも実行する。Chromiumの準備は初回またはPlaywrightの更新時に必要。

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

OSライブラリのインストールには管理者権限が必要。コンテナ内で修正した場合、変更した `package.json` と `package-lock.json` がホスト側のチェックアウトにも残っていることを確認する。

`git diff -- package.json package-lock.json` で更新内容を確認し、検証結果とともにコミットする。`--force` は定常手順に含めない。通常のfixで直せない場合は監査結果の依存経路を確認し、必要な直接依存の更新と互換性の検証を行う。今回の修正例は [検証記録](verification.md) を参照。

## GitHubで継続的に確認する

[Dependabot設定](../.github/dependabot.yml)はnpmとGitHub Actionsの更新を毎週月曜09:00（日本時間）に確認する。npmはメジャー更新を自動提案の対象から外し、minor／patchの更新をまとめたPRを作る。メジャー更新が必要な修正は手動対応する。

[自動検証](../.github/workflows/dependency-security.yml)はpush・PR・手動実行・毎週月曜09:17（日本時間）の定期実行に対応する。Node.js 24でロックファイルから依存を復元し、監査・型チェック・単体/APIテスト・ビルド・Chromiumのブラウザテストを実施する。定期監査により、ロックファイルが変わらなくても新しい脆弱性情報を確認できる。

この設定はコミットしてGitHubの既定ブランチへ反映後に利用できる。リポジトリでGitHub ActionsとDependabot version updatesが利用可能であることが前提。設定ファイルの追加だけで既存のGitHub管理設定やブランチ保護ルールを変更するものではなく、自動マージも設定していない。更新PRの差分と検証結果を確認してマージする。

今後の修正作業で同じ検証を継続するため、[AGENTS.md](../AGENTS.md) にも監査・通常の修正・再検証の手順を記載した。

GitHub Actionsを使わない環境でも、上記の手元のコマンドで同じ確認・修正を継続できる。

参考：[Dependabotの公式設定手順](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates)、[setup-node](https://github.com/actions/setup-node)、[checkout](https://github.com/actions/checkout)。
