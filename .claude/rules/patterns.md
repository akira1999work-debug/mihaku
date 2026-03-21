---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# パターン

> ECC patterns をmihaku (React Native / Expo) 向けに統合。

## 実装前リサーチ（必須）

新機能を書く前に:
1. `gh search code` で既存実装を探す
2. npm registryで既存パッケージを探す
3. Expo SDK / React Native のドキュメントで公式APIを確認する
4. 車輪の再発明より、実績あるライブラリの採用を優先する

## カスタムフック

ロジックの再利用はカスタムフックで:

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

## データアクセス

Supabase等のデータアクセスはリポジトリパターンで抽象化:
- 標準操作: findAll, findById, create, update, delete
- ビジネスロジックはストレージ詳細に依存しない
- テスト時のモック差し替えを容易にする

## API レスポンス

一貫したレスポンス形式を使う:
- success/status インジケータ
- data ペイロード（エラー時は null）
- error メッセージ（成功時は null）
