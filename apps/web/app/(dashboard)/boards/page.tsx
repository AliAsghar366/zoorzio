'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskStatus, TaskPriority, getPriorityColor } from '@anchor/shared';
import { api, ApiError, boardsApi, type Board } from '@/lib/api';
import { UpgradeBanner } from '@/components/UpgradeBanner';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate?: string | null;
  boardId?: string | null;
}

const PRIORITIES = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  const [addFormBoardId, setAddFormBoardId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newDueDate, setNewDueDate] = useState('');

  const load = async () => {
    const [boardsData, tasksData] = await Promise.all([boardsApi.list(), api.get<Task[]>('/tasks')]);
    setBoards(boardsData);
    setTasks(tasksData);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const createBoard = async () => {
    const name = window.prompt('Board name');
    if (!name) return;
    setCreateError(null);
    try {
      const created = await boardsApi.create(name);
      setBoards((prev) => [...prev, { ...created, _count: { tasks: 0 } }]);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create board');
    }
  };

  const deleteBoard = async (id: string) => {
    if (!confirm('Delete this board? Tasks inside it are kept, just unassigned.')) return;
    await boardsApi.remove(id);
    setBoards((prev) => prev.filter((b) => b.id !== id));
    setTasks((prev) => prev.map((t) => (t.boardId === id ? { ...t, boardId: null } : t)));
  };

  const openAddForm = (boardId: string) => {
    setAddFormBoardId(boardId);
    setNewTitle('');
    setNewPriority(TaskPriority.MEDIUM);
    setNewDueDate('');
  };

  const submitTask = async (e: React.FormEvent, boardId: string) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateError(null);
    try {
      const created = await api.post<Task>('/tasks', {
        title: newTitle.trim(),
        boardId,
        priority: newPriority,
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      });
      setTasks((prev) => [...prev, created]);
      setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, _count: { tasks: b._count.tasks + 1 } } : b)));
      setAddFormBoardId(null);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create task');
    }
  };

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
    } catch {
      load();
    }
  };

  const cyclePriority = async (task: Task) => {
    const idx = PRIORITIES.indexOf(task.priority as TaskPriority);
    const nextPriority = PRIORITIES[(idx + 1) % PRIORITIES.length];
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority: nextPriority } : t)));
    try {
      await api.put(`/tasks/${task.id}`, { priority: nextPriority });
    } catch {
      load();
    }
  };

  const moveTask = async (task: Task, targetBoardId: string) => {
    if (targetBoardId === task.boardId) return;
    const fromBoardId = task.boardId;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, boardId: targetBoardId } : t)));
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id === fromBoardId) return { ...b, _count: { tasks: Math.max(0, b._count.tasks - 1) } };
        if (b.id === targetBoardId) return { ...b, _count: { tasks: b._count.tasks + 1 } };
        return b;
      }),
    );
    try {
      await api.put(`/tasks/${task.id}`, { boardId: targetBoardId });
    } catch {
      load();
    }
  };

  const deleteTask = async (task: Task) => {
    await api.delete(`/tasks/${task.id}`);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setBoards((prev) => prev.map((b) => (b.id === task.boardId ? { ...b, _count: { tasks: Math.max(0, b._count.tasks - 1) } } : b)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="text-white pb-4">
      <h1 className="text-3xl font-bold">Your Boards</h1>
      <p className="text-white/60 text-sm mt-1">Boards with your upcoming tasks.</p>

      {createError && <UpgradeBanner message={createError} />}

      <div className="space-y-4 mt-5">
        {boards.map((board) => {
          const boardTasks = tasks.filter((t) => t.boardId === board.id);
          return (
            <div key={board.id} className="dashboard-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ac84cc] to-[#dc8cc5] flex items-center justify-center text-xs font-bold shrink-0">
                    {board.name.charAt(0).toUpperCase()}
                  </span>
                  <h2 className="font-semibold text-sm">{board.name}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openAddForm(board.id)} className="text-xs text-white/60 hover:text-white">
                    + Task
                  </button>
                  <button onClick={() => deleteBoard(board.id)} className="text-xs text-white/40 hover:text-red-300">
                    Delete
                  </button>
                </div>
              </div>

              {addFormBoardId === board.id && (
                <form onSubmit={(e) => submitTask(e, board.id)} className="p-3 pt-0 flex flex-wrap gap-2 items-center bg-white/5">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task title"
                    autoFocus
                    className="dashboard-input flex-1 min-w-[140px] !py-1.5 !text-sm"
                  />
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="dashboard-input !py-1.5 !text-sm !w-auto"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="dashboard-input !py-1.5 !text-sm !w-auto"
                  />
                  <button type="submit" className="dashboard-pill-primary !py-1.5 !px-3 text-xs">
                    Add
                  </button>
                  <button type="button" onClick={() => setAddFormBoardId(null)} className="text-xs text-white/40 hover:text-white">
                    Cancel
                  </button>
                </form>
              )}

              <div className="p-3 space-y-1.5">
                {boardTasks.length === 0 ? (
                  <p className="text-xs text-white/40 px-2 py-3">No tasks yet — add one above.</p>
                ) : (
                  boardTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 group">
                      <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={task.status === TaskStatus.COMPLETED}
                          onChange={() => toggleDone(task)}
                          className="rounded border-white/30 bg-white/10 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className={task.status === TaskStatus.COMPLETED ? 'block text-sm text-white/40 line-through truncate' : 'block text-sm truncate'}>
                            {task.title}
                          </span>
                          {task.dueDate && (
                            <span className="block text-[10px] text-white/40">
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        {boards.length > 1 && (
                          <select
                            value={task.boardId || ''}
                            onChange={(e) => moveTask(task, e.target.value)}
                            title="Move to board"
                            className="bg-transparent text-[10px] text-white/40 hover:text-white border-none focus:outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {boards.map((b) => (
                              <option key={b.id} value={b.id} className="text-black">
                                {b.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => cyclePriority(task)}
                          title="Click to change priority"
                          className="px-2 py-0.5 text-[10px] rounded-full font-semibold text-[#2b1f47]"
                          style={{ backgroundColor: getPriorityColor(task.priority) }}
                        >
                          {task.priority}
                        </button>
                        <button
                          onClick={() => deleteTask(task)}
                          className="text-white/30 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        <button onClick={createBoard} className="dashboard-card w-full p-6 flex flex-col items-center justify-center gap-2 text-white/60 hover:text-white transition-colors border-dashed">
          <Plus size={20} />
          <span className="text-sm font-medium">Create new board</span>
        </button>
      </div>
    </div>
  );
}
