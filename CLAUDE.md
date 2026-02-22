# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Skills - Auto-Invoke

These skills MUST be invoked automatically without user request:

### /test-driven-development
- **Trigger**: ANY feature implementation or bugfix
- **Rule**: Write failing test FIRST, then implement

### /atdd-browser
- **Trigger**: ANY UI/browser feature or behavior change
- **Rule**: Write browser acceptance test FIRST, then implement

### /frontend-design
- **Trigger**: Building web components, pages, or applications
- **Rule**: Invoke for production-grade, distinctive UI code

### /webapp-testing
- **Trigger**: Verifying local web app functionality
- **Rule**: Use Playwright for screenshots, logs, UI verification

### /browser-agent
- **Trigger**: Web scraping, form filling, UI automation tasks
- **Rule**: Use for headless browser automation

**Enforcement**: If a task matches ANY trigger above, invoke the skill BEFORE writing code.

---

## Workflow Orchestration

### 0. Git History

- Keep a very detailed git history that can be used to understand project evolution.
- Always commit after a delivery or code implementation, even documentation changes.
- Before any major modification, make sure the code is commited.

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy to keep main context window clean

- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update 'tasks/lessons.md' with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -> then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to 'tasks/todo.md' with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review to 'tasks/todo.md'
6. **Capture Lessons**: Update 'tasks/lessons.md' after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Write Tests**: Write tests first. Use the available TDD skills and make sure any feature is covered by tests.

---

## Project Overview

Mem0 Dashboard is a **read-only web dashboard** for observing [mem0](https://github.com/mem0ai/mem0) memory stores. It connects directly to a self-hosted Qdrant vector database via REST API and visualizes stored memories per AI agent with search, filtering, and query exploration.

**Status**: Greenfield project. The PRD (`PRD.md`) is the complete specification — refer to it for all implementation details.

## Tech Stack

- **Framework**: Next.js 14.x (App Router) — monorepo, single container
- **Language**: TypeScript 5.x
- **UI**: shadcn/ui + Tailwind CSS 3.x + Framer Motion 11.x
- **Data**: `@qdrant/js-client-rest` (Qdrant client), `openai` (embeddings for Query Explorer)
- **Deployment**: Docker + Docker Compose, Node.js 20 Alpine
- **Dark mode only** — forced via `<html className="dark">`

## Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
```

### Docker

```bash
docker compose up -d --build    # Build and start (port 8765 → 3000)
docker compose down             # Stop
```

### shadcn/ui Components

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add badge button card input select skeleton tabs tooltip
```

## Architecture

### Directory Layout

- `app/` — Next.js App Router pages and API routes
  - `app/page.tsx` — Server component, fetches initial stats for fast FCP
  - `app/api/` — Route handlers (stats, memories, recent, agents, explore, performance)
- `components/` — React components
  - `components/ui/` — shadcn/ui generated components (do not edit manually)
  - Top-level components: stats-header, memory-card, memory-list, agent-tabs, activity-feed, query-explorer, live-indicator
- `lib/` — Shared utilities
  - `qdrant.ts` — Qdrant client setup + helpers
  - `openai.ts` — OpenAI embedding helpers
  - `memory.ts` — Field resolution for dual schema (see below)
  - `utils.ts` — `cn()` utility
- `types/memory.ts` — TypeScript interfaces

### Dual Schema Resolution (CRITICAL)

The Qdrant collection has **two schema generations** due to a migration. Every piece of code that reads memory payloads MUST handle both:

```typescript
// Old schema fields: user_id, created_at (no runId)
// New schema fields: userId, createdAt, runId
// Some records have BOTH user_id and userId

const resolveAgent = (p) => p.userId ?? p.user_id ?? "unknown";
const resolveTimestamp = (p) => p.createdAt ?? p.created_at ?? null;
const resolveRunId = (p) => p.runId ?? null;
```

All Qdrant filters must use `should` (OR) to match both field names:
```json
{ "should": [
  {"key": "userId", "match": {"value": "clawd"}},
  {"key": "user_id", "match": {"value": "clawd"}}
]}
```

### runId Label Mapping

`runId` values are parsed into human-readable labels:

| Pattern | Label |
|---------|-------|
| `agent:main:discord:channel:<id>` | `discord #<last 4 chars>` |
| `agent:main:discord:thread:<id>` | `discord thread` |
| `agent:main:cron:<uuid>` | `cron` |
| `agent:main:telegram:*` | `telegram` |
| `agent:sub:*` | `sub-agent` |
| null / anything else | `—` |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stats` | GET | Memory counts per agent |
| `/api/memories` | GET | Paginated memory list (params: agent, limit, offset, sort) |
| `/api/recent` | GET | Activity feed (params: hours, agent) |
| `/api/agents` | GET | Auto-detect agents from collection or env var |
| `/api/explore` | POST | Query → OpenAI embedding → Qdrant vector search → ranked results |
| `/api/performance` | GET | Qdrant telemetry + Prometheus metrics |

### Agent Colors

| Agent | Color |
|-------|-------|
| clawd | blue `#3b82f6` |
| ana | green `#22c55e` |
| norma | orange `#f97316` |
| unknown | gray `#6b7280` |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | Yes | `http://localhost:6333` | Qdrant REST API endpoint |
| `QDRANT_COLLECTION` | Yes | `openclaw-memories` | Collection name |
| `OPENAI_API_KEY` | For Query Explorer | — | Must use same model as mem0 stack |
| `OPENAI_EMBEDDING_MODEL` | For Query Explorer | `text-embedding-3-small` | Embedding model |
| `DASHBOARD_PORT` | No | `8765` | External port (Docker) |
| `AGENTS` | No | auto-detect | Comma-separated agent list |
| `REFRESH_INTERVAL` | No | `60` | Auto-refresh interval in seconds |

## Implementation Phases

- **Phase 1**: Memory Browser — stats header, agent tabs, memory list with search/pagination, activity feed, skeleton loading states
- **Phase 2**: Query Explorer — natural language query → vector search with similarity scores, performance tab from Qdrant telemetry

## Key Constraints

- **Read-only** — never write/modify/delete memories in Qdrant
- **No auth** in v1 — LAN-only deployment
- **Sorting in Node.js** — Qdrant can't sort on string timestamp fields, sort after fetching
- **Standalone output** — `next.config.ts` must have `output: 'standalone'` for Docker
- **Client-side search** — substring match on loaded records, no additional API calls
- **Auto-refresh** — all data auto-refreshes every `REFRESH_INTERVAL` seconds
