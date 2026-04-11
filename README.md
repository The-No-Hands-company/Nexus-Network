# Nexus Network

Nexus Network is the sovereign federation telemetry and health dashboard for the Nexus ecosystem.

It aggregates opt-in heartbeat data, exposes live stats, and now participates in the canonical Nexus Cloud topology model.

## Core features

- live heartbeat ingestion
- aggregate stats and historical charts
- WebSocket dashboard updates
- privacy-preserving telemetry only
- cloud discovery and registration contract

## Cloud contract

Nexus Network exposes the canonical Nexus Cloud surface:

- `/.well-known/nexus-cloud`
- `/api/cloud/discovery`
- `/api/cloud/register`
- `/api/cloud/client`

## API surface

| Method | Path | Description |
|---|---|---|
| POST | `/api/heartbeat` | Receive node heartbeat |
| GET | `/api/stats` | Current network stats |
| GET | `/api/health` | Health check |
| WS | `/ws` | Live stats stream |
| GET | `/.well-known/nexus-cloud` | Cloud discovery |
| GET | `/api/cloud/discovery` | Cloud discovery payload |
| POST | `/api/cloud/register` | Cloud registration |
| GET | `/api/cloud/client` | Cloud client contract |

## Development

```bash
npm install
npm run dev
npm run build
```
