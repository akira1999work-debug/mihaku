# アイタス (AITAS) - プロジェクト概要書

> Gemini と Claude の共同開発用リファレンス

## 1. プロダクト概要

**アイタス (AITAS)** は、AIパーソナリティを持つタスク管理モバイルアプリ。
「タスク管理が続かない人」をターゲットに、AIキャラクターとの対話を通じて楽しくタスクをこなせる体験を提供する。

- **リポジトリ**: https://github.com/akira1999work-debug/aitas.git
- **バージョン**: 0.1.0 (プロトタイプ)
- **ローカルパス**: `C:\ClaudeCode\projects\aitas`

---

## 2. 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | React Native (Expo 54) |
| 言語 | TypeScript (strict mode) |
| UIライブラリ | React Native Paper (Material Design 3) |
| ナビゲーション | React Navigation 7 (Bottom Tabs + Native Stack) |
| 状態管理 | React Context API |
| アニメーション | React Native Animated, Reanimated |
| アイコン | @expo/vector-icons (MaterialCommunityIcons) |
| デプロイ | Expo (iOS/Android) / Vercel (Web) |

### 主要依存関係
- `expo`: ~54.0.0
- `react`: 19.1.0
- `react-native`: 0.81.5
- `react-native-paper`: ^5.15.2
- `@react-navigation/bottom-tabs`: ^7.3.10
- `@react-navigation/native-stack`: ^7.3.10
- `expo-haptics`, `expo-linear-gradient`

---

## 3. ディレクトリ構成

```
aitas/
├── App.tsx                      # ルートコンポーネント（Provider + テーマ適用）
├── index.ts                     # Expoエントリポイント
├── app.json                     # Expo設定
├── vercel.json                  # Vercelデプロイ設定
├── package.json
├── tsconfig.json
├── assets/                      # アイコン・スプラッシュ画像
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
└── src/
    ├── context/
    │   └── AppContext.tsx        # グローバル状態管理
    ├── navigation/
    │   └── AppNavigator.tsx      # ナビゲーション定義
    ├── screens/
    │   ├── HomeScreen.tsx        # メイン画面（音声/テキスト入力）
    │   ├── TaskListScreen.tsx    # タスク一覧画面
    │   ├── ReviewScreen.tsx      # AIチャット・振り返り画面
    │   └── SettingsScreen.tsx    # 設定画面
    ├── theme/
    │   └── index.ts             # テーマ定義（3パターン）
    └── types/
        └── index.ts             # TypeScript型定義
```

---

## 4. データモデル

```typescript
// タスク
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;           // "YYYY-MM-DD" 形式
  priority: 'high' | 'medium' | 'low';
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  subTasks: SubTask[];
  createdAt: string;          // ISO 8601
}

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

// AIパーソナリティ
type PersonalityType = 'standard' | 'yuru' | 'maji';

interface PersonalityConfig {
  id: PersonalityType;
  name: string;               // "スタンダード" / "ゆるモード" / "マジモード"
  description: string;
  icon: string;               // MaterialCommunityIcons名
  isPremium: boolean;         // yuru, maji は Premium
}

// チャットメッセージ
interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;          // ISO 8601
}
```

---

## 5. 実装済み機能の詳細

### 5.1 ホーム画面 (HomeScreen)
- **音声入力ボタン**: 中央に大きなマイクボタン。タップで録音開始/停止（現在はモック）
  - 録音中: パルスアニメーション + リップルエフェクト
  - 停止時: ランダムなAI応答を表示 + タスク自動追加
- **テキスト入力**: キーボードアイコンからテキストモードに切替
  - 「終わった」「完了」を含む入力 → タスク完了処理
  - それ以外 → 新規タスク追加
- **「今日は無理！」ボタン**: 今日の未完了タスクを全て翌日に移動
  - 確認モーダル表示 → 「やっぱやる」or「移動する」
- **時間帯別あいさつ**: パーソナリティ × 時間帯(午前/午後/夜)でメッセージが変化

### 5.2 タスク一覧画面 (TaskListScreen)
- **検索**: テキストでタスクをフィルタリング
- **フィルターチップ**: すべて / 進行中 / 完了済み
- **タスクカード**:
  - チェックボックスで完了/未完了の切り替え
  - 優先度チップ（高=赤, 中=オレンジ, 低=緑）
  - 繰り返しインジケーター（毎日/毎週/毎月 + アイコン）
  - サブタスク展開/折りたたみ
  - 「AI提案」ボタン（モック）
- **空状態ハンドリング**: タスクがない時の専用表示

### 5.3 レビュー画面 (ReviewScreen)
- **統計カード**: 完了数 / 残りタスク数 / 達成率(%)
- **AIチャット**: パーソナリティに応じた応答（事前定義のプールからランダム選択）
  - standard: プロフェッショナルなフィードバック
  - yuru (ゆるアシ): カジュアル・絵文字多め・ギャル風
  - maji (マジアシ): データ重視・ストイック・効率的
- **チャットUI**: メッセージバブル + AIアバター + タイムスタンプ + 入力中インジケーター

### 5.4 設定画面 (SettingsScreen)
- **AIパーソナリティ選択**: 3つのカード型UIで切り替え
  - スタンダード: 無料
  - ゆるモード / マジモード: PRO バッジ付き（Premium想定）
- **Googleカレンダー連携**: ON/OFFトグル（UIのみ、API未実装）
- **繰り返しタスク管理**: 遷移先未実装（chevron表示のみ）
- **リマインダー設定**: 遷移先未実装
- **アプリ情報**: バージョン 0.1.0 表示

---

## 6. AIパーソナリティシステム

アプリの差別化ポイント。3つの性格モードでUI全体のテーマ・言葉遣い・アイコンが変化する。

| 項目 | standard | yuru (ゆるアシ) | maji (マジアシ) |
|---|---|---|---|
| 名前 | AIアシスタント | ゆるアシ | マジアシ |
| 口調 | 丁寧語 | カジュアル・ギャル風 | 堅い敬語・データ重視 |
| アイコン | robot-happy-outline | emoticon-happy-outline | glasses |
| メインカラー | #6366F1 (紫) | #F472B6 (ピンク) | #3B82F6 (青) |
| 背景色 | #F8FAFC (明るいグレー) | #FFFBEB (暖色系) | #0F172A (ダークネイビー) |
| 課金 | 無料 | PRO | PRO |
| 応答例(褒め) | 「素晴らしいです！」 | 「すごすぎ〜✨ えらいえらい〜💕」 | 「生産性は良好です」 |
| 応答例(注意) | 「無理せずいきましょう」 | 「がんばりすぎじゃない？🌸」 | 「バーンアウトのリスクがあります」 |

---

## 7. 状態管理 (AppContext)

React Context で全画面の状態を一元管理。

### 管理する状態
| 状態 | 型 | 初期値 |
|---|---|---|
| tasks | Task[] | 5件のモックデータ |
| chatMessages | ChatMessage[] | AI初期メッセージ1件 |
| personality | PersonalityType | 'standard' |
| googleCalendarEnabled | boolean | false |

### 提供する関数
| 関数 | 説明 |
|---|---|
| `addTask(task)` | タスクを先頭に追加 |
| `toggleTask(taskId)` | 完了/未完了を切替 |
| `deleteTask(taskId)` | タスクを削除 |
| `rescheduleAllTasks()` | 今日の未完了タスクを翌日に移動 |
| `completeTaskByVoice(taskTitle)` | タイトル部分一致でタスクを完了に |
| `addChatMessage(message)` | チャット履歴に追加 |
| `setPersonality(p)` | AIパーソナリティを切替 |
| `setGoogleCalendarEnabled(enabled)` | カレンダー連携ON/OFF |

---

## 8. ナビゲーション構造

```
RootStack (Native Stack)
├── MainTabs (Bottom Tab Navigator)
│   ├── Home     - ホーム画面     (icon: home)
│   ├── TaskList - タスク一覧     (icon: format-list-checks)
│   └── Review   - レビュー       (icon: chart-timeline-variant-shimmer)
├── Settings     - 設定画面       (modal presentation)
└── TaskDetail   - タスク詳細     (未実装)
```

---

## 9. 未実装 / モック状態の機能

以下は UI が存在するが、バックエンド未接続またはモックのみの機能:

| 機能 | 現状 | 必要な実装 |
|---|---|---|
| 音声認識 | ボタンUI有、録音はモック | Whisper API / expo-speech等 |
| AI応答生成 | 事前定義の応答プールからランダム | LLM API連携（Gemini / Claude） |
| データ永続化 | useState のみ（リロードで消失） | AsyncStorage / SQLite / Supabase |
| Googleカレンダー連携 | トグルUIのみ | Google Calendar API |
| タスク詳細画面 | ナビゲーション定義のみ | 画面実装 |
| 繰り返しタスク管理 | 設定行UIのみ | 管理画面実装 |
| リマインダー | 設定行UIのみ | Expo Notifications |
| ユーザー認証 | なし | Firebase Auth / Supabase Auth |
| Premium課金 | PRO バッジ表示のみ | IAP / Stripe |
| サブタスク操作 | 表示のみ（追加/削除不可） | CRUD実装 |
| タスク編集 | なし | 編集画面/モーダル |
| スワイプジェスチャー | TaskListScreenに部分実装 | react-native-gesture-handler 連携 |

---

## 10. テーマシステム

Material Design 3 ベースで、パーソナリティごとに完全なカラーパレットを定義。

```typescript
// 各テーマで定義されるカラー
{
  primary, primaryContainer,
  secondary, secondaryContainer,
  tertiary,
  background, surface, surfaceVariant,
  error,
  onPrimary, onBackground, onSurface,
  outline
}
```

テーマの切り替えは `App.tsx` で `personality` 状態に応じて動的に適用:
```typescript
const currentTheme = themes[personality]; // 'standard' | 'yuru' | 'maji'
```

---

## 11. ビルド & デプロイ

```bash
# 開発
npx expo start

# Web ビルド (Vercel用)
npm run build:web    # → dist/ に出力

# iOS/Android
npx expo run:ios
npx expo run:android
```

Vercel設定 (`vercel.json`):
- ビルドコマンド: `npm run build:web`
- 出力ディレクトリ: `dist`
- SPA リライトルール設定済み

---

## 12. Git履歴

| コミット | 内容 |
|---|---|
| `77211ac` | Initial commit |
| `d0fe6a3` | Add app screens, navigation, and Vercel deployment config |
| `112a80d` | Rename app from "AI Task Companion" to "アイタス (AITAS)" |
| `c100c4b` | Fix App.tsx to connect AppProvider, PaperProvider, and AppNavigator |

---

## 13. 開発ロードマップ（グランドデザイン準拠）

> 詳細は `aitas-grand-design.md` を参照

### Phase 1（現在）: 基盤構築
- expo-sqlite による堅牢な永続化層の完成
- ローカル(Ollama) / クラウド(Gemini 1.5 Flash) ハイブリッドAI接続の安定化
- ユーザーパフォーマンス計測ロジック（7日間完了率）

### Phase 2: AIコア機能
- **AIタスク・リファイナー**: 適応型スケーリング + 1タップ・プレビュー
- パーソナリティごとのプロンプト・エンジニアリング
- 「今日は無理！」のAI連携リスケジュール

### Phase 3: 外部連携 & 拡張
- 音声入力 (Whisper API等)
- Googleカレンダー同期
- プッシュ通知 / リマインダー
- ユーザー認証 & Premium課金

---

*最終更新: 2026-02-28*
*作成: Claude Code*
