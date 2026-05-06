import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemsApiRegistrationPayload } from "../src/contracts.js";

describe("nexus-network MVP contracts", () => {
  it("registration payload shape is stable", () => {
    const payload = buildSystemsApiRegistrationPayload("http://localhost:3700");

    assert.equal(payload.id, "nexus-network");
    assert.equal(payload.name, "Nexus Network");
    assert.equal(payload.mode, "standalone");
    assert.equal(payload.exposed, true);
    assert.equal(payload.health, "healthy");
    assert.equal(payload.upstreamUrl, "http://localhost:3700");
    assert.ok(payload.capabilities.includes("federation-mesh"));
    assert.ok(payload.capabilities.includes("topology-telemetry"));
    assert.ok(payload.capabilities.includes("websocket-push"));
    assert.ok(payload.capabilities.includes("ecosystem-monitoring"));
    assert.equal(payload.metadata.supportsFederationMesh, true);
    assert.equal(payload.metadata.supportsWebSocketPush, true);
  });

  it("upstreamUrl is forwarded correctly", () => {
    const payload = buildSystemsApiRegistrationPayload("https://network.nexus.internal");
    assert.equal(payload.upstreamUrl, "https://network.nexus.internal");
    assert.equal(payload.id, "nexus-network");
  });

  it("full capabilities list is complete", () => {
    const payload = buildSystemsApiRegistrationPayload("http://localhost:3700");
    const expected = [
      "federation-mesh",
      "topology-telemetry",
      "health-dashboard",
      "websocket-push",
      "ecosystem-monitoring",
    ];
    for (const cap of expected) {
      assert.ok(payload.capabilities.includes(cap), `Missing capability: ${cap}`);
    }
  });

  it("metadata fields are all present", () => {
    const payload = buildSystemsApiRegistrationPayload("http://localhost:3700");
    assert.equal(payload.metadata.networkVersion, "v1");
    assert.equal(payload.metadata.supportsFederationMesh, true);
    assert.equal(payload.metadata.supportsTopologyTelemetry, true);
    assert.equal(payload.metadata.supportsWebSocketPush, true);
  });
});
