export interface NodeHeartbeat {
  node_id: string
  domain: string
  version: string
  products: ProductName[]
  hardware: {
    ram_gb: number
    cpu_cores: number
    gpu_gb?: number
    storage_gb: number
  }
  load: {
    ram_used_pct: number
    cpu_used_pct: number
    storage_used_pct: number
  }
  location?: {
    country_code: string
    region?: string
  }
  compute_jobs_hour?: number
  timestamp: number
}

export type ProductName =
  | 'nexus'
  | 'nexus-hosting'
  | 'nexus-cloud'
  | 'nexus-deploy'
  | 'nexus-computer'
  | 'nexus-vault'

export interface StoredNode {
  node_id: string
  domain: string
  version: string
  products: string
  ram_gb: number
  cpu_cores: number
  gpu_gb: number
  storage_gb: number
  ram_used_pct: number
  cpu_used_pct: number
  storage_used_pct: number
  country_code: string
  region: string
  compute_jobs_hour: number
  last_seen: number
  first_seen: number
}

export interface NetworkStats {
  nodes_online: number
  nodes_delta_hour: number
  total_ram_gb: number
  ram_used_pct: number
  total_storage_gb: number
  storage_used_pct: number
  total_cpu_cores: number
  avg_cpu_load_pct: number
  total_gpu_gb: number
  compute_jobs_hour: number
  countries: number
  product_counts: Record<ProductName, number>
  top_nodes: TopNode[]
  recent_events: FedEvent[]
  compute_history: ComputePoint[]
}

export interface TopNode {
  domain: string
  ram_gb: number
  cpu_cores: number
  storage_gb: number
  country_code: string
  online: boolean
}

export interface FedEvent {
  timestamp: number
  type: 'join' | 'upgrade' | 'expand' | 'compute' | 'deploy'
  domain: string
  detail: string
}

export interface ComputePoint {
  hour: number
  compute_offload: number
  ai_jobs: number
  deploy_builds: number
}
