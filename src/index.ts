import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import heartbeatRouter from './routes/heartbeat.js'
import statsRouter from './routes/stats.js'
import { getNetworkStats } from './db/index.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const PORT = parseInt(process.env.PORT ?? '3700', 10)
const PUSH_INTERVAL_MS = parseInt(process.env.PUSH_INTERVAL_MS ?? '5000', 10)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  }
}))
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json({ limit: '16kb' }))

const heartbeatLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many heartbeats — send once per minute max' },
})

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/heartbeat', heartbeatLimiter, heartbeatRouter)
app.use('/api/stats', apiLimiter, statsRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

const PUBLIC_DIR = path.join(process.cwd(), 'public')
app.use(express.static(PUBLIC_DIR))
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

wss.on('connection', (ws: WebSocket) => {
  try {
    ws.send(JSON.stringify({ type: 'stats', data: getNetworkStats() }))
  } catch {}

  ws.on('error', () => {})
})

setInterval(() => {
  if (wss.clients.size === 0) return
  try {
    const payload = JSON.stringify({ type: 'stats', data: getNetworkStats() })
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    })
  } catch (err) {
    console.error('WS broadcast error:', err)
  }
}, PUSH_INTERVAL_MS)

server.listen(PORT, () => {
  console.log(`Nexus-Network running on http://localhost:${PORT}`)
  console.log(`WebSocket live updates on ws://localhost:${PORT}/ws`)
})
