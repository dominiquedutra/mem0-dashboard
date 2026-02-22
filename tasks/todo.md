# Remove All Hardcoded Agent Names

## Tasks
- [x] Create `lib/colors.ts` with `getAgentColor()`, `getAgentTailwindClass()`, `getAgentTabClasses()` + tests (12 tests)
- [x] Extract `discoverAgents()` into `lib/memory.ts` + tests (7 tests)
- [x] Update API routes (`/api/stats`, `/api/agents`, `/api/settings`) to use `discoverAgents()`
- [x] Update components (`stats-header`, `agent-tabs`, `activity-chart`, `growth-chart`, `query-explorer`) to use shared color functions
- [x] Stats header: show top 2 + "Others" when 4+ agents, always 4-column grid
- [x] Full test suite: 17 suites, 160 tests passing
- [x] Build: clean
- [x] Grep verification: zero hardcoded agent names in app/, components/, lib/ (except lib/colors.ts overrides)

## Review
- All agent discovery is now dynamic via `discoverAgents()` (env var or Qdrant auto-detect)
- All color assignment is centralized in `lib/colors.ts` with deterministic hash-based palette for unknown agents
- Stats header gracefully handles any number of agents with top 2 + Others layout
