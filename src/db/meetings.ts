/**
 * 会議ログ・リアクションのDB操作
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import type { MeetingMessage, MeetingPhase, CharacterName } from '../services/ai-types';

interface MeetingLog {
  id: number;
  task_id: number | null;
  phase: string;
  user_message: string;
  messages_json: string;
  summary_json: string | null;
  created_at: string;
}

export function useMeetingLogs() {
  const db = useSQLiteContext();

  /** 会議ログを保存する */
  const saveMeetingLog = useCallback(async (params: {
    taskId?: number;
    phase: MeetingPhase;
    userMessage: string;
    messages: MeetingMessage[];
    summary?: string[];
  }): Promise<number> => {
    const result = await db.runAsync(
      `INSERT INTO meeting_logs (task_id, phase, user_message, messages_json, summary_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        params.taskId ?? null,
        params.phase,
        params.userMessage,
        JSON.stringify(params.messages),
        params.summary ? JSON.stringify(params.summary) : null,
      ],
    );
    return result.lastInsertRowId;
  }, [db]);

  /** リアクションを保存する */
  const saveReaction = useCallback(async (
    meetingId: number,
    character: CharacterName,
    reaction: string,
  ): Promise<void> => {
    // 同じ会議・同じキャラの既存リアクションを削除してから挿入（トグル動作）
    await db.runAsync(
      `DELETE FROM meeting_reactions WHERE meeting_id = ? AND character = ?`,
      [meetingId, character],
    );
    await db.runAsync(
      `INSERT INTO meeting_reactions (meeting_id, character, reaction) VALUES (?, ?, ?)`,
      [meetingId, character, reaction],
    );
  }, [db]);

  /** リアクションを削除する（トグルオフ） */
  const removeReaction = useCallback(async (
    meetingId: number,
    character: CharacterName,
  ): Promise<void> => {
    await db.runAsync(
      `DELETE FROM meeting_reactions WHERE meeting_id = ? AND character = ?`,
      [meetingId, character],
    );
  }, [db]);

  return { saveMeetingLog, saveReaction, removeReaction };
}
