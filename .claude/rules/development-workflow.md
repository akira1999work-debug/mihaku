---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# 開発ワークフロー

> ECC development-workflow をmihaku向けに統合。

## 機能実装フロー

### 0. リサーチ & 再利用（実装前に必須）

- `gh search code` で既存実装を探す
- Expo / React Native のドキュメントでAPI確認
- npm で既存パッケージを確認（自作より実績あるライブラリ優先）
- 80%以上解決できるOSSがあれば、採用・ラップ・フォークを検討

### 1. 計画

- **planner** エージェントで実装計画を作成
- 依存関係とリスクを特定
- フェーズに分解

### 2. TDD

- **tdd-guide** エージェントを使用
- テスト先行 → 最小実装 → リファクタリング
- カバレッジ 80%+ を確認

### 3. コードレビュー

- コード書いた直後に **code-reviewer** エージェントを使用
- CRITICAL / HIGH は必ず対処
- MEDIUM はできる限り対処

### 4. コミット

- conventional commits 形式
- `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

## ビルド失敗時

1. **build-error-resolver** エージェントを使用
2. エラーメッセージを分析
3. インクリメンタルに修正
4. 修正ごとに検証
