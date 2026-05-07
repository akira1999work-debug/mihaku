# Windows引き継ぎ情報

## 1. プロジェクト一覧

| プロジェクト | リポジトリ | 現在のブランチ | 技術スタック |
|---|---|---|---|
| **edenquest** | `https://github.com/isshii-jpeg/edenquest.git` | `fix/bugfix` | Next.js 16 + Supabase + TypeScript |
| **my-task-app (AITAS)** | `https://github.com/akira1999work-debug/aitas.git` | `main` | React Native + Expo 54 |

### edenquest のブランチ構成
- `main` — 本番
- `develop` — 開発統合
- `feature/new-functions` — 新機能
- `feature/uiux` — UI/UX改善
- `fix/bugfix` — バグ修正 (Mac側で現在チェックアウト中)

---

## 2. Windows側で必要なツールのインストール

```powershell
# 1. Git (https://git-scm.com/download/win)

# 2. fnm (Node.jsバージョン管理)
winget install Schniz.fnm
# PowerShellプロファイルに以下を追加:
# fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm install 24
fnm use 24

# 3. GitHub CLI
winget install GitHub.cli
gh auth login

# 4. Claude Code
npm install -g @anthropic-ai/claude-code

# 5. Syncthing (後で連携する場合)
winget install Syncthing.Syncthing
```

---

## 3. 環境変数（.env.local）

edenquestで必要な環境変数（.env.exampleに定義済み）:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

Mac側の実際の値は `.env.local` に入っている。Git管理外なので手動でコピーが必要。

---

## 4. Syncthing 連携情報（後で接続する用）

Mac側で以下3つの共有フォルダが設定済み:

| フォルダID | パス (Mac) | 用途 |
|---|---|---|
| `aitas-designs` | `/Users/koki/aitas-designs/` | AITASデザインファイル |
| `edenquest-designs` | `/Users/koki/edenquest-designs/` | edenquestデザイン |
| `shared-docs` | `/Users/koki/shared-docs/` | 共有ドキュメント（ブランチ戦略図など） |

MacのデバイスID: `736OKSN-XR72S24-HLGEQQX-M3T7PUC-6N3JFTU-PWMFKNJ-FX2FYFR-G7OMTQL`

Windows側でSyncthingにこのデバイスIDを追加し、同じフォルダを受け入れれば同期される。

---

## 5. プロジェクトセットアップ手順

### edenquest
```bash
git clone https://github.com/isshii-jpeg/edenquest.git
cd edenquest
git checkout develop
npm install
# .env.local を作成して環境変数を設定
npm run dev
```

### my-task-app (AITAS)
```bash
git clone https://github.com/akira1999work-debug/aitas.git
cd aitas
npm install
npx expo start
```

---

## 6. Mac側の開発環境スペック

| 項目 | 値 |
|---|---|
| OS | macOS 26.2 (Darwin 25.2.0) |
| マシン | MacBook Air (Apple Silicon ARM64) |
| RAM | 8GB |
| CPU | 8コア |
| Node.js | v24.14.0 (fnm管理) |
| npm | v11.9.0 |
| Git | v2.50.1 |
| GitHub CLI | v2.65.0 |
| Claude Code | v2.1.59 |
| Syncthing | v2.0.14 |
| Python | 3.9.6 (システム付属) |

---

## 7. Git認証

- Mac側はGitHub CLIのcredential helperで認証
- SSH鍵もgithub.comに対して設定済み
- Windows側では `gh auth login` でGitHub CLIログインするのが最も簡単

---

## 8. 注意点

- **グローバルgit user設定**: Mac側は未設定。Windows側で `git config --global user.name "名前"` / `git config --global user.email "メール"` を設定しておくこと
- **edenquestのDB**: Supabaseクラウド上にあるのでローカルDB構築は不要。マイグレーションファイルは `supabase/migrations/` に24個ある
- **Dockerは不要**: 現在のプロジェクトはすべてNode.jsベースでコンテナ不要
- **shared-docs** にはブランチ戦略図（`edenquest-branch-strategy.png`）が入っている
