---
name: dev
description: mihaku実機テスト用のサーバーを全部起動する（proxy + Expo dev server）
user-invocable: true
disable-model-invocation: true
---

mihakuの実機テストに必要なサーバーを両方起動する。

## 2つのサーバーの役割

| サーバー | 役割 | ポート |
|----------|------|--------|
| **proxy** | AI機能（タスク抽出・分類・5人会議）をClaude CLI経由で処理 | :3141 |
| **Expo dev server** | アプリのJSバンドルを実機に配信（ホットリロード） | :8081 |

## 起動コマンド

```bash
# proxy起動
npx kill-port 3141 2>/dev/null
cd tools/proxy && node server.js &
sleep 2
echo "--- proxy ---"
curl -s http://localhost:3141/api/health

# Expo dev server起動
cd ../..
npx kill-port 8081 2>/dev/null
npx expo start --dev-client --host lan --port 8081 &
sleep 3
echo "--- dev server started ---"
```

起動後、両方のステータスを報告すること。
