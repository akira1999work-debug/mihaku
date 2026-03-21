---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# セキュリティ

> ECC security rules をmihaku向けに統合。

## コミット前チェック（必須）

- [ ] ハードコードされたシークレットがないこと（APIキー、パスワード、トークン）
- [ ] ユーザー入力がバリデーションされていること
- [ ] エラーメッセージが機密情報を漏らさないこと
- [ ] 認証・認可が正しく検証されていること

## シークレット管理

- シークレットをソースコードにハードコードしない
- 環境変数または Expo の `.env` + `expo-constants` を使う
- 必須シークレットは起動時にバリデーションする
- `.env` ファイルは `.gitignore` に含める

```typescript
// NG: ハードコード
const apiKey = "sk-proj-xxxxx"

// OK: 環境変数
const apiKey = Constants.expoConfig?.extra?.supabaseKey
if (!apiKey) {
  throw new Error('SUPABASE_KEY not configured')
}
```

## 入力バリデーション

- システム境界（ユーザー入力、API応答）では必ずバリデーション
- スキーマベースのバリデーション（Zod等）を推奨
- 外部データを信頼しない

## セキュリティ問題発見時

1. 即座に停止
2. **security-reviewer** エージェントを使用
3. CRITICALは続行前に修正
4. 漏洩した可能性のあるシークレットはローテーション
