# mihaku docs

mihaku のプロダクト仕様と関連リサーチをまとめたフォルダ。

## 構成

```
docs/
├── product/                    現行のプロダクト仕様（正）
│   ├── spec.md                 仕様書 — 迷ったらここ
│   ├── glossary.md             内部用語集（キャラ・Phase 等）
│   └── home-mockup.png         ホーム画面モック
└── research/                   設計の根拠資料
    ├── competitor-analysis.md  競合・参考アプリ調査
    ├── revenue-simulation.md   収益試算データ
    └── ittengo-philosophy.md   「光転」哲学リサーチ（dailyWords の出典）
```

## ルール

- **正は `product/spec.md`**。仕様の食い違いがあれば spec.md を信じる
- 改訂は spec.md → glossary → research の順で重要度が下がる
- research/ は意思決定の根拠で、最新仕様を反映しているとは限らない
