/**
 * B+Cデータ蓄積基盤 — 行動データの集計クエリ
 *
 * v1ではDB保存のみ。集計結果のUI表示はv2以降。
 * 5人会議・ライトレビューのプロンプトコンテキスト生成に使う（v1.5）。
 */

import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

export interface WeeklySummary {
  /** 完了タスク数 */
  completedCount: number;
  /** 手放しタスク数 */
  releasedCount: number;
  /** 気分チェックの平均値 */
  avgMood: number | null;
  /** 会議回数 */
  meetingCount: number;
}

export interface TaskPattern {
  /** タスクタイトル */
  title: string;
  /** 出現回数 */
  count: number;
  /** 最後に選ばれた日 */
  lastDate: string;
}

export function useAnalytics() {
  const db = useSQLiteContext();

  /** 直近N日間の行動サマリ */
  const getWeeklySummary = useCallback(async (days: number = 7): Promise<WeeklySummary> => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const completed = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM tasks WHERE status = 'completed' AND date(completed_at) >= ?`,
      [cutoffStr],
    );

    const released = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM release_logs WHERE date(released_at) >= ?`,
      [cutoffStr],
    );

    const mood = await db.getFirstAsync<{ avg: number | null }>(
      `SELECT AVG(mood) as avg FROM mood_checks WHERE date(created_at) >= ?`,
      [cutoffStr],
    );

    const meetings = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM meeting_logs WHERE date(created_at) >= ?`,
      [cutoffStr],
    );

    return {
      completedCount: completed?.c ?? 0,
      releasedCount: released?.c ?? 0,
      avgMood: mood?.avg ?? null,
      meetingCount: meetings?.c ?? 0,
    };
  }, [db]);

  /** 繰り返し選ばれるタスクのパターン（上位N件） */
  const getRecurringPatterns = useCallback(async (limit: number = 10): Promise<TaskPattern[]> => {
    return db.getAllAsync<TaskPattern>(
      `SELECT title, COUNT(*) as count, MAX(selected_date) as lastDate
       FROM tasks
       WHERE selected_date IS NOT NULL
       GROUP BY title
       HAVING count > 1
       ORDER BY count DESC
       LIMIT ?`,
      [limit],
    );
  }, [db]);

  /** 曜日別の完了率 */
  const getWeekdayStats = useCallback(async (): Promise<Array<{ weekday: number; completed: number; total: number }>> => {
    return db.getAllAsync(
      `SELECT
        CAST(strftime('%w', selected_date) AS INTEGER) as weekday,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COUNT(*) as total
       FROM tasks
       WHERE selected_date IS NOT NULL AND status IN ('completed', 'released', 'pool')
       GROUP BY weekday
       ORDER BY weekday`,
    );
  }, [db]);

  return { getWeeklySummary, getRecurringPatterns, getWeekdayStats };
}
