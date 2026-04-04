export type TaskStatus = 'pool' | 'today' | 'completed' | 'released';
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'unset';

export interface SubTask {
  id: number;
  task_id: number;
  title: string;
  completed: boolean;
  sort_order: number;
}

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  memo: string | null;
  created_at: string;
  completed_at: string | null;
  released_at: string | null;
  selected_date: string | null;
  time_slot: TimeSlot;
  sort_order: number;
}

export interface TaskWithSubs extends Task {
  subtasks: SubTask[];
}
