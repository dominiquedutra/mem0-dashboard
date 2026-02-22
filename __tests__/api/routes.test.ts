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

class MockNextRequest {
  nextUrl: URL

  constructor(url: URL | string) {
    this.nextUrl = typeof url === "string" ? new URL(url) : url
  }
}

jest.mock("next/server", () => ({
  NextResponse: MockNextResponse,
  NextRequest: MockNextRequest,
}))

// ---------- qdrant mock ----------

const mockCount = jest.fn()
const mockScroll = jest.fn()

jest.mock("@/lib/qdrant", () => ({
  getQdrantClient: jest.fn(() => ({
    count: mockCount,
    scroll: mockScroll,
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

function makeRequest(url: string) {
  return new MockNextRequest(new URL(url, "http://localhost:3000"))
}

// ---------- fixtures ----------

const now = new Date("2026-02-22T12:00:00Z")

const payloadNew: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-22T11:00:00Z",
  runId: "agent:main:discord:channel:1234567890",
  data: "New schema memory",
  hash: "hash1",
}

const payloadOld: RawQdrantPayload = {
  user_id: "ana",
  created_at: "2026-02-21T10:00:00Z",
  data: "Old schema memory",
  hash: "hash2",
}

const payloadRecent: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-22T11:30:00Z",
  runId: "agent:main:cron:abc",
  data: "Recent memory",
  hash: "hash3",
}

const payloadStale: RawQdrantPayload = {
  userId: "norma",
  createdAt: "2026-02-15T01:00:00Z",
  data: "Week old memory",
  hash: "hash4",
}

// ---------- setup / teardown ----------

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
  jest.useFakeTimers()
  jest.setSystemTime(now)
  delete process.env.AGENTS
})

afterEach(() => {
  jest.useRealTimers()
})

// ===== GET /api/stats =====

describe("GET /api/stats", () => {
  it("returns correct counts for each agent", async () => {
    process.env.AGENTS = "clawd, ana"
    mockCount
      .mockResolvedValueOnce({ count: 42 })
      .mockResolvedValueOnce({ count: 18 })

    const { GET } = await import("@/app/api/stats/route")
    const res = await GET()
    const body = await res.json()

    expect(body.total).toBe(60)
    expect(body.agents).toEqual({ clawd: 42, ana: 18 })
    expect(body.collection).toBe("test-collection")
    expect(body.lastUpdated).toBeDefined()
  })

  it("auto-detects agents when AGENTS env is unset", async () => {
    // discoverAgents() will scroll Qdrant to find agents
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),   // clawd
        makePoint("id-2", payloadOld),   // ana
        makePoint("id-4", payloadStale), // norma
      ]),
    )

    mockCount
      .mockResolvedValueOnce({ count: 20 }) // ana (sorted first)
      .mockResolvedValueOnce({ count: 10 }) // clawd
      .mockResolvedValueOnce({ count: 30 }) // norma

    const { GET } = await import("@/app/api/stats/route")
    const res = await GET()
    const body = await res.json()

    expect(body.total).toBe(60)
    expect(body.agents).toEqual({ ana: 20, clawd: 10, norma: 30 })
  })

  it("returns 500 on Qdrant error", async () => {
    mockCount.mockRejectedValueOnce(new Error("connection refused"))

    const { GET } = await import("@/app/api/stats/route")
    const res = await GET()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

// ===== GET /api/memories =====

describe("GET /api/memories", () => {
  beforeEach(() => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-2", payloadOld),
        makePoint("id-3", payloadRecent),
        makePoint("id-4", payloadStale),
      ]),
    )
  })

  it("returns all memories sorted newest first by default", async () => {
    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories") as any)
    const body = await res.json()

    expect(body.total).toBe(4)
    expect(body.offset).toBe(0)
    expect(body.limit).toBe(50)
    expect(body.memories).toHaveLength(4)
    expect(body.memories[0].id).toBe("id-3")
    expect(body.memories[1].id).toBe("id-1")
    expect(body.memories[2].id).toBe("id-2")
    expect(body.memories[3].id).toBe("id-4")
  })

  it("sorts oldest first when sort=oldest", async () => {
    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories?sort=oldest") as any)
    const body = await res.json()

    expect(body.memories[0].id).toBe("id-4")
    expect(body.memories[3].id).toBe("id-3")
  })

  it("paginates with offset and limit", async () => {
    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories?offset=1&limit=2") as any)
    const body = await res.json()

    expect(body.total).toBe(4)
    expect(body.offset).toBe(1)
    expect(body.limit).toBe(2)
    expect(body.memories).toHaveLength(2)
    expect(body.memories[0].id).toBe("id-1")
    expect(body.memories[1].id).toBe("id-2")
  })

  it("clamps limit to 200", async () => {
    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories?limit=999") as any)
    const body = await res.json()

    expect(body.limit).toBe(200)
  })

  it("filters by agent", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-3", payloadRecent),
      ]),
    )

    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories?agent=clawd") as any)
    const body = await res.json()

    expect(mockScroll).toHaveBeenCalledWith(
      "test-collection",
      expect.objectContaining({
        filter: {
          should: [
            { key: "userId", match: { value: "clawd" } },
            { key: "user_id", match: { value: "clawd" } },
          ],
        },
      }),
    )

    expect(body.total).toBe(2)
    expect(body.memories.every((m: { agent: string }) => m.agent === "clawd")).toBe(true)
  })

  it("handles dual schema payloads correctly", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("new-schema", payloadNew),
        makePoint("old-schema", payloadOld),
      ]),
    )

    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories") as any)
    const body = await res.json()

    const newMem = body.memories.find((m: { id: string }) => m.id === "new-schema")
    const oldMem = body.memories.find((m: { id: string }) => m.id === "old-schema")

    expect(newMem.agent).toBe("clawd")
    expect(newMem.createdAt).toBe("2026-02-22T11:00:00Z")

    expect(oldMem.agent).toBe("ana")
    expect(oldMem.createdAt).toBe("2026-02-21T10:00:00Z")
  })

  it("returns 500 on error", async () => {
    mockScroll.mockRejectedValue(new Error("scroll failed"))

    const { GET } = await import("@/app/api/memories/route")
    const res = await GET(makeRequest("/api/memories") as any)

    expect(res.status).toBe(500)
  })
})

// ===== GET /api/recent =====

describe("GET /api/recent", () => {
  beforeEach(() => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-2", payloadOld),
        makePoint("id-3", payloadRecent),
        makePoint("id-4", payloadStale),
      ]),
    )
  })

  it("returns memories from the last 24 hours by default", async () => {
    const { GET } = await import("@/app/api/recent/route")
    const res = await GET(makeRequest("/api/recent") as any)
    const body = await res.json()

    expect(body.hours).toBe(24)
    expect(body.total).toBe(2)
    expect(body.memories[0].id).toBe("id-3")
    expect(body.memories[1].id).toBe("id-1")
  })

  it("respects custom hours parameter", async () => {
    const { GET } = await import("@/app/api/recent/route")
    const res = await GET(makeRequest("/api/recent?hours=1") as any)
    const body = await res.json()

    expect(body.hours).toBe(1)
    expect(body.total).toBe(1)
    expect(body.memories[0].id).toBe("id-3")
  })

  it("clamps hours to 168 max", async () => {
    const { GET } = await import("@/app/api/recent/route")
    const res = await GET(makeRequest("/api/recent?hours=999") as any)
    const body = await res.json()

    expect(body.hours).toBe(168)
  })

  it("filters by agent when specified", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-3", payloadRecent),
      ]),
    )

    const { GET } = await import("@/app/api/recent/route")
    await GET(makeRequest("/api/recent?agent=clawd") as any)

    expect(mockScroll).toHaveBeenCalledWith(
      "test-collection",
      expect.objectContaining({
        filter: {
          should: [
            { key: "userId", match: { value: "clawd" } },
            { key: "user_id", match: { value: "clawd" } },
          ],
        },
      }),
    )
  })

  it("returns 500 on error", async () => {
    mockScroll.mockRejectedValue(new Error("fail"))

    const { GET } = await import("@/app/api/recent/route")
    const res = await GET(makeRequest("/api/recent") as any)

    expect(res.status).toBe(500)
  })
})

// ===== GET /api/agents =====

describe("GET /api/agents", () => {
  it("returns agents from env var when set", async () => {
    process.env.AGENTS = "clawd, ana, norma"

    const { GET } = await import("@/app/api/agents/route")
    const res = await GET()
    const body = await res.json()

    expect(body.agents).toEqual(["clawd", "ana", "norma"])
    expect(mockScroll).not.toHaveBeenCalled()
  })

  it("auto-detects agents from collection when env is empty", async () => {
    process.env.AGENTS = ""

    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-2", payloadOld),
        makePoint("id-3", payloadRecent),
        makePoint("id-4", payloadStale),
      ]),
    )

    const { GET } = await import("@/app/api/agents/route")
    const res = await GET()
    const body = await res.json()

    expect(body.agents).toEqual(["ana", "clawd", "norma"])
    expect(mockScroll).toHaveBeenCalled()
  })

  it("auto-detects agents from collection when env is unset", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-2", payloadOld),
      ]),
    )

    const { GET } = await import("@/app/api/agents/route")
    const res = await GET()
    const body = await res.json()

    expect(body.agents).toEqual(["ana", "clawd"])
  })

  it("excludes 'unknown' agents from auto-detect", async () => {
    const unknownPayload: RawQdrantPayload = {
      data: "no user field",
      hash: "hashX",
    }

    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("id-1", payloadNew),
        makePoint("id-2", unknownPayload),
      ]),
    )

    const { GET } = await import("@/app/api/agents/route")
    const res = await GET()
    const body = await res.json()

    expect(body.agents).toEqual(["clawd"])
    expect(body.agents).not.toContain("unknown")
  })

  it("returns 500 on error", async () => {
    mockScroll.mockRejectedValue(new Error("fail"))

    const { GET } = await import("@/app/api/agents/route")
    const res = await GET()

    expect(res.status).toBe(500)
  })
})
