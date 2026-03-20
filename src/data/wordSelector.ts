/**
 * 日替わりの一言 選定ロジック
 *
 * v1: 日付ベースでフラットに選定（getDailyWord）
 * v2: ユーザーのコンディション × 行動パターンで選定（selectWord）
 *
 * ── 選定の2軸 ──
 *
 * 軸1: ユーザータイプ（行動パターンから推定、週単位で更新）
 *   - 'driver'   — 仕事タスク多め、手放し率低い、完了率高い
 *   - 'balanced' — バランス型、デフォルト
 *   - 'mindful'  — 手放し率高い、余白を大切にしてる
 *
 * 軸2: 今日のコンディション（気分チェック・前日データから推定）
 *   - 'high'     — 元気、前日も好調
 *   - 'neutral'  — 普通、データなし
 *   - 'low'      — 気分下がってる、前日の気分チェックが低い、リスケ増加
 *
 * ── カテゴリ出現率マトリクス ──
 *
 * | タイプ＼状態 | high           | neutral        | low              |
 * |-------------|----------------|----------------|------------------|
 * | driver      | drive重め      | drive+choice   | pace+gratitude   |
 * |             | +reframe       | +reframe       | +connect         |
 * | balanced    | choice+margin  | 全カテゴリ均等  | pace+gratitude   |
 * |             | +drive少し     |                | +margin          |
 * | mindful     | margin+reflect | margin+reflect | gratitude+pace   |
 * |             | +gratitude     | +gratitude     | +connect         |
 *
 * ポイント:
 * - コンディションが 'low' の時、driveは**出さない**
 *   → 仕事人間でも気分が下がってる日に「限界を超えろ」は逆効果
 * - コンディションが 'low' の時は、pace（焦らない）と gratitude（感謝）を中心に
 *   → 受容と温かさで包む
 * - コンディションが 'high' の時のみ driver に drive を出す
 *   → 元気な時にブーストをかける
 *
 * ── データソース ──
 *
 * コンディション判定に使うデータ:
 * 1. 気分チェック（完了・手放し直後のワンタップ5段階）
 *    - 前日の最終気分チェック値
 *    - 直近3日間の平均
 * 2. 行動パターン
 *    - 前日の完了率（0完了 = low寄り）
 *    - リスケ連続回数（同じタスク3回以上 = low寄り）
 *    - アプリ未使用日数（3日以上 = neutral、判断しない）
 * 3. 朝の体験
 *    - 朝の選択フローで「今日の予定は？」の回答トーン（v2+）
 *    - ライトレビューでの5人の問いかけへの反応
 *
 * ユーザータイプ判定に使うデータ:
 * 1. タスクのカテゴリ傾向（仕事 vs 創作 vs 健康 etc.）— v1.5でAI自動検出
 * 2. 手放し率（週単位）
 * 3. 完了率（週単位）
 * 4. 「5人に伝えておきたいこと」の内容
 */

import { dailyWords, type WordCategory, type DailyWordEntry } from './dailyWords';

export type UserType = 'driver' | 'balanced' | 'mindful';
export type Condition = 'high' | 'neutral' | 'low';

/** カテゴリごとの重み（0-10） */
type CategoryWeights = Partial<Record<WordCategory, number>>;

const weightMatrix: Record<UserType, Record<Condition, CategoryWeights>> = {
  driver: {
    high:    { drive: 10, reframe: 6, choice: 4, margin: 2 },
    neutral: { drive: 6, choice: 6, reframe: 5, margin: 3, reflect: 3 },
    low:     { pace: 10, gratitude: 8, connect: 6, reflect: 4, margin: 4 },
  },
  balanced: {
    high:    { choice: 7, margin: 6, drive: 4, reframe: 4, gratitude: 3 },
    neutral: { choice: 5, margin: 5, reflect: 5, reframe: 5, gratitude: 5, pace: 5, connect: 4, drive: 3 },
    low:     { pace: 8, gratitude: 8, margin: 6, connect: 5, reflect: 4 },
  },
  mindful: {
    high:    { margin: 8, reflect: 7, gratitude: 6, choice: 4, reframe: 3 },
    neutral: { margin: 7, reflect: 7, gratitude: 6, pace: 4, connect: 4 },
    low:     { gratitude: 10, pace: 8, connect: 7, margin: 4 },
  },
};

/**
 * v2: コンディション × ユーザータイプで最適な一言を選定
 *
 * @param date       - 対象日（日替わりのシード）
 * @param userType   - ユーザータイプ（行動パターンから推定）
 * @param condition  - 今日のコンディション（気分チェック等から推定）
 */
export function selectWord(
  date: Date = new Date(),
  userType: UserType = 'balanced',
  condition: Condition = 'neutral',
): DailyWordEntry {
  const weights = weightMatrix[userType][condition];

  // 重み付きプールを構築
  const pool: DailyWordEntry[] = [];
  for (const entry of dailyWords) {
    const w = weights[entry.category] ?? 1;
    for (let i = 0; i < w; i++) {
      pool.push(entry);
    }
  }

  // 日付ベースで決定的に選択（同じ日・同じ条件なら同じ結果）
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const seed = dayOfYear * 31 + userType.length * 7 + condition.length * 13;
  return pool[seed % pool.length];
}
