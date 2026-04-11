import { Router, type Request, type Response } from 'express';

export type NexusCloudNetworkApp = {
  id: string;
  name: string;
  role: string;
  embedded: boolean;
  referenced: boolean;
  exposes: readonly string[];
  consumes: readonly string[];
  requiredApis: readonly string[];
};

export type NexusCloudNetworkDiscovery = {
  protocol: string;
  hub: string;
  app: NexusCloudNetworkApp;
  updatedAt: string;
};

export type NexusCloudNetworkRegistration = {
  registered: boolean;
  appId: string;
  nodeId: string;
  endpoint: string;
  capabilityHint: string[];
  registry: string;
  client: string;
};

export type NexusCloudNetworkClient = {
  name: string;
  baseUrl: string;
  auth: string;
  endpoints: {
    heartbeat: string;
    stats: string;
    cloud: string;
  };
};

const router = Router();

const app: NexusCloudNetworkApp = {
  id: 'nexus-network',
  name: 'Nexus Network',
  role: 'mesh-layer',
  embedded: false,
  referenced: true,
  exposes: ['/.well-known/nexus-cloud', '/api/cloud/discovery', '/api/cloud/register', '/api/cloud/client'],
  consumes: ['/api/heartbeat', '/api/stats', '/ws'],
  requiredApis: ['topology.v1', 'systems-api.v1'],
};

export function buildNetworkCloudDiscovery(): NexusCloudNetworkDiscovery {
  return {
    protocol: 'nexus-cloud/1.0',
    hub: 'Nexus Cloud',
    app,
    updatedAt: new Date().toISOString(),
  };
}

export function buildNetworkCloudRegistration(input: { appId: string; nodeId: string; endpoint: string; capabilities?: readonly string[] }): NexusCloudNetworkRegistration {
  return {
    registered: true,
    appId: input.appId,
    nodeId: input.nodeId,
    endpoint: input.endpoint,
    capabilityHint: Array.isArray(input.capabilities) ? [...input.capabilities] : [],
    registry: '/api/cloud/discovery',
    client: '/api/cloud/client',
  };
}

export function buildNetworkCloudClient(): { client: NexusCloudNetworkClient } {
  return {
    client: {
      name: 'Nexus Network client',
      baseUrl: '/api',
      auth: 'Bearer NEXUS_NETWORK_TOKEN',
      endpoints: {
        heartbeat: '/api/heartbeat',
        stats: '/api/stats',
        cloud: '/api/cloud/discovery',
      },
    },
  };
}

router.get('/.well-known/nexus-cloud', (_req, res) => {
  res.json(buildNetworkCloudDiscovery());
});

router.get('/api/cloud/discovery', (_req, res) => {
  res.json(buildNetworkCloudDiscovery());
});

router.post('/api/cloud/register', (req: Request, res: Response) => {
  const { appId, nodeId, endpoint, capabilities } = (req.body ?? {}) as { appId?: string; nodeId?: string; endpoint?: string; capabilities?: readonly string[] };
  if (!appId || !nodeId || !endpoint) {
    res.status(400).json({ error: 'Missing required fields: appId, nodeId, endpoint' });
    return;
  }
  res.status(201).json(buildNetworkCloudRegistration({ appId, nodeId, endpoint, capabilities }));
});

router.get('/api/cloud/client', (_req, res) => {
  res.json(buildNetworkCloudClient());
});

export default router;
