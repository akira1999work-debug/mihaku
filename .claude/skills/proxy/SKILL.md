---
name: proxy
description: mihaku開発用proxyサーバーを起動する
user-invocable: true
disable-model-invocation: true
---

mihakuのローカルproxyサーバーを起動する。既に起動中なら再起動する。

```bash
npx kill-port 3141 2>/dev/null
cd tools/proxy && node server.js &
sleep 2
curl -s http://localhost:3141/api/health
```

起動後、ヘルスチェックの結果を報告すること。
