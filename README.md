# Nexus-Network

> Real-time federation health dashboard — collective stats across all Nexus nodes worldwide.

The Nexus Network dashboard aggregates voluntary telemetry from all participating Nexus nodes into a single live view. It shows the true scale of the federated network: total nodes, collective RAM, CPU, storage, GPU, active compute jobs, and per-product adoption — updated in real time via WebSocket.

No personal data. No content. Just hardware totals and aggregate load — sent once per minute by nodes that opt in.

---

## What it shows

- **Nodes online** — total active nodes, delta over the last hour
- **Collective RAM / Storage / CPU** — sum of all volunteered hardware, with average load
- **NexusCompute jobs** — distributed compute tasks running across the mesh this hour
- **Countries** — how many countries have at least one federation node
- **Product adoption** — how many nodes run each Nexus product
- **Top nodes** — highest-capacity nodes currently online
- **Federation events** — live feed of nodes joining, upgrading, expanding
- **Compute history** — 24-hour chart of compute offload, AI jobs, and Deploy builds

---

## Architecture

```
Nexus nodes (worldwide)
    │
    │  POST /api/heartbeat  (once per minute, opt-in)
    ▼
nexus-network server
    │  SQLite (WAL mode)
    │  aggregates stats every 5s
    │
    ├──► GET /api/stats          (REST — for external integrations)
    └──► ws://host/ws            (WebSocket — live dashboard updates)
         │
         ▼
    public/index.html            (the dashboard)
```

---

## Heartbeat format

Nodes send a minimal JSON payload once per minute:

```json
{
  "node_id": "sha256-of-domain-and-secret",
  "domain": "nexus.yourdomain.com",
  "version": "1.0.0",
  "products": ["nexus", "nexus-hosting", "nexus-cloud"],
  "hardware": {
    "ram_gb": 32,
    "cpu_cores": 8,
    "gpu_gb": 0,
    "storage_gb": 2000
  },
  "load": {
    "ram_used_pct": 42,
    "cpu_used_pct": 18,
    "storage_used_pct": 31
  },
  "location": {
    "country_code": "SE"
  },
  "compute_jobs_hour": 14
}
```

`node_id` is a stable, anonymous identifier. It does not contain your domain name or any identifiable data — it is derived from a local secret, not transmitted in plaintext.

---

## Running

```bash
# Docker (recommended)
docker compose up -d

# Or locally
npm install
npm run dev
```

Dashboard available at `http://localhost:3700`

---

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/heartbeat` | POST | Receive node heartbeat |
| `/api/stats` | GET | Current network stats (JSON) |
| `/api/health` | GET | Health check |
| `/ws` | WS | Live stats push every 5s |

---

## Privacy

- Nodes opt in explicitly. No heartbeat is sent unless the operator enables it.
- No message content, user data, or personally identifiable information is ever sent.
- Only hardware totals and aggregate load percentages are collected.
- `node_id` is an anonymous token — the domain is sent separately and only used for the "top nodes" display, which operators can suppress.
- This repo is fully open source. Audit everything.

---

## Part of the Nexus Ecosystem

| Repo | What it is |
|---|---|
| [Nexus](https://github.com/The-No-Hands-company/Nexus) | Federated chat & communities |
| [Nexus-Hosting](https://github.com/The-No-Hands-company/Nexus-Hosting) | Federated web hosting |
| [Nexus-Deploy](https://github.com/The-No-Hands-company/Nexus-Deploy) | Federated deployments |
| [Nexus-Network](https://github.com/The-No-Hands-company/Nexus-Network) | This repo — network dashboard |

---

*Part of The No Hands Company — building software that works for people, not the other way around.*  
*Architected by [Zajfan](https://github.com/Zajfan). Built by AI.*
