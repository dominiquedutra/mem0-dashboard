import type { RawQdrantPayload } from "@/types/memory"

// ---------- next/server mock ----------

class MockNextResponse {
  private _body: unknown
  private _init: { status?: number }

  constructor(body: string, init?: { status?: number }) {
    this._body = JSON.parse(body)
    this._init = init ?? {}
  }

  get status() {
    return this._init.status ?? 200
  }

  async json() {
    return this._body
  }

  static json(data: unknown, init?: { status?: number }) {
    return new MockNextResponse(JSON.stringify(data), init)
  }
}

jest.mock("next/server", () => ({
  NextResponse: MockNextResponse,
}))

// ---------- qdrant mock ----------

const mockScroll = jest.fn()
const mockGetCollection = jest.fn()

jest.mock("@/lib/qdrant", () => ({
  getQdrantClient: jest.fn(() => ({
    scroll: mockScroll,
    getCollection: mockGetCollection,
  })),
  getCollection: jest.fn(() => "test-collection"),
}))

// ---------- helpers ----------

function makePoint(id: string, payload: RawQdrantPayload) {
  return { id, payload }
}

function scrollResponse(points: ReturnType<typeof makePoint>[]) {
  return { points, next_page_offset: null }
}

// ---------- fixtures ----------

const now = new Date("2026-02-22T12:00:00Z")

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
  jest.useFakeTimers()
  jest.setSystemTime(now)
})

afterEach(() => {
  jest.useRealTimers()
})

const mockFetch = jest.fn()
global.fetch = mockFetch

// Helper to set up standard mocks for a test
function setupMocks(opts: {
  telemetryPutCount?: number
  collectionPointsCount?: number
  points?: ReturnType<typeof makePoint>[]
}) {
  const {
    telemetryPutCount = 2488,
    collectionPointsCount = 1120,
    points = [],
  } = opts

  // Mock fetch for telemetry endpoint
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      result: {
        requests: {
          rest: {
            responses: {
              PUT: {
                "200": telemetryPutCount,
              },
            },
          },
        },
      },
    }),
  } as Response)

  // Mock getCollection on client
  mockGetCollection.mockResolvedValue({
    points_count: collectionPointsCount,
  })

  // Mock scroll
  mockScroll.mockResolvedValue(scrollResponse(points))
}

// ===== GET /api/mem0-health =====

describe("GET /api/mem0-health", () => {
  // --- Deduplication ---

  it("calculates deduplication rate correctly", async () => {
    setupMocks({
      telemetryPutCount: 2488,
      collectionPointsCount: 1120,
      points: [
        makePoint("1", {
          userId: "clawd",
          createdAt: "2026-02-22T10:00:00Z",
          data: "hello",
          hash: "h1",
        }),
      ],
    })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.deduplication.attempted_writes).toBe(2488)
    expect(body.deduplication.stored_memories).toBe(1120)
    // dedup_rate = 1 - (1120 / 2488) ≈ 0.5498
    expect(body.deduplication.dedup_rate).toBeCloseTo(0.5498, 2)
    expect(body.deduplication.saved_embeddings).toBe(2488 - 1120)
  })

  it("clamps dedup_rate to 0 when attempted is 0", async () => {
    setupMocks({
      telemetryPutCount: 0,
      collectionPointsCount: 0,
      points: [],
    })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.deduplication.dedup_rate).toBe(0)
    expect(body.deduplication.saved_embeddings).toBe(0)
  })

  // --- Velocity ---

  it("calculates velocity today/yesterday/last_7d correctly", async () => {
    const points = [
      // Today (2026-02-22)
      makePoint("1", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00Z",
        data: "today memory 1",
        hash: "h1",
      }),
      makePoint("2", {
        userId: "clawd",
        createdAt: "2026-02-22T08:00:00Z",
        data: "today memory 2",
        hash: "h2",
      }),
      makePoint("3", {
        userId: "ana",
        createdAt: "2026-02-22T06:00:00Z",
        data: "today memory 3",
        hash: "h3",
      }),
      // Yesterday (2026-02-21)
      makePoint("4", {
        userId: "clawd",
        createdAt: "2026-02-21T15:00:00Z",
        data: "yesterday memory",
        hash: "h4",
      }),
      // 3 days ago (2026-02-19) - within last 7 days
      makePoint("5", {
        userId: "ana",
        createdAt: "2026-02-19T12:00:00Z",
        data: "three days ago",
        hash: "h5",
      }),
      // 10 days ago (2026-02-12) - outside last 7 days
      makePoint("6", {
        userId: "norma",
        createdAt: "2026-02-12T12:00:00Z",
        data: "old memory",
        hash: "h6",
      }),
    ]

    setupMocks({ points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.velocity.today).toBe(3)
    expect(body.velocity.yesterday).toBe(1)
    expect(body.velocity.last_7d).toBe(5) // today + yesterday + 3 days ago
  })

  it("returns trend 'up' when today > yesterday", async () => {
    const points = [
      makePoint("1", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00Z",
        data: "today",
        hash: "h1",
      }),
      makePoint("2", {
        userId: "clawd",
        createdAt: "2026-02-22T08:00:00Z",
        data: "today 2",
        hash: "h2",
      }),
      makePoint("3", {
        userId: "clawd",
        createdAt: "2026-02-21T15:00:00Z",
        data: "yesterday",
        hash: "h3",
      }),
    ]

    setupMocks({ points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.velocity.trend).toBe("up")
  })

  it("returns trend 'down' when today < yesterday", async () => {
    const points = [
      makePoint("1", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00Z",
        data: "today",
        hash: "h1",
      }),
      makePoint("2", {
        userId: "clawd",
        createdAt: "2026-02-21T15:00:00Z",
        data: "yesterday 1",
        hash: "h2",
      }),
      makePoint("3", {
        userId: "clawd",
        createdAt: "2026-02-21T14:00:00Z",
        data: "yesterday 2",
        hash: "h3",
      }),
    ]

    setupMocks({ points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.velocity.trend).toBe("down")
  })

  it("returns trend 'stable' when today equals yesterday", async () => {
    const points = [
      makePoint("1", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00Z",
        data: "today",
        hash: "h1",
      }),
      makePoint("2", {
        userId: "clawd",
        createdAt: "2026-02-21T15:00:00Z",
        data: "yesterday",
        hash: "h2",
      }),
    ]

    setupMocks({ points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.velocity.trend).toBe("stable")
  })

  // --- Top Sources ---

  it("returns top sources sorted by count, max 8", async () => {
    const sources = [
      "agent:main:discord:channel:1234567890",
      "agent:main:discord:channel:1234567890",
      "agent:main:discord:channel:1234567890",
      "agent:main:cron:abc",
      "agent:main:cron:abc",
      "agent:main:telegram:chat1",
      null,
      null,
      null,
      null,
    ]

    const points = sources.map((runId, i) =>
      makePoint(`s${i}`, {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00Z",
        runId: runId ?? undefined,
        data: `memory ${i}`,
        hash: `h${i}`,
      }),
    )

    setupMocks({ points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.top_sources.length).toBeLessThanOrEqual(8)
    // null runId (4 items) should be first (label "seed/unknown")
    expect(body.top_sources[0].count).toBe(4)
    expect(body.top_sources[0].label).toBe("seed/unknown")
    // discord channel (3 items)
    expect(body.top_sources[1].count).toBe(3)
    expect(body.top_sources[1].label).toBe("discord #7890")
    // cron (2 items)
    expect(body.top_sources[2].count).toBe(2)
    expect(body.top_sources[2].label).toBe("cron")
    // telegram (1 item)
    expect(body.top_sources[3].count).toBe(1)
    expect(body.top_sources[3].label).toBe("telegram")
  })

  // --- Memory Density ---

  it("calculates memory density per agent correctly", async () => {
    const points = [
      makePoint("1", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00Z",
        data: "1234567890", // 10 chars
        hash: "h1",
      }),
      makePoint("2", {
        userId: "clawd",
        createdAt: "2026-02-22T09:00:00Z",
        data: "12345678901234567890", // 20 chars
        hash: "h2",
      }),
      makePoint("3", {
        userId: "ana",
        createdAt: "2026-02-22T08:00:00Z",
        data: "123456", // 6 chars
        hash: "h3",
      }),
    ]

    setupMocks({ points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    const clawd = body.memory_density.find((d: { agent: string }) => d.agent === "clawd")
    const ana = body.memory_density.find((d: { agent: string }) => d.agent === "ana")

    expect(clawd.avg_chars).toBe(15) // (10 + 20) / 2
    expect(clawd.count).toBe(2)
    expect(ana.avg_chars).toBe(6) // 6 / 1
    expect(ana.count).toBe(1)
  })

  // --- Batch Size ---

  it("calculates avg_facts_per_batch correctly", async () => {
    // 4 memories with 2 unique timestamp-seconds
    const points = [
      makePoint("1", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00.100Z",
        data: "memory 1",
        hash: "h1",
      }),
      makePoint("2", {
        userId: "clawd",
        createdAt: "2026-02-22T10:00:00.200Z", // Same second as above
        data: "memory 2",
        hash: "h2",
      }),
      makePoint("3", {
        userId: "ana",
        createdAt: "2026-02-22T10:00:01.000Z", // Different second
        data: "memory 3",
        hash: "h3",
      }),
      makePoint("4", {
        userId: "ana",
        createdAt: "2026-02-22T10:00:01.500Z", // Same second as above
        data: "memory 4",
        hash: "h4",
      }),
    ]

    setupMocks({ collectionPointsCount: 4, points })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    // 4 stored / 2 unique seconds = 2
    expect(body.batch_size.avg_facts_per_batch).toBe(2)
  })

  // --- Error handling ---

  it("returns 500 on error", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"))
    mockGetCollection.mockRejectedValue(new Error("connection refused"))
    mockScroll.mockRejectedValue(new Error("connection refused"))

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  // --- Empty collection ---

  it("handles empty collection with zero points", async () => {
    setupMocks({
      telemetryPutCount: 0,
      collectionPointsCount: 0,
      points: [],
    })

    const { GET } = await import("@/app/api/mem0-health/route")
    const res = await GET()
    const body = await res.json()

    expect(body.deduplication.attempted_writes).toBe(0)
    expect(body.deduplication.stored_memories).toBe(0)
    expect(body.deduplication.dedup_rate).toBe(0)
    expect(body.deduplication.saved_embeddings).toBe(0)
    expect(body.velocity.today).toBe(0)
    expect(body.velocity.yesterday).toBe(0)
    expect(body.velocity.last_7d).toBe(0)
    expect(body.velocity.trend).toBe("stable")
    expect(body.batch_size.avg_facts_per_batch).toBe(0)
    expect(body.top_sources).toEqual([])
    expect(body.memory_density).toEqual([])
  })
})
