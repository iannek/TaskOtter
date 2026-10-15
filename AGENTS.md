# 依存パッケージのメンテナンス

- 機能修正・依存更新の仕上げには `npm run security:verify` を実行し、監査・型チェック・単体/APIテスト・ビルドを確認する。
- 修正を依頼された作業で脆弱性を検出した場合は、`npm run security:fix` で互換範囲内の修正と再検証を行う。監査・確認だけを依頼された場合は、結果を報告して依存を変更しない。
- 定常修正で `npm audit fix --force` は使わない。通常の修正で解消できない場合は、依存経路・必要な更新・互換性の問題を調べ、未解決事項を明記する。
- 依存更新後は `npm run test:e2e` でブラウザ操作も確認する。環境上実行できない検証は、実施済みとして扱わず制限を報告する。
- `package.json` と `package-lock.json` の差分、最終監査結果、検証結果を確認し、必要に応じて `docs/verification.md` を更新する。
- 詳細な手順とGitHubの週次運用は `docs/dependency-security.md` を参照する。
