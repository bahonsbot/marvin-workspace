import type { NextApiRequest, NextApiResponse } from "next";
import { type ColumnKey, moveTask } from "@/lib/kanban";

type MoveRequest = {
  taskText: string;
  from: ColumnKey;
  to: ColumnKey;
};

function isColumn(value: string): value is ColumnKey {
  return value === "todo" || value === "inprogress" || value === "done";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as Partial<MoveRequest>;

    if (!body.taskText || !body.from || !body.to) {
      res.status(400).json({ error: "taskText, from, and to are required" });
      return;
    }

    if (!isColumn(body.from) || !isColumn(body.to)) {
      res.status(400).json({ error: "Invalid column value" });
      return;
    }

    await moveTask(body.taskText, body.from, body.to);
    res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move task";
    res.status(500).json({ error: message });
  }
}
