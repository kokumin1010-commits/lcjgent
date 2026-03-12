import { Router } from "express";

/**
 * Dev Safety - File Lock API (Layer 2 of 4-Layer Defense System)
 * 
 * Prevents multiple Manus sessions from editing the same file simultaneously.
 * Uses in-memory store with TTL (10 minutes auto-expiry).
 * 
 * Endpoints:
 *   POST   /api/v1/dev-safety/lock       - Acquire a file lock
 *   POST   /api/v1/dev-safety/unlock     - Release a file lock
 *   DELETE  /api/v1/dev-safety/locks/all  - Force-release all locks
 *   GET    /api/v1/dev-safety/locks       - List all active locks
 */

interface FileLock {
  session_id: string;
  locked_at: string;
  expires_at: number; // Unix timestamp in ms
}

// In-memory lock store (sufficient for single Railway instance)
const locks = new Map<string, FileLock>();

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpiredLocks(): void {
  const now = Date.now();
  for (const [filePath, lock] of locks.entries()) {
    if (now > lock.expires_at) {
      locks.delete(filePath);
    }
  }
}

export const devSafetyRouter = Router();

// POST /api/v1/dev-safety/lock - Acquire a file lock
devSafetyRouter.post("/lock", (req, res) => {
  cleanExpiredLocks();

  const { file_path, session_id } = req.body;

  if (!file_path || !session_id) {
    return res.status(400).json({ 
      error: "file_path and session_id are required" 
    });
  }

  const existing = locks.get(file_path);
  
  // If already locked by the same session, extend the lock
  if (existing && existing.session_id === session_id) {
    existing.expires_at = Date.now() + LOCK_TTL_MS;
    existing.locked_at = new Date().toISOString();
    return res.json({ 
      status: "extended", 
      file_path, 
      session_id,
      expires_at: new Date(existing.expires_at).toISOString()
    });
  }

  // If locked by another session and not expired
  if (existing && Date.now() <= existing.expires_at) {
    return res.status(409).json({ 
      error: `File locked by session ${existing.session_id} at ${existing.locked_at}`,
      locked_by: existing.session_id,
      locked_at: existing.locked_at,
      expires_at: new Date(existing.expires_at).toISOString()
    });
  }

  // Acquire the lock
  locks.set(file_path, {
    session_id,
    locked_at: new Date().toISOString(),
    expires_at: Date.now() + LOCK_TTL_MS,
  });

  res.json({ 
    status: "locked", 
    file_path, 
    session_id,
    expires_at: new Date(Date.now() + LOCK_TTL_MS).toISOString()
  });
});

// POST /api/v1/dev-safety/unlock - Release a file lock
devSafetyRouter.post("/unlock", (req, res) => {
  const { file_path, session_id } = req.body;

  if (!file_path || !session_id) {
    return res.status(400).json({ 
      error: "file_path and session_id are required" 
    });
  }

  const existing = locks.get(file_path);

  if (!existing) {
    return res.json({ status: "not_locked", file_path });
  }

  if (existing.session_id !== session_id) {
    return res.status(403).json({ 
      error: `File locked by different session: ${existing.session_id}`,
      locked_by: existing.session_id 
    });
  }

  locks.delete(file_path);
  res.json({ status: "unlocked", file_path, session_id });
});

// DELETE /api/v1/dev-safety/locks/all - Force-release all locks
devSafetyRouter.delete("/locks/all", (_req, res) => {
  const count = locks.size;
  locks.clear();
  res.json({ 
    status: "all_cleared", 
    cleared_count: count 
  });
});

// GET /api/v1/dev-safety/locks - List all active locks
devSafetyRouter.get("/locks", (_req, res) => {
  cleanExpiredLocks();
  
  const activeLocks: Record<string, { session_id: string; locked_at: string; expires_at: string }> = {};
  for (const [filePath, lock] of locks.entries()) {
    activeLocks[filePath] = {
      session_id: lock.session_id,
      locked_at: lock.locked_at,
      expires_at: new Date(lock.expires_at).toISOString(),
    };
  }

  res.json({ 
    active_locks: activeLocks, 
    count: locks.size 
  });
});
