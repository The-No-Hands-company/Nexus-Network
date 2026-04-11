import { describe, it, expect } from 'vitest';
import { buildNetworkCloudDiscovery, buildNetworkCloudClient, buildNetworkCloudRegistration } from './cloud.js';

describe('Nexus Network cloud contracts', () => {
  it('builds discovery payloads', () => {
    const payload = buildNetworkCloudDiscovery();
    expect(payload.protocol).toBe('nexus-cloud/1.0');
    expect(payload.app.id).toBe('nexus-network');
  });

  it('builds the client contract', () => {
    const client = buildNetworkCloudClient();
    expect(client.client.endpoints.stats).toBe('/api/stats');
  });

  it('builds registration responses', () => {
    const registration = buildNetworkCloudRegistration({
      appId: 'nexus-network',
      nodeId: 'node-1',
      endpoint: 'https://network.example.com',
      capabilities: ['heartbeat', 'stats'],
    });
    expect(registration.registered).toBe(true);
    expect(registration.capabilityHint).toEqual(['heartbeat', 'stats']);
  });
});
