# AITAS（アイタス）開発環境・現状まとめ

**更新日**: 2026-03-01
**リポジトリ**: https://github.com/akira1999work-debug/aitas
**最新コミット**: `06fa590` (chore: AIデフォルト設定を更新)

---

## 1. プロジェクト概要

AI搭載のパーソナルタスク管理アプリ。オンボーディング会話でユーザーの生活を把握し、AIがタスクを自動分類・レビュー・最適化する。3つのパーソナリティ（standard/yuru/maji）で応答の口調とレビュー基準が変化する。

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン |
|----------|------|-----------|
| フレームワーク | React Native + Expo | RN 0.81.5, Expo ~54 |
| 言語 | TypeScript | ~5.9.2 |
| UI | react-native-paper (Material Design 3) | ^5.15.0 |
| 状態管理 | React Context API | - |
| ナビゲーション | @react-navigation v7 | Stack + BottomTab |
| DB (Native) | expo-sqlite (WAL mode, FK) | ~16.0.10 |
| DB (Web) | sql.js (localStorage永続化) | ^1.14.0 |
| AI (Cloud) | Google Gemini API | gemini-2.0-flash |
| AI (Local) | Ollama | gemma3:4b |
| Web対応 | react-native-web | ^0.21.0 |
| バンドラー | Metro (Web含む) | - |

---

## 3. ファイル構成

```
aitas/
├── App.tsx                          # ルートコンポーネント（Provider階層）
├── app.json                         # Expo設定
├── package.json
├── index.ts
├── src/
│   ├── context/
│   │   └── AppContext.tsx            # グローバル状態（~1000行）
│   │                                  tasks, categories, aiConfig, careMode, etc.
│   │                                  全CRUD、AI推論、optimistic updates
│   ├── db/
│   │   ├── database.ts              # SQLiteスキーマ定義・クエリ関数（~1000行）
│   │   │                              11テーブル、マイグレーション対応
│   │   ├── dbProvider.tsx           # Native用DBプロバイダ（expo-sqlite）
│   │   ├── dbProvider.web.tsx       # Web用DBプロバイダ（sql.js）
│   │   └── webDatabase.ts          # sql.jsラッパー（CDN→asm.jsフォールバック）
│   ├── types/
│   │   ├── index.ts                 # Task, AIProviderConfig, AiReviewResult等
│   │   ├── onboarding.ts           # OnboardingState, SuggestedCategory, UserProfile
│   │   └── sql.js.d.ts             # sql.js型定義
│   ├── services/
│   │   ├── aiProvider.ts            # Gemini/Ollama統合（sendMessage, chatWith*）
│   │   ├── aiReview.ts             # 4視点タスクレビュー（聖域判定含む）
│   │   ├── categoryInference.ts    # AIカテゴリ自動分類（3段階推論）
│   │   ├── onboardingService.ts    # オンボーディング会話処理
│   │   ├── displayScore.ts         # タスク表示優先度スコア（50~120）
│   │   ├── scoreService.ts         # スコア計算サービス
│   │   └── suggestionThreshold.ts  # サブカテゴリ提案の閾値チェック
│   ├── hooks/
│   │   └── useSortedTasks.ts       # スコア順ソート済みタスクhook
│   ├── theme/
│   │   └── index.ts                # 3パーソナリティテーマ + ケアモード（HSL彩度低下）
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Stack(Onboarding→MainTabs→Settings) + Tab
│   ├── screens/
│   │   ├── HomeScreen.tsx          # "Now Playing"フォーカスカード + フェーディングリスト
│   │   ├── TaskListScreen.tsx      # タスク一覧（検索・フィルター・スワイプ完了）
│   │   ├── ReviewScreen.tsx        # AIチャット振り返り画面
│   │   ├── TaskDetailScreen.tsx    # タスク詳細（AIレビュー表示、カテゴリ変更）
│   │   ├── OnboardingScreen.tsx    # AI会話→カテゴリ提案→レビュー→スタート
│   │   └── SettingsScreen.tsx      # AI接続、パーソナリティ、各種設定
│   └── utils/
│       ├── haptics.ts              # Web安全ハプティクスラッパー
│       └── glowColor.ts           # ポートフォリオタイプ別グロー色
```

---

## 4. アプリアーキテクチャ

### Provider階層（App.tsx）
```
SafeAreaProvider (initialMetrics付きWeb安全)
  └── Suspense (LoadingFallback)
      └── DatabaseProvider (Native=expo-sqlite / Web=sql.js 自動分岐)
          └── AppProvider (グローバル状態)
              └── PaperProvider (テーマ)
                  └── AppNavigator
                      └── StatusBar
```

### ナビゲーション構造
```
Stack.Navigator
├── OnboardingScreen  (条件: !onboardingComplete)
├── MainTabs
│   ├── Tab: Home (HomeScreen)
│   ├── Tab: TaskList (TaskListScreen)
│   └── Tab: Review (ReviewScreen)
├── Settings (modal)
└── TaskDetail (card modal)
```

### DBテーブル（11テーブル）
| テーブル | 用途 |
|----------|------|
| tasks | タスク本体（category_id, portfolio_type, ai_review_cache等） |
| sub_tasks | サブタスク（FK→tasks ON DELETE CASCADE） |
| categories | カテゴリ（parent_id階層、scalingWeight） |
| chat_messages | AIチャット履歴 |
| settings | KVS設定（AI接続情報、オンボーディング状態等） |
| reschedule_history | リスケ履歴（ケアモード判定用） |
| user_profiles | ユーザープロファイル（オンボーディングで生成） |
| super_goals | スーパーゴール（カテゴリ紐づき） |
| pending_suggestions | サブカテゴリ提案（閾値管理） |
| self_reports | 自己報告（good/normal/tough） |
| daily_snapshots | 日次スナップショット |

---

## 5. AI機能の詳細

### 5.1 接続構成

```typescript
// デフォルト設定 (AppContext.tsx)
{
  connectionMode: 'cloud',       // 'local' | 'cloud' | 'hybrid'
  ollamaHost: '127.0.0.1',
  ollamaPort: '11434',
  ollamaModel: 'gemma3:4b',
  geminiApiKey: '',              // 設定画面で入力
  geminiModel: 'gemini-2.0-flash',
}
```

- **cloud**: Gemini APIのみ使用
- **local**: Ollamaのみ使用
- **hybrid**: Ollama優先（3秒タイムアウト）→ Geminiフォールバック

**ビジネス方針**: AI接続設定は将来的にプラン（課金）で制御。一般ユーザーには非表示にする予定。開発者のみ変更可能にする。

### 5.2 オンボーディング会話 (`onboardingService.ts`)

**フロー**:
1. AIが挨拶（パーソナリティ別3パターン）
2. ユーザーと最大4ターン会話
3. 会話からカテゴリを自動抽出（仕事/趣味/目標/副業）
4. `SuggestedCategory[]`をレビュー画面で表示
5. ユーザー確認後、カテゴリをDBに保存 + 「雑務」カテゴリを自動追加

**AI出力形式（JSON）**:
```json
{
  "reply": "ユーザーへの返答",
  "extractedCategories": [
    { "name": "カテゴリ名", "icon": "MCIアイコン名", "color": "#HEX", "scalingWeight": "strict|normal|relaxed", "source": "抽出元発話" }
  ],
  "collectedUpdate": { "work": true, "hobby": false, "goal": false, "sidework": false },
  "shouldContinue": true,
  "summary": "会話要約（100文字以内）"
}
```

**scalingWeight規則**:
- `strict`: 仕事・本業（優先度ブースト+20）
- `normal`: 生活・健康・学習（+10）
- `relaxed`: 趣味・長期目標（+0）

### 5.3 カテゴリ推論 (`categoryInference.ts`)

タスク追加時にバックグラウンドで実行。3段階の推論：

1. **既存カテゴリ一致**: 同義語含む（「ビジネス」→「仕事」）→ `action: "existing"`
2. **サブカテゴリ提案**: 既存カテゴリの子として適切 → `action: "new_subcategory"`
3. **フォールバック**: 判断不能 → デフォルトカテゴリ（isDefault=true）

サブカテゴリ提案は閾値チェック付き（`suggestionThreshold.ts`）:
- 同名タグが7日以内に3回以上提案 → ユーザーに提案
- 未分類タスクが5件以上蓄積 → ユーザーに提案

### 5.4 AIレビュー (`aiReview.ts`)

4つの視点でタスクを0-100点で評価：

| 視点 | 評価内容 |
|------|----------|
| necessity（必要性） | ゴールとの整合性、生活維持に不可欠か |
| feasibility（実現可能性） | 今日のタスク量・ケアモードを考慮 |
| decomposition（分解） | 抽象的なら最小単位のサブタスク案を生成 |
| efficiency（最適化） | 効率的な手段・ショートカット提案 |

**パーソナリティ別の重み付け**:
```typescript
standard: { necessity: 1.0, feasibility: 1.0, decomposition: 1.0, efficiency: 1.0 }
yuru:     { necessity: 0.5, feasibility: 1.5, decomposition: 0.8, efficiency: 0.7 }
maji:     { necessity: 1.5, feasibility: 0.8, decomposition: 1.0, efficiency: 1.2 }
```

**聖域（サンクチュアリ）判定**:
- `portfolioType === 'recharge'` → 自動聖域
- `isSanctuary === true` → ユーザー指定聖域
- タイトルがサンクチュアリキーワードに一致 → 自動聖域
- 聖域タスクはレビューをスキップ（全100点）

### 5.5 会話AI (`aiProvider.ts`)

- **HomeScreen**: タスク追加確認、完了ねぎらい（1-2文の簡潔応答）
- **ReviewScreen**: タスク振り返り・アドバイス（会話コンテキスト維持、直近20メッセージ）
- システムプロンプトにタスク状況サマリーを自動注入

---

## 6. 型定義（主要）

### Task
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  subTasks: SubTask[];
  createdAt: string;
  taskType: 'routine' | 'normal' | 'urgent';
  completedAt?: string;
  originalDueDate?: string;
  rescheduleCount: number;
  categoryId?: string;
  portfolioType?: 'drive' | 'maintenance' | 'recharge';
  isSanctuary?: boolean;
  aiReviewCache?: string;       // JSON.stringify(AiReviewResult)
  inferenceStatus?: 'pending' | 'completed' | 'failed';
  superGoalId?: string;
}
```

### TaskCategory
```typescript
interface TaskCategory {
  id: string;
  name: string;
  icon: string;              // MaterialCommunityIcons名
  color: string;             // #HEXカラー
  sortOrder: number;
  isDefault: boolean;
  scalingWeight: 'strict' | 'normal' | 'relaxed';
  parentId: string | null;   // 階層カテゴリ
}
```

### AiReviewResult
```typescript
interface AiReviewResult {
  necessity: { score: number; summary: string; suggestion?: string };
  feasibility: { score: number; summary: string; suggestion?: string };
  decomposition: { score: number; summary: string; suggestion?: string; suggestedSubTasks?: string[] };
  efficiency: { score: number; summary: string; suggestion?: string };
  overallScore: number;      // 加重平均
  isSanctuary: boolean;
  sanctuaryMessage?: string;
  reviewedAt: string;        // ISO timestamp
}
```

---

## 7. 機能実装状況

### 完全動作
| 機能 | 詳細 |
|------|------|
| タスクCRUD | 作成・表示・更新・削除・サブタスク管理 |
| カテゴリシステム | 階層カテゴリ、手動変更、AI自動分類 |
| AI接続 | Ollama / Gemini / ハイブリッド3モード |
| オンボーディング | AI会話→カテゴリ提案→レビュー→スタート（スキップ可） |
| AIレビュー | 4視点評価、聖域判定、パーソナリティ別重み |
| パーソナリティ | standard/yuru/maji切替（テーマ・応答・レビュー重み全変化） |
| ケアモード | リスケ理由「struggling」選択後3日間自動有効化 |
| HomeScreen | "Now Playing"フォーカスカード + 完了/スキップ/「今日は無理」 |
| ReviewScreen | AIチャット振り返り |
| 設定画面 | AI接続、パーソナリティ、表示スタイル |
| Web対応 | sql.js(CDN→asm.jsフォールバック)、SafeAreaProvider安全化、ハプティクスno-op |

### 未完成（UIのみ / スタブ）
| 機能 | 状態 |
|------|------|
| 音声入力 | マイクボタンあり、実際の録音なし（ダミータスク追加） |
| Googleカレンダー連携 | トグルあり、同期ロジックなし |
| 繰り返しタスク自動生成 | パターン保存のみ、翌日の自動生成なし |
| 通知/リマインダー | UI表示のみ |

---

## 8. 開発環境

| 項目 | 値 |
|------|-----|
| OS | Windows 11 Home |
| Node.js | v22系 |
| Expo CLI | ~54 |
| Ollama | localhost:11434 稼働中、gemma3:4b導入済み |
| GPU | RTX 4060以上 |
| TypeScript | tsc --noEmit エラー0（2026-03-01確認） |
| デプロイ | Vercel (Web) |

### 起動コマンド
```bash
cd C:\ClaudeCode\projects\aitas
npx expo start --web        # Web版
npx expo start --android    # Android
npx expo start --ios        # iOS
npx expo export --platform web  # Webビルド
```

---

## 9. 直近の変更履歴

| コミット | 内容 |
|----------|------|
| `06fa590` | AIデフォルト: cloud, gemma3:4b, gemini-2.0-flash |
| `eabe53e` | Web3大バグ修正: sql.js CDN, SafeAreaProvider, expo-haptics |
| `1827cae` | Vercel再デプロイトリガー |
| `69d9580` | 不足サービスファイル・型定義追加 |
| `382b619` | dbProviderをplatform別ファイルに分割 |
| `d81b686` | TaskDetailScreen, グロー効果, インサイト可視化 |
| `5001983` | Phase 3: Now Playing UI, ケアモード, AIカテゴリ推論, Webフォールバック |

---

## 10. 既知の課題・次のステップ

1. **音声入力の実装**: expo-av or Web Speech API でリアル録音→文字起こし
2. **繰り返しタスク**: バックグラウンドジョブで翌日分を自動生成
3. **通知**: expo-notifications でリマインダー実装
4. **Googleカレンダー連携**: OAuth + Google Calendar API
5. **プラン課金**: AI接続設定を一般ユーザーから隠す機構
6. **テスト**: ユニットテスト・E2Eテスト未整備
