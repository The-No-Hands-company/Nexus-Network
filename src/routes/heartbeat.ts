import { Router, Request, Response } from 'express'
import { upsertNode } from '../db/index.js'
import type { NodeHeartbeat } from '../types/index.js'

const router = Router()

function isValidHeartbeat(body: unknown): body is NodeHeartbeat {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.node_id !== 'string' || b.node_id.length < 8 || b.node_id.length > 128) return false
  if (typeof b.domain !== 'string' || b.domain.length < 3 || b.domain.length > 253) return false
  if (!Array.isArray(b.products)) return false
  if (!b.hardware || typeof b.hardware !== 'object') return false
  const hw = b.hardware as Record<string, unknown>
  if (typeof hw.ram_gb !== 'number' || hw.ram_gb < 0 || hw.ram_gb > 65536) return false
  if (typeof hw.cpu_cores !== 'number' || hw.cpu_cores < 0 || hw.cpu_cores > 1024) return false
  if (typeof hw.storage_gb !== 'number' || hw.storage_gb < 0) return false
  if (!b.load || typeof b.load !== 'object') return false
  return true
}

router.post('/', (req: Request, res: Response) => {
  if (!isValidHeartbeat(req.body)) {
    return res.status(400).json({ error: 'Invalid heartbeat payload' })
  }

  try {
    upsertNode({ ...req.body, timestamp: Date.now() })
    return res.status(200).json({ ok: true, ts: Date.now() })
  } catch (err) {
    console.error('Heartbeat error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router
