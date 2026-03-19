/**
 * Native: SQLite-backed task operations.
 * On web, Metro resolves tasks.web.ts instead of this file.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import type { Task, SubTask, TaskWithSubs, TaskStatus } from '../types/task';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useTasks() {
  const db = useSQLiteContext();

  const getTodayTasks = useCallback(async (): Promise<TaskWithSubs[]> => {
    const tasks = await db.getAllAsync<Task>(
      `SELECT * FROM tasks WHERE status IN ('today', 'completed', 'released') AND selected_date = ? ORDER BY
        CASE status
          WHEN 'today' THEN 0
          WHEN 'completed' THEN 1
          WHEN 'released' THEN 2
        END,
        sort_order`,
      [todayString()]
    );

    const result: TaskWithSubs[] = [];
    for (const task of tasks) {
      const subtasks = await db.getAllAsync<SubTask>(
        `SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order`,
        [task.id]
      );
      result.push({
        ...task,
        subtasks: subtasks.map((s) => ({ ...s, completed: Boolean(s.completed) })),
      });
    }
    return result;
  }, [db]);

  const getPoolTasks = useCallback(async (): Promise<Task[]> => {
    return db.getAllAsync<Task>(
      `SELECT * FROM tasks WHERE status = 'pool' ORDER BY created_at DESC`
    );
  }, [db]);

  const addTask = useCallback(async (title: string, status: TaskStatus = 'today'): Promise<void> => {
    const date = status === 'today' ? todayString() : null;
    const maxOrder = await db.getFirstAsync<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) as m FROM tasks WHERE status = 'today' AND selected_date = ?`,
      [todayString()]
    );
    await db.runAsync(
      `INSERT INTO tasks (title, status, selected_date, sort_order) VALUES (?, ?, ?, ?)`,
      [title, status, date, (maxOrder?.m ?? 0) + 1]
    );
  }, [db]);

  const completeTask = useCallback(async (id: number): Promise<void> => {
    await db.runAsync(
      `UPDATE tasks SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
      [id]
    );
  }, [db]);

  const uncompleteTask = useCallback(async (id: number): Promise<void> => {
    await db.runAsync(
      `UPDATE tasks SET status = 'today', completed_at = NULL WHERE id = ?`,
      [id]
    );
  }, [db]);

  const releaseTask = useCallback(async (id: number): Promise<void> => {
    await db.runAsync(
      `UPDATE tasks SET status = 'released', released_at = datetime('now') WHERE id = ?`,
      [id]
    );
  }, [db]);

  const updateTask = useCallback(async (id: number, title: string): Promise<void> => {
    await db.runAsync(`UPDATE tasks SET title = ? WHERE id = ?`, [title, id]);
  }, [db]);

  const updateMemo = useCallback(async (id: number, memo: string): Promise<void> => {
    await db.runAsync(`UPDATE tasks SET memo = ? WHERE id = ?`, [memo, id]);
  }, [db]);

  const addSubtask = useCallback(async (taskId: number, title: string): Promise<void> => {
    const maxOrder = await db.getFirstAsync<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) as m FROM subtasks WHERE task_id = ?`,
      [taskId]
    );
    await db.runAsync(
      `INSERT INTO subtasks (task_id, title, sort_order) VALUES (?, ?, ?)`,
      [taskId, title, (maxOrder?.m ?? 0) + 1]
    );
  }, [db]);

  const toggleSubtask = useCallback(async (id: number): Promise<void> => {
    await db.runAsync(
      `UPDATE subtasks SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?`,
      [id]
    );
  }, [db]);

  const saveMoodCheck = useCallback(async (taskId: number, mood: number, action: string): Promise<void> => {
    await db.runAsync(
      `INSERT INTO mood_checks (task_id, mood, action) VALUES (?, ?, ?)`,
      [taskId, mood, action]
    );
  }, [db]);

  const selectForToday = useCallback(async (id: number): Promise<void> => {
    const maxOrder = await db.getFirstAsync<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) as m FROM tasks WHERE status = 'today' AND selected_date = ?`,
      [todayString()]
    );
    await db.runAsync(
      `UPDATE tasks SET status = 'today', selected_date = ?, sort_order = ? WHERE id = ?`,
      [todayString(), (maxOrder?.m ?? 0) + 1, id]
    );
  }, [db]);

  return {
    getTodayTasks, getPoolTasks, addTask,
    completeTask, uncompleteTask, releaseTask,
    updateTask, updateMemo,
    addSubtask, toggleSubtask,
    saveMoodCheck, selectForToday,
  };
}
