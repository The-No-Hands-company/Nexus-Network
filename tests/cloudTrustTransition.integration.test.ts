/**
 * Integration scenario: Cloud peer trust transition → Network in-memory snapshot update.
 *
 * Mirrors apps/Nexus-Hosting/artifacts/api-server/tests/integration/cloudTrustTransition.test.ts
 * so both downstream consumers (Hosting and Network) are covered uniformly.
 *
 * Approach:
 *   - Patches globalThis.fetch directly (no mock.timers — avoids undici stream timer
 *     conflicts).  Drives the trust transition by re-starting the sync loop with
 *     updated mock data, then flushing enough microtask turns for the async fetch
 *     chain to settle.
 *   - Uses plain fake-response objects ({ ok, status, json: () => Promise.resolve(…) })
 *     so .json() resolves via pure Promise microtasks rather than undici stream machinery.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  startNexusNetworkCloudSourceOfTruthSync,
  getLatestNetworkCloudSnapshot,
} from "../src/integrations/nexus-cloud.js";

/**
 * Build a fetch-compatible response whose .json() resolves via a plain
 * Promise.resolve — no undici stream timers involved.
 */
function fakeOkResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

/**
 * Drain enough microtask turns for the full async chain:
 *   syncOnce → Promise.all(fetch × 4) → sequential .json() calls × 3 + fetchCloudTrustSummary
 * Each async step needs at least one microtask turn; 20 passes is a conservative ceiling.
 */
async function flushAsyncWork(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

type MutableTrustCounts = {
  total: number;
  pending: number;
  verified: number;
  trusted: number;
  quarantined: number;
  revoked: number;
  expired: number;
};

type MutableTrustSummary = {
  nodes: MutableTrustCounts;
  peers: MutableTrustCounts;
  updatedAt: string;
};

type MutablePeer = { domain: string; trustState: string; status: string };

describe("Cloud trust transition — Network integration", () => {
  let savedFetch: typeof globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = savedFetch;
    delete process.env.NEXUS_CLOUD_URL;
  });

  it("updates Network in-memory snapshot when Cloud peer trust transitions", async () => {
    process.env.NEXUS_CLOUD_URL = "https://cloud.example.com";

    const trustSummary: MutableTrustSummary = {
      nodes: {
        total: 2,
        pending: 0,
        verified: 1,
        trusted: 1,
        quarantined: 0,
        revoked: 0,
        expired: 0,
      },
      peers: {
        total: 3,
        pending: 0,
        verified: 1,
        trusted: 2,
        quarantined: 0,
        revoked: 0,
        expired: 0,
      },
      updatedAt: new Date("2026-04-27T00:00:00.000Z").toISOString(),
    };

    const peers: MutablePeer[] = [
      { domain: "peer-a.nexus", trustState: "trusted", status: "healthy" },
      { domain: "peer-b.nexus", trustState: "trusted", status: "healthy" },
      { domain: "peer-c.nexus", trustState: "verified", status: "healthy" },
    ];

    const makeFetchMock =
      () =>
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        if (url.includes("/api/v1/status?compact=trust")) {
          return fakeOkResponse({ scope: "trust-lifecycle", trust: { ...trustSummary } });
        }
        if (url.includes("/api/v1/tools")) {
          return fakeOkResponse({ tools: [] });
        }
        if (url.includes("/v1/federation/peers")) {
          return fakeOkResponse({ peers: peers.map((p) => ({ ...p })) });
        }
        if (url.includes("/api/v1/topology")) {
          return fakeOkResponse({
            topology: {
              summary: {
                appCount: 3,
                connectionCount: 5,
                embeddedAppCount: 1,
                referencedAppCount: 2,
                hybridAppCount: 0,
              },
            },
          });
        }
        throw new Error(`Unhandled fetch URL in test: ${url}`);
      };

    savedFetch = globalThis.fetch;

    // ── Phase 1: initial sync ───────────────────────────────────────────────
    globalThis.fetch = makeFetchMock() as typeof globalThis.fetch;
    const stop1 = startNexusNetworkCloudSourceOfTruthSync();
    await flushAsyncWork();
    stop1();

    const initial = getLatestNetworkCloudSnapshot();
    assert.equal(initial.connected, true, "initial: connected to Cloud");
    assert.ok(initial.trustSummary !== null, "initial: trustSummary present");
    assert.equal(initial.trustSummary!.peers.trusted, 2, "initial: 2 trusted peers");
    assert.equal(initial.nonRoutablePeerCount, 0, "initial: 0 non-routable peers");
    assert.equal(initial.routablePeerCount, 3, "initial: 3 routable peers");

    // ── Trust transition: peer-b becomes quarantined ────────────────────────
    trustSummary.peers.trusted = 1;
    trustSummary.peers.quarantined = 1;
    trustSummary.updatedAt = new Date("2026-04-27T00:05:00.000Z").toISOString();
    peers[1] = { domain: "peer-b.nexus", trustState: "quarantined", status: "blocked" };

    // ── Phase 2: post-transition sync ──────────────────────────────────────
    globalThis.fetch = makeFetchMock() as typeof globalThis.fetch;
    const stop2 = startNexusNetworkCloudSourceOfTruthSync();
    await flushAsyncWork();
    stop2();

    const updated = getLatestNetworkCloudSnapshot();
    assert.equal(updated.trustSummary!.peers.trusted, 1, "updated: 1 trusted peer");
    assert.equal(updated.trustSummary!.peers.quarantined, 1, "updated: 1 quarantined peer");
    assert.equal(updated.nonRoutablePeerCount, 1, "updated: 1 non-routable peer");
    assert.equal(updated.routablePeerCount, 2, "updated: 2 routable peers");
  });
});
