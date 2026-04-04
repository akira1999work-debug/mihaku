/**
 * In-memory store for Web environment.
 * Same interface as useTasks() but backed by arrays instead of SQLite.
 * Data resets on page reload — that's fine for dev preview.
 */
import { useCallback } from 'react';
import type { Task, SubTask, TaskWithSubs, TaskStatus } from '../types/task';

let tasks: Task[] = [];
let subtasks: SubTask[] = [];
let moodChecks: { id: number; task_id: number; mood: number; action: string; created_at: string }[] = [];
let releaseLogs: { id: number; task_id: number; task_title: string; reason: string | null; released_at: string }[] = [];
let nextTaskId = 1;
let nextSubId = 1;
let nextMoodId = 1;
let nextReleaseLogId = 1;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowString(): string {
  return new Date().toISOString();
}

export function useMemoryTasks() {
  const getTodayTasks = useCallback(async (): Promise<TaskWithSubs[]> => {
    const today = todayString();
    const todayTasks = tasks
      .filter((t) => ['today', 'completed', 'released'].includes(t.status) && t.selected_date === today)
      .sort((a, b) => {
        const order: Record<string, number> = { today: 0, completed: 1, released: 2 };
        const diff = (order[a.status] ?? 0) - (order[b.status] ?? 0);
        if (diff !== 0) return diff;
        return a.sort_order - b.sort_order;
      });

    return todayTasks.map((task) => ({
      ...task,
      subtasks: subtasks
        .filter((s) => s.task_id === task.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, []);

  const getPoolTasks = useCallback(async (): Promise<Task[]> => {
    return tasks.filter((t) => t.status === 'pool').sort((a, b) => b.id - a.id);
  }, []);

  const addTask = useCallback(async (title: string, status: TaskStatus = 'today'): Promise<void> => {
    const date = status === 'today' ? todayString() : null;
    const maxOrder = tasks
      .filter((t) => t.status === 'today' && t.selected_date === todayString())
      .reduce((max, t) => Math.max(max, t.sort_order), 0);

    tasks.push({
      id: nextTaskId++,
      title,
      status,
      memo: null,
      created_at: nowString(),
      completed_at: null,
      released_at: null,
      selected_date: date,
      time_slot: 'unset',
      sort_order: maxOrder + 1,
    });
  }, []);

  const completeTask = useCallback(async (id: number): Promise<void> => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.status = 'completed';
      task.completed_at = nowString();
    }
  }, []);

  const uncompleteTask = useCallback(async (id: number): Promise<void> => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.status = 'today';
      task.completed_at = null;
    }
  }, []);

  const releaseTask = useCallback(async (id: number, reason?: string): Promise<void> => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.status = 'released';
      task.released_at = nowString();
      releaseLogs.push({
        id: nextReleaseLogId++,
        task_id: id,
        task_title: task.title,
        reason: reason ?? null,
        released_at: nowString(),
      });
    }
  }, []);

  const updateTask = useCallback(async (id: number, title: string): Promise<void> => {
    const task = tasks.find((t) => t.id === id);
    if (task) task.title = title;
  }, []);

  const updateMemo = useCallback(async (id: number, memo: string): Promise<void> => {
    const task = tasks.find((t) => t.id === id);
    if (task) task.memo = memo;
  }, []);

  const addSubtask = useCallback(async (taskId: number, title: string): Promise<void> => {
    const maxOrder = subtasks
      .filter((s) => s.task_id === taskId)
      .reduce((max, s) => Math.max(max, s.sort_order), 0);

    subtasks.push({
      id: nextSubId++,
      task_id: taskId,
      title,
      completed: false,
      sort_order: maxOrder + 1,
    });
  }, []);

  const toggleSubtask = useCallback(async (id: number): Promise<void> => {
    const sub = subtasks.find((s) => s.id === id);
    if (sub) sub.completed = !sub.completed;
  }, []);

  const saveMoodCheck = useCallback(async (taskId: number, mood: number, action: string): Promise<void> => {
    moodChecks.push({
      id: nextMoodId++,
      task_id: taskId,
      mood,
      action,
      created_at: nowString(),
    });
  }, []);

  const getReleaseLogs = useCallback(async (date?: string) => {
    const d = date ?? todayString();
    return releaseLogs.filter((r) => r.released_at.slice(0, 10) === d);
  }, []);

  const selectForToday = useCallback(async (id: number): Promise<void> => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      const maxOrder = tasks
        .filter((t) => t.status === 'today' && t.selected_date === todayString())
        .reduce((max, t) => Math.max(max, t.sort_order), 0);
      task.status = 'today';
      task.selected_date = todayString();
      task.sort_order = maxOrder + 1;
    }
  }, []);

  return {
    getTodayTasks, getPoolTasks, addTask,
    completeTask, uncompleteTask, releaseTask,
    updateTask, updateMemo,
    addSubtask, toggleSubtask,
    saveMoodCheck, selectForToday,
    getReleaseLogs,
  };
}
