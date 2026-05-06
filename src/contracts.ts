export type SystemsApiRegistrationPayload = {
  id: string;
  name: string;
  description: string;
  mode: "orchestrated" | "standalone";
  exposed: boolean;
  health: "healthy" | "degraded" | "offline";
  upstreamUrl: string;
  capabilities: string[];
  metadata: {
    networkVersion: string;
    supportsFederationMesh: boolean;
    supportsTopologyTelemetry: boolean;
    supportsWebSocketPush: boolean;
  };
};

export function buildSystemsApiRegistrationPayload(upstreamUrl: string): SystemsApiRegistrationPayload {
  return {
    id: "nexus-network",
    name: "Nexus Network",
    description: "Federation mesh health, topology telemetry, and real-time ecosystem monitoring",
    mode: "standalone",
    exposed: true,
    health: "healthy",
    upstreamUrl,
    capabilities: [
      "federation-mesh",
      "topology-telemetry",
      "health-dashboard",
      "websocket-push",
      "ecosystem-monitoring",
    ],
    metadata: {
      networkVersion: "v1",
      supportsFederationMesh: true,
      supportsTopologyTelemetry: true,
      supportsWebSocketPush: true,
    },
  };
}
