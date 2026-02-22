# PRD — Mem0 Dashboard
**Version:** 2.0  
**Date:** 2026-02-22  
**Status:** Ready for implementation  
**Target repo:** `github.com/<org>/mem0-dashboard` (public, MIT license)

---

## 1. Why This Exists

[mem0](https://github.com/mem0ai/mem0) is a memory layer for AI agents. It stores facts extracted from conversations into a vector database (Qdrant) and retrieves relevant ones at each turn. This is extremely powerful — but completely invisible.

There is currently no way to:
- See what memories exist per agent
- Know what was added recently
- Understand what facts get surfaced when an agent answers a question
- Detect hallucinated or wrong memories
- Audit or debug memory-driven behavior

This project builds that visibility layer: a **beautiful, read-only web dashboard** that connects directly to a self-hosted Qdrant instance and gives you full observability over your mem0 memory stack.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Browse memories** | See all stored facts per agent, sorted by recency |
| **Search** | Full-text search across memory content |
| **Activity feed** | What was added in the last 24h / 7d |
| **Query explorer** | Type a natural language query → see what memories would be retrieved |
| **Stats** | Count per agent, total, growth over time |
| **Zero plugin changes** | Dashboard is 100% read-only via Qdrant REST API |
| **Self-hostable** | Single `docker compose up -d`, works on any machine |
| **Beautiful UI** | Production-quality interface using shadcn/ui |
| **Public & reusable** | Designed for any self-hosted mem0 + Qdrant setup |

---

## 3. Non-Goals

- ❌ Writing or modifying memories
- ❌ Connecting to mem0 Cloud (managed service)
- ❌ Supporting vector stores other than Qdrant (in v1)
- ❌ Authentication / multi-user access (v1 is LAN-only)
- ❌ Modifying the mem0 plugin or SDK in any way

---

## 4. Target Environment (Reference Implementation)

This is the production environment the dashboard was designed for. All defaults must match this setup.

| Component | Details |
|-----------|---------|
| **Vector store** | Qdrant `1.17.0` running at `http://10.15.30.2:6333` (no auth) |
| **Collection** | `openclaw-memories` |
| **Embedder** | OpenAI `text-embedding-3-small` (1536 dimensions, Cosine distance) |
| **LLM (extraction)** | `gpt-4o-mini` via OpenAI API |
| **Agents** | `clawd`, `ana`, `norma` |
| **Total memories** | ~913 as of 2026-02-22 |
| **Platform** | Ubuntu 22.04, Docker, homeserver LAN |
| **Plugin** | openclaw-mem0 (Node.js, talks to Qdrant via REST) |
| **Dashboard host** | Same homeserver — LAN access only |

---

## 5. Qdrant Data Schema

The collection `openclaw-memories` stores points with the following payload structure.

### 5.1 Field Naming Inconsistency (CRITICAL)

There are **two schema generations** in the collection due to a migration. The dashboard MUST handle both:

| Field | Old schema (seed/migration) | New schema (plugin) |
|-------|-----------------------------|---------------------|
| Agent identifier | `user_id` (string) | `userId` (string) |
| Timestamp | `created_at` (ISO 8601 with tz offset) | `createdAt` (ISO 8601 UTC) |
| Session reference | *(absent)* | `runId` (string) |

Some records have **both** `user_id` and `userId` (always the same value — transitional state).

### 5.2 Resolution Rule (apply everywhere)

```typescript
const resolveAgent = (payload: Record<string, any>): string =>
  payload.userId ?? payload.user_id ?? "unknown";

const resolveTimestamp = (payload: Record<string, any>): string | null =>
  payload.createdAt ?? payload.created_at ?? null;

const resolveRunId = (payload: Record<string, any>): string | null =>
  payload.runId ?? null;
```

### 5.3 Sample Records

**New schema (plugin-generated):**
```json
{
  "id": "00b89546-0122-49ea-8741-c1e32082e5cd",
  "payload": {
    "userId": "clawd",
    "runId": "agent:main:discord:channel:1474854736590278929",
    "data": "User diagnosed the issue and provided a detailed diagnosis report.",
    "hash": "b30d89fc3a48c2a76a471a3e9ddb4588",
    "createdAt": "2026-02-22T11:51:46.670Z"
  }
}
```

**Old schema (seed-generated):**
```json
{
  "id": "00fd14fb-70e9-4f1d-a39b-6c163567621b",
  "payload": {
    "user_id": "clawd",
    "userId": "clawd",
    "data": "Contatos para o projeto Cargill Uberlândia: Augusto Gomes (Engenharia).",
    "hash": "4efe94994e49623ae9e4606b41b5db46",
    "created_at": "2026-02-21T17:18:25.835258-08:00"
  }
}
```

### 5.4 Agent Counts (as of 2026-02-22)

| Agent | Count |
|-------|-------|
| clawd | ~740+ |
| norma | 104 |
| ana | 69 |
| **Total** | **913** |

### 5.5 runId Format → Human-Readable Label

The `runId` field encodes where a memory was created. Parse it:

| runId pattern | Display label |
|---------------|---------------|
| `agent:main:discord:channel:<id>` | `discord #<last 4 chars of id>` |
| `agent:main:discord:thread:<id>` | `discord thread` |
| `agent:main:cron:<uuid>` | `cron` |
| `agent:main:telegram:*` | `telegram` |
| `agent:sub:*` | `sub-agent` |
| anything else / null | `—` |

### 5.6 Vector Configuration

- **Dimensions:** 1536
- **Distance:** Cosine
- **Storage:** On-disk payload, in-memory vectors

---

## 6. Tech Stack

### 6.1 Frontend + Backend (monorepo, single container)

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| **Framework** | Next.js (App Router) | 14.x | Full-stack in one repo, API routes replace separate backend |
| **Language** | TypeScript | 5.x | Type safety for Qdrant payloads |
| **UI Components** | shadcn/ui | latest | Best open-source component library — Cards, Tabs, Badge, Input, Table, Skeleton |
| **CSS** | Tailwind CSS | 3.x | Comes with shadcn/ui |
| **Animations** | Framer Motion | 11.x | Card entry animations, tab transitions |
| **Charts** | Recharts | 2.x | Agent breakdown, growth timeline (Phase 3) |
| **Date formatting** | date-fns | 3.x | Relative time ("2 hours ago"), absolute formatting |
| **Icons** | Lucide React | latest | Comes with shadcn/ui |
| **Qdrant client** | `@qdrant/js-client-rest` | latest | TypeScript-native Qdrant client |
| **OpenAI client** | `openai` npm package | 4.x | Embedding for Query Explorer |

### 6.2 Infrastructure

| Component | Technology |
|-----------|-----------|
| **Container** | Docker (single image) |
| **Orchestration** | Docker Compose |
| **Node runtime** | Node.js 20 Alpine (inside Docker) |
| **Build** | `next build` at Docker build time |
| **Config** | `.env` file (never committed) |

### 6.3 Why Next.js over FastAPI + Vite

- Single container, single repo, single `docker compose up`
- API routes in TypeScript — same language as frontend, no context switching
- `@qdrant/js-client-rest` is officially maintained and TypeScript-native
- shadcn/ui + Next.js is the canonical setup (zero configuration friction)
- Server components = fast initial load, no client-side data fetching delays

---

## 7. Repository Structure

```
mem0-dashboard/
├── README.md
├── PRD.md
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── app/
│   ├── layout.tsx              # Root layout, dark theme, fonts
│   ├── page.tsx                # Main dashboard page
│   ├── globals.css             # Tailwind base + shadcn CSS vars
│   │
│   └── api/
│       ├── stats/route.ts      # GET /api/stats
│       ├── memories/route.ts   # GET /api/memories
│       ├── recent/route.ts     # GET /api/recent
│       ├── agents/route.ts     # GET /api/agents
│       └── explore/route.ts    # POST /api/explore
│
├── components/
│   ├── ui/                     # shadcn/ui generated components
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── skeleton.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   │
│   ├── stats-header.tsx        # Total + per-agent count cards
│   ├── memory-card.tsx         # Single memory item
│   ├── memory-list.tsx         # Paginated list with search
│   ├── agent-tabs.tsx          # All / clawd / ana / norma tabs
│   ├── activity-feed.tsx       # Recent 24h sidebar
│   ├── query-explorer.tsx      # Query → embed → search results
│   └── live-indicator.tsx      # 🟢 Live badge with pulse animation
│
├── lib/
│   ├── qdrant.ts               # Qdrant client + helper functions
│   ├── openai.ts               # OpenAI embedding helper
│   ├── memory.ts               # Memory type + field resolution utils
│   └── utils.ts                # shadcn cn() utility + misc
│
└── types/
    └── memory.ts               # TypeScript types
```

---

## 8. TypeScript Types

```typescript
// types/memory.ts

export interface RawQdrantPayload {
  // New schema
  userId?: string;
  createdAt?: string;
  runId?: string;
  // Old schema
  user_id?: string;
  created_at?: string;
  // Always present
  data: string;
  hash: string;
}

export interface Memory {
  id: string;
  agent: string;           // resolved from userId ?? user_id
  data: string;
  createdAt: string | null; // resolved from createdAt ?? created_at
  runId: string | null;
  runLabel: string;         // human-readable runId
  hash: string;
}

export interface AgentStats {
  [agent: string]: number;
}

export interface StatsResponse {
  total: number;
  agents: AgentStats;
  collection: string;
  lastUpdated: string;
}

export interface MemoriesResponse {
  total: number;
  offset: number;
  limit: number;
  memories: Memory[];
}

export interface ExploreResult extends Memory {
  score: number;
}

export interface ExploreResponse {
  query: string;
  agent: string | null;
  results: ExploreResult[];
}
```

---

## 9. Configuration (.env)

```env
# Qdrant connection
QDRANT_URL=http://10.15.30.2:6333
QDRANT_COLLECTION=openclaw-memories

# OpenAI — required only for Query Explorer
# Must use the SAME model as your mem0 stack
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Dashboard
DASHBOARD_PORT=8765

# Agents (comma-separated). Leave empty to auto-detect from collection.
AGENTS=clawd,norma,ana

# Auto-refresh interval in seconds (default: 60)
REFRESH_INTERVAL=60
```

`.env.example` ships with the repo (no secrets, just placeholders).

---

## 10. API Routes

All routes are Next.js Route Handlers in `app/api/`.

### `GET /api/stats`

Fetches count per agent using Qdrant's count endpoint.  
Uses `should` filter to handle both `userId` and `user_id` field names.

**Response:**
```json
{
  "total": 913,
  "agents": {
    "clawd": 740,
    "ana": 69,
    "norma": 104
  },
  "collection": "openclaw-memories",
  "lastUpdated": "2026-02-22T14:30:00Z"
}
```

**Qdrant call per agent:**
```json
POST /collections/openclaw-memories/points/count
{
  "filter": {
    "should": [
      {"key": "userId", "match": {"value": "clawd"}},
      {"key": "user_id", "match": {"value": "clawd"}}
    ]
  },
  "exact": true
}
```

---

### `GET /api/memories`

**Query params:**
- `agent` (string, optional) — filter by agent
- `limit` (int, default=50, max=200)
- `offset` (int, default=0)
- `sort` (`newest` | `oldest`, default=`newest`)

**Implementation:**
1. Call Qdrant scroll API with optional agent filter
2. Fetch in batches of 100 until `limit` reached
3. Resolve fields using `resolveAgent()`, `resolveTimestamp()`, `resolveRunId()`
4. Sort in Node.js by resolved timestamp (Qdrant can't sort on string timestamp fields)
5. Apply offset + limit slicing
6. Return normalized `Memory[]`

**Qdrant scroll call:**
```json
POST /collections/openclaw-memories/points/scroll
{
  "limit": 100,
  "with_payload": true,
  "with_vector": false,
  "filter": {
    "should": [
      {"key": "userId", "match": {"value": "clawd"}},
      {"key": "user_id", "match": {"value": "clawd"}}
    ]
  }
}
```
For "all agents", omit the `filter` entirely.

**Response:**
```json
{
  "total": 740,
  "offset": 0,
  "limit": 50,
  "memories": [
    {
      "id": "00b89546-...",
      "agent": "clawd",
      "data": "User diagnosed the issue...",
      "createdAt": "2026-02-22T11:51:46.670Z",
      "runId": "agent:main:discord:channel:1474854736590278929",
      "runLabel": "discord #8929",
      "hash": "b30d89fc..."
    }
  ]
}
```

---

### `GET /api/recent`

**Query params:**
- `hours` (int, default=24, max=168)
- `agent` (string, optional)

**Implementation:**
1. Fetch all memories for the agent (or all agents)
2. Resolve timestamps
3. Filter to those where `createdAt > (now - hours)`
4. Sort newest first
5. Return up to 50

---

### `GET /api/agents`

Auto-detects agents from collection if `AGENTS` env var is empty.  
Scrolls the collection sampling 500 records, extracts unique agent values.  
Falls back to `AGENTS` env var (split by comma) if set.

**Response:**
```json
{
  "agents": ["clawd", "norma", "ana"]
}
```

---

### `POST /api/explore`

**Request body:**
```json
{
  "query": "What do I know about Cargill?",
  "agent": "clawd",
  "topK": 10
}
```

**Implementation:**
1. Call OpenAI embeddings API with `query` text using `OPENAI_EMBEDDING_MODEL`
2. Send embedding vector to Qdrant search endpoint
3. Resolve fields on results
4. Return ranked list with similarity scores

**Qdrant vector search:**
```json
POST /collections/openclaw-memories/points/search
{
  "vector": [/* 1536 floats */],
  "limit": 10,
  "with_payload": true,
  "score_threshold": 0.0,
  "filter": {
    "should": [
      {"key": "userId", "match": {"value": "clawd"}},
      {"key": "user_id", "match": {"value": "clawd"}}
    ]
  }
}
```

**Response:**
```json
{
  "query": "What do I know about Cargill?",
  "agent": "clawd",
  "results": [
    {
      "id": "...",
      "agent": "clawd",
      "data": "Contatos para o projeto Cargill Uberlândia...",
      "score": 0.87,
      "createdAt": "2026-02-21T17:18:25Z",
      "runLabel": "—"
    }
  ]
}
```

---

## 11. Performance Tab (inspired by mem0-analytics)

Data sourced entirely from Qdrant's built-in telemetry endpoints. Zero plugin changes required.

### 11.1 Data Sources

**`GET /telemetry`** — Qdrant REST telemetry (available since Qdrant v1.x):
```
http://QDRANT_URL/telemetry
```

**`GET /metrics`** — Prometheus metrics:
```
http://QDRANT_URL/metrics
```

### 11.2 API Route: `GET /api/performance`

Fetches and parses both endpoints, returns structured stats:

```typescript
interface PerformanceStats {
  qdrant: {
    version: string;
    uptime_since: string;       // ISO timestamp from telemetry.app.startup
    uptime_human: string;       // "3 days, 4 hours"
  };
  search: {
    total_calls: number;        // sum of /search + /query 200 responses
    avg_latency_ms: number;     // weighted avg of both endpoints
    success_rate: number;       // 0.0–1.0
    errors: number;
  };
  writes: {
    total_calls: number;        // PUT /points 200 count
    avg_latency_ms: number;
    deletes: number;            // POST /points/delete 200 count
    payload_updates: number;    // POST /points/payload 200 count
  };
  vectors: {
    total: number;              // from Prometheus: collections_vector_total
    per_collection: Record<string, number>; // collection_vectors per collection
  };
}
```

**Telemetry endpoint keys to extract:**

| Metric | Telemetry key |
|--------|---------------|
| Search calls | `requests.rest.responses["POST /collections/{name}/points/search"]["200"].count` |
| Search latency | `requests.rest.responses["POST /collections/{name}/points/search"]["200"].avg_duration_micros / 1000` |
| Query calls | `requests.rest.responses["POST /collections/{name}/points/query"]["200"].count` |
| Query latency | `requests.rest.responses["POST /collections/{name}/points/query"]["200"].avg_duration_micros / 1000` |
| Write calls | `requests.rest.responses["PUT /collections/{name}/points"]["200"].count` |
| Write latency | `requests.rest.responses["PUT /collections/{name}/points"]["200"].avg_duration_micros / 1000` |
| Deletes | `requests.rest.responses["POST /collections/{name}/points/delete"]["200"].count` |
| Payload updates | `requests.rest.responses["POST /collections/{name}/points/payload"]["200"].count` |
| Errors (search) | sum of non-200 counts for search endpoint |
| Uptime since | `app.startup` |
| Version | `app.version` |

**Prometheus keys to extract (parse line by line):**
```
collections_vector_total          → total vectors across all collections
collection_vectors{collection="openclaw-memories",...}  → per-collection vector count
```

### 11.3 Performance Tab UI Layout

```
┌───────────────────────────────────────────────────────────┐
│  ⚡ Performance                    Qdrant v1.17.0  ⏱️ 3d │
├───────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  🔍 Searches │  │  📝 Writes   │  │  ✅ Success  │   │
│  │    3,782     │  │    2,317     │  │    99.4%     │   │
│  │  avg 5ms     │  │  avg 9ms     │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 🗑️ Deletes  │  │ 🔄 Updates   │  │ 🧠 Vectors   │   │
│  │      30      │  │     616      │  │     991      │   │
│  │              │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                           │
│  Note: Stats since last Qdrant restart (2026-02-21 18:12)│
└───────────────────────────────────────────────────────────┘
```

Cards use the same shadcn `<Card>` component as the stats header.  
All stats auto-refresh every 60 seconds.  
Small note at bottom: "Stats since last Qdrant restart" + timestamp.

### 11.4 Navigation Tabs (top-level)

Add a top-level tab bar to the page with two views:

| Tab | Content |
|-----|---------|
| **Memories** | Memory Browser (current P1 spec) |
| **Performance** | Performance stats from Qdrant telemetry |

Use shadcn `<Tabs>` at the page level (outside the agent filter tabs).

---

## 12. Frontend — Pages & Components

### 11.1 Root Layout (`app/layout.tsx`)

- Dark theme forced: `<html className="dark">`
- Font: Inter via `next/font/google`
- Background: `bg-background` (maps to `#0f1117` in dark mode)
- shadcn/ui CSS variables in `globals.css`
- Page title: "Mem0 Dashboard"

### 11.2 Main Page (`app/page.tsx`)

Server component. Fetches initial stats on server side (fast first paint).  
Client components handle interactivity.

Layout (desktop, min 1280px):
```
┌────────────────────────────────────────────────────────────┐
│  Header: logo + title + Live indicator + last updated      │
├────────────────────────────────────────────────────────────┤
│  StatsHeader: 4 cards (Total | clawd | ana | norma)        │
├────────────────────────┬───────────────────────────────────┤
│                        │                                   │
│  AgentTabs + Search    │  ActivityFeed (last 24h)          │
│  MemoryList (main)     │  ──────────────────────           │
│                        │  QueryExplorer                    │
│                        │                                   │
└────────────────────────┴───────────────────────────────────┘
```

Mobile (< 768px): single column, tabs collapse, sidebar goes below.

### 11.3 StatsHeader Component

4 `<Card>` components in a row:
- **Total** — big number, neutral color
- **clawd** — blue (`#3b82f6`)
- **ana** — green (`#22c55e`)
- **norma** — orange (`#f97316`)

Each card shows:
- Agent name (or "Total")
- Large count number with `AnimatePresence` counter animation (Framer Motion)
- Subtitle: "memories"
- `<Skeleton>` shown while loading

### 11.4 AgentTabs Component

`<Tabs>` from shadcn/ui with values: `all`, `clawd`, `ana`, `norma`  
Each tab label includes a `<Badge>` with the count.  
Switching tab triggers `MemoryList` to refetch with the `agent` filter.

### 11.5 MemoryList Component

Client component. Fetches from `/api/memories`.

- Search input at the top (`<Input>` with search icon + clear button)
- Search is client-side filter on loaded records (substring match on `data`, case-insensitive)
- Result count label: "Showing 12 of 50 memories"
- Memory cards rendered with `AnimatePresence` (staggered entry animation)
- Pagination: `[← Prev]` `Page 1 of 19` `[Next →]` buttons
- `<Skeleton>` cards (3) shown during loading

### 11.6 MemoryCard Component

Each memory rendered as a `<Card>` with:

```
┌──────────────────────────────────────────────────────┐
│ [🔵 clawd]  [discord #8929]              2 hours ago │
│                                                      │
│ User diagnosed the issue and provided a detailed     │
│ diagnosis report regarding the plugin's behavior.    │
│                                                      │
│ id: 00b89546  [copy icon]                           │
└──────────────────────────────────────────────────────┘
```

- Agent badge: colored per agent (blue/green/orange)
- runLabel badge: muted secondary color
- Timestamp: `date-fns formatDistanceToNow()` relative + tooltip with full ISO on hover
- Content: full text, no truncation (wrap naturally)
- UUID: first 8 chars shown, copy-to-clipboard on click (toast notification)
- Hover state: subtle border highlight

### 11.7 ActivityFeed Component

Sidebar section. Fetches from `/api/recent?hours=24`.  
Auto-refreshes every `REFRESH_INTERVAL` seconds.

- Header: "🕐 Recent (24h)"
- Each item: one-line compact (agent badge + first 60 chars of data + relative time)
- Max 10 items shown
- "No new memories in the last 24h" empty state
- `<Skeleton>` during loading

### 11.8 QueryExplorer Component

Sidebar section below ActivityFeed.

- Header: "🔍 Query Explorer"
- `<Input>` placeholder: "Ask anything..."
- Agent selector: `<Select>` with All / clawd / ana / norma options
- Top K: `<Select>` with 5 / 10 / 20
- `<Button>` "Explore"
- Loading state: spinner on button
- Results list:
  - Each result: score badge (color-coded) + data text + timestamp
  - Score color: green ≥ 0.7, yellow ≥ 0.4, red < 0.4
  - Score shown as percentage: "87%"
- Empty state: "No memories found"
- Error state if `OPENAI_API_KEY` not set: "Query Explorer requires an OpenAI API key. Set OPENAI_API_KEY in .env"

### 11.9 LiveIndicator Component

Small component in header:
- Green pulsing dot + "Live" text when auto-refresh is active
- Shows "Last updated: 2 min ago"
- Clicking it triggers manual refresh

---

## 13. Design Tokens (Tailwind + shadcn)

### Colors (dark mode)

```css
/* globals.css — shadcn CSS variables */
:root {
  --background: 222 47% 6%;        /* #0c0f18 */
  --foreground: 213 31% 91%;       /* #e2e8f0 */
  --card: 222 47% 9%;              /* #111827 */
  --card-foreground: 213 31% 91%;
  --border: 216 34% 17%;           /* #1e2a3a */
  --muted: 223 47% 11%;
  --muted-foreground: 215 20% 55%; /* #64748b */
  --primary: 217 91% 60%;          /* #3b82f6 blue */
  --accent: 217 33% 17%;
}
```

### Agent Colors (custom CSS vars)

```css
--agent-clawd: #3b82f6;   /* blue-500 */
--agent-ana: #22c55e;     /* green-500 */
--agent-norma: #f97316;   /* orange-500 */
--agent-unknown: #6b7280; /* gray-500 */
```

### Typography

- Font family: Inter (Google Fonts)
- Font weights used: 400 (body), 500 (labels), 600 (headings), 700 (stats numbers)
- Memory data text: 14px, `text-foreground`
- Timestamps: 12px, `text-muted-foreground`
- Stat numbers: 32px, font-bold

---

## 13. Docker Setup

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  mem0-dashboard:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mem0-dashboard
    ports:
      - "${DASHBOARD_PORT:-8765}:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # ^ Needed if QDRANT_URL uses the host IP (10.15.30.2)
    # Docker container must reach the Qdrant on LAN
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

> **Note:** Requires `output: 'standalone'` in `next.config.ts`.

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

### `.gitignore`

```
node_modules/
.next/
.env
*.local
```

---

## 14. Deployment Instructions (Reference Homeserver)

```bash
# 1. SSH into homeserver
ssh homeserver

# 2. Clone the repo
cd ~/docker
git clone https://github.com/<org>/mem0-dashboard
cd mem0-dashboard

# 3. Configure
cp .env.example .env
nano .env
# Set:
#   QDRANT_URL=http://10.15.30.2:6333
#   QDRANT_COLLECTION=openclaw-memories
#   OPENAI_API_KEY=sk-...
#   AGENTS=clawd,norma,ana

# 4. Build and start
docker compose up -d --build

# 5. Access
# Open http://10.15.30.2:8765 in browser

# Update later
git pull && docker compose up -d --build
```

---

## 15. `package.json` (key dependencies)

```json
{
  "name": "mem0-dashboard",
  "version": "0.1.0",
  "private": false,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.x",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "@qdrant/js-client-rest": "^1.x",
    "openai": "^4.x",
    "date-fns": "^3.x",
    "framer-motion": "^11.x",
    "recharts": "^2.x",
    "lucide-react": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "tailwindcss-animate": "latest"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3.x",
    "postcss": "^8",
    "autoprefixer": "^10",
    "eslint": "^8",
    "eslint-config-next": "14.2.x"
  }
}
```

### shadcn/ui components to install

Run after `npx create-next-app` or manually add:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add badge button card input select skeleton tabs tooltip
```

---

## 16. README.md Requirements

Must include:

1. **Hero section** — "Memory observability for self-hosted mem0 stacks"
2. **Screenshot** — full dashboard screenshot (add after first working build)
3. **Features list** — bullet points with emoji
4. **Quick start** — 5-line code block: clone → cp .env → edit → docker compose up
5. **Configuration table** — all `.env` variables with description and defaults
6. **Qdrant compatibility note** — dual schema (`userId`/`user_id`) handled automatically
7. **Query Explorer note** — requires OpenAI API key with same model as mem0 setup
8. **Contributing** — "PRs welcome. Open an issue first for major changes."
9. **License** — MIT

---

## 17. Acceptance Criteria

### Phase 1 — Memory Browser ✅

- [ ] Dashboard loads and shows correct memory counts within 2 seconds
- [ ] Agent tabs filter correctly (handles both `userId` and `user_id` fields)
- [ ] Memories sorted newest-first by resolved timestamp
- [ ] Search filters instantly without additional API calls
- [ ] Activity feed shows last 24h additions, auto-refreshes every 60s
- [ ] runId displayed in human-readable format per the label table in §5.5
- [ ] Pagination works (50 per page, page X of Y displayed)
- [ ] Memory UUID copy-to-clipboard works
- [ ] Dark theme, readable at 1280px+ width
- [ ] Mobile layout works at 375px (single column)
- [ ] `docker compose up -d --build` starts the service cleanly
- [ ] Service accessible at `http://localhost:8765` after `docker compose up`
- [ ] `<Skeleton>` shown correctly during all loading states

### Phase 2 — Query Explorer ✅

- [ ] Results return in < 3 seconds for any query
- [ ] Similarity scores displayed and correctly color-coded (green/yellow/red)
- [ ] Agent filter scopes results correctly
- [ ] Empty state shown when no results above threshold
- [ ] Error state shown if `OPENAI_API_KEY` missing or invalid
- [ ] Results update on each new query submission

---

## 18. Open Questions / Future Roadmap

| Item | Phase |
|------|-------|
| Delete bad memories (write operation) | v2 |
| Password protection for external access | v2 |
| Prometheus `/metrics` endpoint for Grafana | v2 |
| Memory growth chart (Recharts) | v2 |
| Support ChromaDB / Weaviate | v2 |
| Memory edit history via hash tracking | Research |
| Export memories to CSV / JSON | v2 |

---

*Generated by Clawd on 2026-02-22. Reference environment: Fibersals homeserver.*  
*Stack: Next.js 14 + shadcn/ui + TypeScript + @qdrant/js-client-rest + Docker*
