# Mem0 Dashboard

A read-only web dashboard for observing [mem0](https://github.com/mem0ai/mem0) memory stores.

## Why

Self-hosted mem0 has no built-in way to see what your AI agents actually remember. Memories live inside a Qdrant vector database as opaque embeddings and payloads — there's no UI to browse, search, or monitor them.

This dashboard gives you visibility into that black box: what each agent knows, how memories grow over time, and a way to query them using natural language.

## What it does

- **Memory Browser** — paginated list of all stored memories, filterable by agent, with client-side search
- **Agent Tabs** — per-agent memory counts and quick switching (auto-detected from Qdrant data)
- **Activity Feed** — recent memory activity across all agents
- **Query Explorer** — natural language search via OpenAI embeddings + Qdrant vector similarity
- **Performance** — Qdrant telemetry, search/write latency, time-series activity charts
- **Settings** — read-only view of mem0 + Qdrant + dashboard configuration
- **Auto-refresh** — all data refreshes on a configurable interval
- **Dark mode only** — designed for terminal-adjacent workflows

## Quick start

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your Qdrant URL and (optionally) OpenAI key

docker compose up -d --build
# Dashboard available at http://localhost:8765
```

### Local development

```bash
npm install
cp .env.example .env
# Edit .env

npm run dev
# http://localhost:3000
```

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | Yes | `http://localhost:6333` | Qdrant REST API endpoint |
| `QDRANT_COLLECTION` | Yes | `openclaw-memories` | Collection name |
| `OPENAI_API_KEY` | For Query Explorer | — | Must use same embedding model as your mem0 stack |
| `OPENAI_EMBEDDING_MODEL` | For Query Explorer | `text-embedding-3-small` | Embedding model |
| `DASHBOARD_PORT` | No | `8765` | External port (Docker) |
| `AGENTS` | No | auto-detect | Comma-separated agent list |
| `REFRESH_INTERVAL` | No | `60` | Auto-refresh interval in seconds |

## Tech stack

- **Next.js 14** (App Router) — single container, standalone output
- **TypeScript**
- **shadcn/ui + Tailwind CSS + Framer Motion**
- **@qdrant/js-client-rest** — direct Qdrant access
- **openai** — embeddings for Query Explorer
- **Docker** — Node.js 20 Alpine, multi-stage build

## Important: dual schema

The Qdrant collection may contain records from two schema generations (pre/post mem0 migration). The dashboard handles both transparently:

```
Old: user_id, created_at          (no runId)
New: userId, createdAt, runId
```

All queries use `should` (OR) filters to match both field names.

## Constraints

- **Read-only** — the dashboard never writes, modifies, or deletes memories
- **No auth** — designed for LAN-only deployment
- **Sorting in Node.js** — Qdrant can't sort on string timestamp fields

## License

MIT
