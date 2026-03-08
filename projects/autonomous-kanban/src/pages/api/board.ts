import type { NextApiRequest, NextApiResponse } from "next";
import { readBoardData } from "@/lib/kanban";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const board = await readBoardData();
    res.status(200).json({ board, updatedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read board";
    res.status(500).json({ error: message });
  }
}
