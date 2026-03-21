---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# TypeScript コーディングスタイル

> ECC (everything-claude-code) のcommon/coding-style + typescript/coding-styleをmihaku向けに統合。

## 型定義

- exportする関数には引数・戻り値の型を明示する
- ローカル変数の自明な型は推論に任せる
- 繰り返すオブジェクト形状は named type/interface に抽出する
- `interface` はオブジェクト形状（拡張可能性あり）、`type` はunion/intersection/utility用
- string literal union > enum（相互運用性が必要な場合を除く）
- `any` 禁止。外部入力は `unknown` で受けて narrowing する

## React Native コンポーネント

- props は named interface/type で定義する
- `React.FC` は使わない
- コールバック props は型を明示する

```typescript
interface TaskCardProps {
  task: Task
  onRelease: (taskId: string) => void
}

function TaskCard({ task, onRelease }: TaskCardProps) {
  // ...
}
```

## イミュータビリティ（必須）

- オブジェクトの直接変更禁止。スプレッド演算子で新しいオブジェクトを返す
- 配列も `.push()` ではなく `[...arr, newItem]`
- Reactの state 更新は常にイミュータブルに

## ファイル構成

- 1ファイル 200-400行目安、800行上限
- 機能/ドメイン単位で整理（型別ではなく）
- 大きくなったモジュールからユーティリティを抽出する

## エラーハンドリング

- async/await + try-catch
- `catch (error: unknown)` で受けて `instanceof Error` で narrowing
- エラーを握り潰さない
- UI向けにはユーザーフレンドリーなメッセージ、ログには詳細なコンテキスト

## コード品質チェック

- 関数は50行以内
- ネストは4段以下
- ハードコードの値は定数/設定に切り出す
- `console.log` は本番コードに残さない
