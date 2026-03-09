"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ColumnKey = "todo" | "inprogress" | "done";

type KanbanTask = {
  id: string;
  text: string;
  column: ColumnKey;
};

type BoardData = {
  todo: KanbanTask[];
  inprogress: KanbanTask[];
  done: KanbanTask[];
};

const COLUMNS: Array<{ key: ColumnKey; title: string; color: string }> = [
  { key: "todo", title: "To Do", color: "bg-sky-100 text-sky-700" },
  {
    key: "inprogress",
    title: "In Progress",
    color: "bg-amber-100 text-amber-700",
  },
  { key: "done", title: "Done", color: "bg-emerald-100 text-emerald-700" },
];

function formatICT(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(dt);
}

export default function Home() {
  const [board, setBoard] = useState<BoardData>({ todo: [], inprogress: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      // Try API first (local dev mode)
      const response = await fetch("/api/board", { cache: "no-store" });
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        // Fall back to static JSON (GitHub Pages)
        await loadStaticBoard();
        return;
      }

      const data = (await response.json()) as {
        board?: BoardData;
        updatedAt?: string;
        error?: string;
      };

      if (!response.ok || !data.board) {
        throw new Error(data.error ?? "Failed to load board");
      }

      setBoard(data.board);
      setUpdatedAt(data.updatedAt ?? null);
      setError(null);
      setViewOnly(false);
    } catch {
      // API unavailable - fall back to static JSON (GitHub Pages)
      await loadStaticBoard();
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStaticBoard = useCallback(async () => {
    try {
      const response = await fetch("/board.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Static board not found");
      }
      const data = (await response.json()) as {
        board?: BoardData;
        updatedAt?: string;
      };
      if (data.board) {
        setBoard(data.board);
        setUpdatedAt(data.updatedAt ?? null);
        setViewOnly(true);
        setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load static board";
      setError(msg);
      setViewOnly(true);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
    const interval = setInterval(() => {
      void loadBoard();
    }, 30_000);

    return () => clearInterval(interval);
  }, [loadBoard]);

  const move = useCallback(async (task: KanbanTask, to: ColumnKey) => {
    if (task.column === to) return;

    setSavingTaskId(task.id);
    setError(null);

    try {
      const response = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskText: task.text,
          from: task.column,
          to,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Move failed");
      }

      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setSavingTaskId(null);
    }
  }, [loadBoard]);

  const totalCount = useMemo(
    () => board.todo.length + board.inprogress.length + board.done.length,
    [board],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-zinc-50 to-cyan-50 px-4 py-8 text-slate-800 sm:px-6 lg:px-10">
      <main className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Autonomous Kanban</h1>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>{totalCount} total tasks</p>
              <p>
                Last refresh: {updatedAt ? formatICT(updatedAt) : "-"} (Asia/Ho_Chi_Minh)
              </p>
            </div>
          </div>
          {viewOnly ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              View-only mode on GitHub Pages. Live task sync is available in local runtime.
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const tasks = board[column.key];

            return (
              <div key={column.key} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{column.title}</h2>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${column.color}`}>
                    {tasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {loading ? <p className="text-sm text-slate-500">Loading tasks...</p> : null}
                  {!loading && tasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      No tasks
                    </p>
                  ) : null}
                  {tasks.map((task) => (
                    <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="mb-3 text-sm leading-relaxed text-slate-800">{task.text}</p>
                      <div className="flex flex-wrap gap-2">
                        {task.column !== "todo" ? (
                          <button
                            onClick={() => void move(task, "todo")}
                            disabled={savingTaskId === task.id}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Move to To Do
                          </button>
                        ) : null}
                        {task.column !== "inprogress" ? (
                          <button
                            onClick={() => void move(task, "inprogress")}
                            disabled={savingTaskId === task.id}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Move to In Progress
                          </button>
                        ) : null}
                        {task.column !== "done" ? (
                          <button
                            onClick={() => void move(task, "done")}
                            disabled={savingTaskId === task.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Move to Done
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
