# Syncthing MacBook側セットアップ指示書

## 目的
Windows デスクトップ（Koki）とMacBook間のSyncthing同期を完成させる。
Windows側は設定済み。MacBook側でWindowsデバイスの追加とフォルダ共有を行う。

## 前提条件
- MacBook側でSyncthingが起動済みであること（WebUI: http://127.0.0.1:8384）

## 作業内容

### 1. Syncthing APIキーを取得

```bash
# config.xmlの場所を確認してAPIキーを取得
cat ~/Library/Application\ Support/Syncthing/config.xml | grep apikey
```

以降のコマンドでは取得したAPIキーを `YOUR_API_KEY` の部分に置き換えること。

### 2. Windowsデバイスを追加

```bash
curl -s -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:8384/rest/config/devices \
  -d '{
    "deviceID": "B6HM7GI-OGOXFKH-ZVSJCJH-KRDSEEU-WKMZ4ND-QB6SH4D-G2NMLVU-CCWXSAH",
    "name": "Koki",
    "addresses": ["dynamic"],
    "compression": "metadata",
    "autoAcceptFolders": true,
    "paused": false
  }'
```

### 3. 既存フォルダにWindowsデバイスを共有先として追加

Mac側に以下の3フォルダが既に存在するはずなので、各フォルダの設定にWindowsデバイスを追加する。

まず、現在のフォルダ設定を確認:

```bash
curl -s -H "X-API-Key: YOUR_API_KEY" \
  http://127.0.0.1:8384/rest/config/folders | python3 -m json.tool
```

各フォルダについて、既存の設定を取得→devicesにWindowsを追加→PUTで更新する。

以下のスクリプトで3フォルダを一括更新:

```bash
API_KEY="YOUR_API_KEY"
WIN_DEVICE="B6HM7GI-OGOXFKH-ZVSJCJH-KRDSEEU-WKMZ4ND-QB6SH4D-G2NMLVU-CCWXSAH"

for FOLDER_ID in aitas-designs edenquest-designs shared-docs; do
  echo "=== Updating $FOLDER_ID ==="

  # 現在の設定を取得
  CURRENT=$(curl -s -H "X-API-Key: $API_KEY" \
    "http://127.0.0.1:8384/rest/config/folders/$FOLDER_ID")

  if echo "$CURRENT" | grep -q '"id"'; then
    # Windowsデバイスを追加してPUT
    UPDATED=$(echo "$CURRENT" | python3 -c "
import sys, json
config = json.load(sys.stdin)
win_dev = {'deviceID': '$WIN_DEVICE', 'introducedBy': '', 'encryptionPassword': ''}
existing_ids = [d['deviceID'] for d in config['devices']]
if '$WIN_DEVICE' not in existing_ids:
    config['devices'].append(win_dev)
    print(json.dumps(config))
else:
    print(json.dumps(config))
    print('Already shared', file=sys.stderr)
")

    curl -s -X PUT \
      -H "X-API-Key: $API_KEY" \
      -H "Content-Type: application/json" \
      "http://127.0.0.1:8384/rest/config/folders/$FOLDER_ID" \
      -d "$UPDATED"

    echo " -> Done"
  else
    echo " -> Folder not found on Mac. Skipping."
  fi
done
```

### 4. 接続を確認

```bash
# デバイス一覧を確認（Kokiが表示されること）
curl -s -H "X-API-Key: YOUR_API_KEY" \
  http://127.0.0.1:8384/rest/config/devices | python3 -m json.tool

# 接続状態を確認（しばらく待ってからconnected: trueになること）
curl -s -H "X-API-Key: YOUR_API_KEY" \
  http://127.0.0.1:8384/rest/system/connections | python3 -m json.tool

# フォルダ同期状態を確認
for f in aitas-designs edenquest-designs shared-docs; do
  echo "=== $f ==="
  curl -s -H "X-API-Key: YOUR_API_KEY" \
    "http://127.0.0.1:8384/rest/db/status?folder=$f" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  state: {d['state']}, error: {d.get('error','')}\")
print(f\"  local: {d['localFiles']} files, global: {d['globalFiles']} files\")
"
done
```

## 確認ポイント

| チェック項目 | 期待値 |
|---|---|
| Kokiデバイスが追加されている | `rest/config/devices` にKokiが表示 |
| 接続が確立 | `connected: true` |
| 3フォルダが共有済み | 各フォルダのdevicesにKokiのIDが含まれる |
| shared-docsが同期中 | `eden-adventure-branch-strategy.png` がWindows側に届く |

## Windows側情報（参考）

- デバイスID: `B6HM7GI-OGOXFKH-ZVSJCJH-KRDSEEU-WKMZ4ND-QB6SH4D-G2NMLVU-CCWXSAH`
- デバイス名: Koki
- LAN IP: 192.168.1.44
- 同期フォルダ: `~/aitas-designs`, `~/edenquest-designs`, `~/shared-docs`
- 同期タイプ: sendreceive（双方向）
