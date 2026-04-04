/**
 * 日替わり処理 — 4:00AM基準でその日の初回起動時にリセット
 *
 * - 未完了タスク(status='today')をプール(status='pool')に戻す
 * - 手放し痕跡(status='released')を消す（当日のみ表示のため）
 * - AppState復帰時にも再判定（バックグラウンド→フォアグラウンド）
 * - 二重リセット防止: 最終リセット日をexpo-secure-storeに保存
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSQLiteContext } from 'expo-sqlite';

const LAST_RESET_KEY = 'mihaku_last_daily_reset';
const RESET_HOUR = 4; // 4:00AM

/** 4:00AM基準の「今日」を返す（4:00AM前なら前日扱い） */
function getMihakuDate(): string {
  const now = new Date();
  if (now.getHours() < RESET_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().slice(0, 10);
}

async function getLastResetDate(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(LAST_RESET_KEY);
  }
  return SecureStore.getItemAsync(LAST_RESET_KEY);
}

async function setLastResetDate(date: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(LAST_RESET_KEY, date);
    return;
  }
  await SecureStore.setItemAsync(LAST_RESET_KEY, date);
}

export function useDailyReset() {
  const db = useSQLiteContext();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const runningRef = useRef(false);

  const runResetIfNeeded = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      const today = getMihakuDate();
      const lastReset = await getLastResetDate();

      if (lastReset === today) {
        // 既にリセット済み
        setResetDone(true);
        return;
      }

      // 未完了(today)をプールに戻す
      await db.runAsync(
        `UPDATE tasks SET status = 'pool', selected_date = NULL, sort_order = 0
         WHERE status = 'today'`,
      );

      // 手放し痕跡を非表示（statusはそのまま、selected_dateをクリア）
      await db.runAsync(
        `UPDATE tasks SET selected_date = NULL
         WHERE status = 'released' AND selected_date IS NOT NULL`,
      );

      await setLastResetDate(today);
      setResetDone(true);

      // プールに候補があるかチェック
      const poolCount = await db.getFirstAsync<{ c: number }>(
        `SELECT COUNT(*) as c FROM tasks WHERE status = 'pool'`,
      );
      setNeedsSetup((poolCount?.c ?? 0) > 0);
    } finally {
      runningRef.current = false;
    }
  }, [db]);

  // 初回起動時
  useEffect(() => {
    runResetIfNeeded();
  }, [runResetIfNeeded]);

  // AppState復帰時（バックグラウンド→フォアグラウンド）
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runResetIfNeeded();
      }
    });
    return () => sub.remove();
  }, [runResetIfNeeded]);

  return {
    /** 日替わりリセットが完了したか */
    resetDone,
    /** プールに候補があり、デイリーセットアップを提示すべきか */
    needsSetup,
    /** デイリーセットアップ完了時に呼ぶ */
    dismissSetup: () => setNeedsSetup(false),
  };
}
