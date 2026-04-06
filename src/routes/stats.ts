import { Router, Request, Response } from 'express'
import { getNetworkStats } from '../db/index.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const stats = getNetworkStats()
    res.setHeader('Cache-Control', 'public, max-age=30')
    return res.json(stats)
  } catch (err) {
    console.error('Stats error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})

export default router
