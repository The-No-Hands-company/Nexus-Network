export type SystemsApiToolRegistrationRequest = {
  id: string;
  name: string;
  description: string;
  upstreamUrl?: string;
  mode?: "standalone" | "orchestrated";
  exposed?: boolean;
  health?: "healthy" | "degraded" | "offline";
  capabilities?: readonly string[];
};

export type NexusCloudToolSummary = {
  id: string;
  health: "healthy" | "degraded" | "offline";
  registrationStatus: "registered" | "active" | "offline";
  exposed: boolean;
};

export type NexusCloudPeerSummary = {
  domain: string;
  trustState: "pending" | "verified" | "trusted" | "quarantined" | "revoked" | "expired";
  status: "unknown" | "healthy" | "degraded" | "blocked";
};

export type NexusCloudTopologySummary = {
  appCount: number;
  connectionCount: number;
  embeddedAppCount: number;
  referencedAppCount: number;
  hybridAppCount: number;
};

export type NexusCloudTrustStateSummary = {
  total: number;
  pending: number;
  verified: number;
  trusted: number;
  quarantined: number;
  revoked: number;
  expired: number;
};

export type NexusCloudTrustSummary = {
  nodes: NexusCloudTrustStateSummary;
  peers: NexusCloudTrustStateSummary;
  updatedAt: string;
};

export type NexusCloudSourceOfTruthSnapshot = {
  connected: boolean;
  fetchedAt: string;
  tools: readonly NexusCloudToolSummary[];
  peers: readonly NexusCloudPeerSummary[];
  trustSummary: NexusCloudTrustSummary | null;
  nonRoutablePeerCount: number;
  routablePeerCount: number;
  topologySummary: NexusCloudTopologySummary | null;
};

let latestCloudSnapshot: NexusCloudSourceOfTruthSnapshot = {
  connected: false,
  fetchedAt: new Date(0).toISOString(),
  tools: [],
  peers: [],
  trustSummary: null,
  nonRoutablePeerCount: 0,
  routablePeerCount: 0,
  topologySummary: null,
};

function cloudBaseUrl(): string {
  return (process.env.NEXUS_CLOUD_URL ?? "").trim().replace(/\/$/, "");
}

function cloudHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    ...(process.env.NEXUS_CLOUD_API_KEY ? { "x-api-key": process.env.NEXUS_CLOUD_API_KEY } : {}),
  };
}

function toolId(): string {
  return (process.env.NEXUS_NETWORK_TOOL_ID ?? "nexus-network").trim();
}

function toolName(): string {
  return (process.env.NEXUS_NETWORK_TOOL_NAME ?? "Nexus Network").trim();
}

function heartbeatIntervalMs(): number {
  const raw = Number(process.env.NEXUS_CLOUD_HEARTBEAT_INTERVAL_MS ?? "30000");
  return Number.isFinite(raw) ? Math.max(5000, raw) : 30000;
}

function resolveUpstreamUrl(port: number): string {
  const configured = (process.env.NEXUS_NETWORK_PUBLIC_URL ?? "").trim();
  return configured || `http://localhost:${port}`;
}

export function hasNetworkCloudIntegration(): boolean {
  return cloudBaseUrl().length > 0;
}

export function getLatestNetworkCloudSnapshot(): NexusCloudSourceOfTruthSnapshot {
  return {
    connected: latestCloudSnapshot.connected,
    fetchedAt: latestCloudSnapshot.fetchedAt,
    tools: [...latestCloudSnapshot.tools],
    peers: [...latestCloudSnapshot.peers],
    trustSummary: latestCloudSnapshot.trustSummary
      ? {
          nodes: { ...latestCloudSnapshot.trustSummary.nodes },
          peers: { ...latestCloudSnapshot.trustSummary.peers },
          updatedAt: latestCloudSnapshot.trustSummary.updatedAt,
        }
      : null,
    nonRoutablePeerCount: latestCloudSnapshot.nonRoutablePeerCount,
    routablePeerCount: latestCloudSnapshot.routablePeerCount,
    topologySummary: latestCloudSnapshot.topologySummary ? { ...latestCloudSnapshot.topologySummary } : null,
  };
}

async function fetchCloudTrustSummary(base: string, headers: Record<string, string>): Promise<NexusCloudTrustSummary | null> {
  const compact = await fetch(`${base}/api/v1/status?compact=trust`, { method: "GET", headers });
  if (compact.ok) {
    const payload = (await compact.json()) as { trust?: NexusCloudTrustSummary; scope?: string };
    if (payload.scope === "trust-lifecycle" && payload.trust) return payload.trust;
  }

  const summary = await fetch(`${base}/api/v1/trust/summary`, { method: "GET", headers });
  if (!summary.ok) return null;
  const payload = (await summary.json()) as { trust?: NexusCloudTrustSummary };
  return payload.trust ?? null;
}

async function fetchNetworkCloudSnapshot(): Promise<NexusCloudSourceOfTruthSnapshot> {
  const base = cloudBaseUrl();
  const headers = cloudHeaders();

  const [toolsRes, peersRes, topologyRes, trustSummary] = await Promise.all([
    fetch(`${base}/api/v1/tools`, { method: "GET", headers }),
    fetch(`${base}/v1/federation/peers`, { method: "GET", headers }),
    fetch(`${base}/api/v1/topology`, { method: "GET", headers }),
    fetchCloudTrustSummary(base, headers),
  ]);

  if (!toolsRes.ok) throw new Error(`Cloud tools fetch failed with status ${toolsRes.status}`);
  if (!peersRes.ok) throw new Error(`Cloud peers fetch failed with status ${peersRes.status}`);
  if (!topologyRes.ok) throw new Error(`Cloud topology fetch failed with status ${topologyRes.status}`);

  const toolsPayload = (await toolsRes.json()) as { tools?: readonly NexusCloudToolSummary[] };
  const peersPayload = (await peersRes.json()) as { peers?: readonly NexusCloudPeerSummary[] };
  const topologyPayload = (await topologyRes.json()) as { topology?: { summary?: NexusCloudTopologySummary } };
  const peers = peersPayload.peers ?? [];
  const nonRoutablePeerCount = peers.filter((peer) => peer.trustState === "quarantined" || peer.trustState === "revoked" || peer.trustState === "expired").length;

  return {
    connected: true,
    fetchedAt: new Date().toISOString(),
    tools: toolsPayload.tools ?? [],
    peers,
    trustSummary,
    nonRoutablePeerCount,
    routablePeerCount: peers.length - nonRoutablePeerCount,
    topologySummary: topologyPayload.topology?.summary ?? null,
  };
}

export function startNexusNetworkCloudSourceOfTruthSync(): () => void {
  const intervalMs = heartbeatIntervalMs();

  const syncOnce = async () => {
    try {
      latestCloudSnapshot = await fetchNetworkCloudSnapshot();
    } catch (error) {
      latestCloudSnapshot = {
        ...latestCloudSnapshot,
        connected: false,
        fetchedAt: new Date().toISOString(),
      };
      console.warn(`[nexus-network] Cloud source-of-truth sync failed: ${(error as Error).message}`);
    }
  };

  syncOnce().catch(() => {});
  const timer = setInterval(() => {
    syncOnce().catch(() => {});
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

export async function registerNexusNetworkWithCloud(payload: SystemsApiToolRegistrationRequest): Promise<void> {
  const response = await fetch(`${cloudBaseUrl()}/api/v1/tools`, {
    method: "POST",
    headers: cloudHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Cloud tool registration failed with status ${response.status}`);
  }
}

export async function heartbeatNexusNetworkWithCloud(targetToolId: string, upstreamUrl?: string): Promise<void> {
  const response = await fetch(`${cloudBaseUrl()}/api/v1/tools/${encodeURIComponent(targetToolId)}/heartbeat`, {
    method: "POST",
    headers: cloudHeaders(),
    body: JSON.stringify({ health: "healthy", ...(upstreamUrl ? { upstreamUrl } : {}) }),
  });

  if (!response.ok) {
    throw new Error(`Cloud heartbeat failed with status ${response.status}`);
  }
}

export function startNexusNetworkCloudRegistrationHeartbeat(port: number): () => void {
  const upstreamUrl = resolveUpstreamUrl(port);
  const id = toolId();

  const registrationPayload: SystemsApiToolRegistrationRequest = {
    id,
    name: toolName(),
    description: "Federation mesh health and topology telemetry service",
    upstreamUrl,
    mode: process.env.SYSTEMS_API_MODE === "orchestrated" ? "orchestrated" : "standalone",
    exposed: true,
    health: "healthy",
    capabilities: [
      "mesh-telemetry",
      "heartbeat-relay",
      "federation-stats",
      "systems-api",
    ],
  };

  registerNexusNetworkWithCloud(registrationPayload)
    .then(() => {
      console.log(`[nexus-network] Registered with Nexus Cloud as ${id}`);
    })
    .catch((error) => {
      console.warn(`[nexus-network] Cloud registration failed: ${(error as Error).message}`);
    });

  const timer = setInterval(() => {
    heartbeatNexusNetworkWithCloud(id, upstreamUrl).catch((error) => {
      console.warn(`[nexus-network] Cloud heartbeat failed: ${(error as Error).message}`);
    });
  }, heartbeatIntervalMs());

  timer.unref();
  return () => clearInterval(timer);
}
