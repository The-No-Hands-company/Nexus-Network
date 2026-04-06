import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { StoredNode, NodeHeartbeat, NetworkStats, FedEvent, ComputePoint, ProductName } from '../types/index.js'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'network.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '0.0.0',
    products TEXT NOT NULL DEFAULT '[]',
    ram_gb REAL NOT NULL DEFAULT 0,
    cpu_cores INTEGER NOT NULL DEFAULT 0,
    gpu_gb REAL NOT NULL DEFAULT 0,
    storage_gb REAL NOT NULL DEFAULT 0,
    ram_used_pct REAL NOT NULL DEFAULT 0,
    cpu_used_pct REAL NOT NULL DEFAULT 0,
    storage_used_pct REAL NOT NULL DEFAULT 0,
    country_code TEXT NOT NULL DEFAULT 'XX',
    region TEXT NOT NULL DEFAULT '',
    compute_jobs_hour INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER NOT NULL,
    first_seen INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL,
    domain TEXT NOT NULL,
    detail TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS compute_history (
    hour INTEGER PRIMARY KEY,
    compute_offload INTEGER NOT NULL DEFAULT 0,
    ai_jobs INTEGER NOT NULL DEFAULT 0,
    deploy_builds INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
`)

const ONLINE_WINDOW_MS = 5 * 60 * 1000

const stmts = {
  upsertNode: db.prepare(`
    INSERT INTO nodes (node_id, domain, version, products, ram_gb, cpu_cores, gpu_gb,
      storage_gb, ram_used_pct, cpu_used_pct, storage_used_pct,
      country_code, region, compute_jobs_hour, last_seen, first_seen)
    VALUES (@node_id, @domain, @version, @products, @ram_gb, @cpu_cores, @gpu_gb,
      @storage_gb, @ram_used_pct, @cpu_used_pct, @storage_used_pct,
      @country_code, @region, @compute_jobs_hour, @last_seen, @first_seen)
    ON CONFLICT(node_id) DO UPDATE SET
      domain = excluded.domain,
      version = excluded.version,
      products = excluded.products,
      ram_gb = excluded.ram_gb,
      cpu_cores = excluded.cpu_cores,
      gpu_gb = excluded.gpu_gb,
      storage_gb = excluded.storage_gb,
      ram_used_pct = excluded.ram_used_pct,
      cpu_used_pct = excluded.cpu_used_pct,
      storage_used_pct = excluded.storage_used_pct,
      country_code = excluded.country_code,
      region = excluded.region,
      compute_jobs_hour = excluded.compute_jobs_hour,
      last_seen = excluded.last_seen
  `),

  getNode: db.prepare(`SELECT * FROM nodes WHERE node_id = ?`),

  onlineNodes: db.prepare(`
    SELECT * FROM nodes WHERE last_seen > ? ORDER BY ram_gb DESC
  `),

  countHourAgo: db.prepare(`
    SELECT COUNT(*) as cnt FROM nodes WHERE last_seen > ? AND first_seen <= ?
  `),

  newNodesHourAgo: db.prepare(`
    SELECT COUNT(*) as cnt FROM nodes WHERE first_seen > ?
  `),

  insertEvent: db.prepare(`
    INSERT INTO events (timestamp, type, domain, detail) VALUES (?, ?, ?, ?)
  `),

  recentEvents: db.prepare(`
    SELECT * FROM events ORDER BY timestamp DESC LIMIT 20
  `),

  upsertComputeHour: db.prepare(`
    INSERT INTO compute_history (hour, compute_offload, ai_jobs, deploy_builds)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(hour) DO UPDATE SET
      compute_offload = compute_offload + excluded.compute_offload,
      ai_jobs = ai_jobs + excluded.ai_jobs,
      deploy_builds = deploy_builds + excluded.deploy_builds
  `),

  computeHistory: db.prepare(`
    SELECT * FROM compute_history ORDER BY hour DESC LIMIT 24
  `),
}

export function upsertNode(hb: NodeHeartbeat): void {
  const now = Date.now()
  const existing = stmts.getNode.get(hb.node_id) as StoredNode | undefined

  stmts.upsertNode.run({
    node_id: hb.node_id,
    domain: hb.domain,
    version: hb.version,
    products: JSON.stringify(hb.products),
    ram_gb: hb.hardware.ram_gb,
    cpu_cores: hb.hardware.cpu_cores,
    gpu_gb: hb.hardware.gpu_gb ?? 0,
    storage_gb: hb.hardware.storage_gb,
    ram_used_pct: hb.load.ram_used_pct,
    cpu_used_pct: hb.load.cpu_used_pct,
    storage_used_pct: hb.load.storage_used_pct,
    country_code: hb.location?.country_code ?? 'XX',
    region: hb.location?.region ?? '',
    compute_jobs_hour: hb.compute_jobs_hour ?? 0,
    last_seen: now,
    first_seen: existing?.first_seen ?? now,
  })

  if (!existing) {
    stmts.insertEvent.run(now, 'join', hb.domain, `New node joined the federation`)
  } else {
    const oldVersion = existing.version
    if (oldVersion !== hb.version) {
      stmts.insertEvent.run(now, 'upgrade', hb.domain, `Upgraded NFP ${oldVersion} → ${hb.version}`)
    }
    const oldStorage = existing.storage_gb
    if (hb.hardware.storage_gb > oldStorage * 1.1) {
      const added = Math.round(hb.hardware.storage_gb - oldStorage)
      stmts.insertEvent.run(now, 'expand', hb.domain, `Storage expanded +${added}GB`)
    }
  }

  const hour = Math.floor(now / 3_600_000)
  stmts.upsertComputeHour.run(
    hour,
    hb.compute_jobs_hour ?? 0,
    0,
    0,
  )
}

export function getNetworkStats(): NetworkStats {
  const cutoff = Date.now() - ONLINE_WINDOW_MS
  const hourAgo = Date.now() - 3_600_000

  const online = stmts.onlineNodes.all(cutoff) as StoredNode[]
  const prevCount = (stmts.countHourAgo.get(cutoff, hourAgo) as { cnt: number }).cnt
  const newCount = (stmts.newNodesHourAgo.get(hourAgo) as { cnt: number }).cnt

  let totalRam = 0, totalStorage = 0, totalCpu = 0, totalGpu = 0
  let sumRamUsed = 0, sumStorageUsed = 0, sumCpuUsed = 0, totalJobs = 0
  const countries = new Set<string>()
  const productCounts: Record<string, number> = {}

  for (const n of online) {
    totalRam += n.ram_gb
    totalStorage += n.storage_gb
    totalCpu += n.cpu_cores
    totalGpu += n.gpu_gb
    sumRamUsed += n.ram_used_pct
    sumStorageUsed += n.storage_used_pct
    sumCpuUsed += n.cpu_used_pct
    totalJobs += n.compute_jobs_hour
    if (n.country_code !== 'XX') countries.add(n.country_code)
    const products: string[] = JSON.parse(n.products)
    for (const p of products) {
      productCounts[p] = (productCounts[p] ?? 0) + 1
    }
  }

  const count = online.length || 1

  const topNodes = online.slice(0, 5).map(n => ({
    domain: n.domain,
    ram_gb: n.ram_gb,
    cpu_cores: n.cpu_cores,
    storage_gb: n.storage_gb,
    country_code: n.country_code,
    online: true,
  }))

  const rawEvents = stmts.recentEvents.all() as Array<{
    timestamp: number; type: string; domain: string; detail: string
  }>

  const recentEvents: FedEvent[] = rawEvents.map(e => ({
    timestamp: e.timestamp,
    type: e.type as FedEvent['type'],
    domain: e.domain,
    detail: e.detail,
  }))

  const rawHistory = stmts.computeHistory.all() as ComputePoint[]
  const computeHistory = rawHistory.reverse()

  return {
    nodes_online: online.length,
    nodes_delta_hour: newCount,
    total_ram_gb: totalRam,
    ram_used_pct: Math.round(sumRamUsed / count),
    total_storage_gb: totalStorage,
    storage_used_pct: Math.round(sumStorageUsed / count),
    total_cpu_cores: totalCpu,
    avg_cpu_load_pct: Math.round(sumCpuUsed / count),
    total_gpu_gb: totalGpu,
    compute_jobs_hour: totalJobs,
    countries: countries.size,
    product_counts: productCounts as Record<ProductName, number>,
    top_nodes: topNodes,
    recent_events: recentEvents,
    compute_history: computeHistory,
  }
}

export default db
