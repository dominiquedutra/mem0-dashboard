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

const mockScroll = jest.fn()

jest.mock("@/lib/qdrant", () => ({
  getQdrantClient: jest.fn(() => ({
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

// System time: Feb 22, 2026 12:00 UTC
const now = new Date("2026-02-22T12:00:00Z")

const memToday: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-22T10:00:00Z",
  data: "Today memory",
  hash: "h1",
}

const memYesterday: RawQdrantPayload = {
  userId: "ana",
  createdAt: "2026-02-21T15:00:00Z",
  data: "Yesterday memory",
  hash: "h2",
}

const memFeb20: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-20T08:00:00Z",
  data: "Feb 20 memory",
  hash: "h3",
}

const memOldSchema: RawQdrantPayload = {
  user_id: "norma",
  created_at: "2026-02-19T12:00:00Z",
  data: "Old schema",
  hash: "h4",
}

const memOld: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-01-15T12:00:00Z",
  data: "Old memory",
  hash: "h5",
}

// ---------- setup / teardown ----------

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
  jest.useFakeTimers()
  jest.setSystemTime(now)
})

afterEach(() => {
  jest.useRealTimers()
})

// ===== GET /api/growth =====

describe("GET /api/growth", () => {
  it("returns daily growth points for default 30 days", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memToday),
        makePoint("2", memYesterday),
        makePoint("3", memFeb20),
      ]),
    )

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth") as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.points).toBeInstanceOf(Array)
    // Default 30 days: from Jan 23 to Feb 22 = 31 entries (inclusive)
    expect(body.points.length).toBe(31)

    // Each point has date, added, cumulative
    for (const point of body.points) {
      expect(point).toHaveProperty("date")
      expect(point).toHaveProperty("added")
      expect(point).toHaveProperty("cumulative")
    }
  })

  it("cumulative count increases correctly including pre-window memories", async () => {
    // memOld is from Jan 15, outside a 7-day window but should count toward initial cumulative
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memToday),
        makePoint("2", memYesterday),
        makePoint("3", memFeb20),
        makePoint("4", memOldSchema),
        makePoint("5", memOld),
      ]),
    )

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth?days=7") as any)
    const body = await res.json()

    // 7 days: Feb 15 to Feb 22 = 8 entries
    expect(body.points.length).toBe(8)

    // memOld (Jan 15) is before the window -> initial cumulative = 1
    // Feb 19: memOldSchema (+1) -> cumulative = 2
    // Feb 20: memFeb20 (+1) -> cumulative = 3
    // Feb 21: memYesterday (+1) -> cumulative = 4
    // Feb 22: memToday (+1) -> cumulative = 5
    const lastPoint = body.points[body.points.length - 1]
    expect(lastPoint.cumulative).toBe(5)
    expect(lastPoint.date).toBe("2026-02-22")
    expect(lastPoint.added).toBe(1)

    // First point (Feb 15) should have cumulative = 1 (just the pre-window memory)
    const firstPoint = body.points[0]
    expect(firstPoint.date).toBe("2026-02-15")
    expect(firstPoint.added).toBe(0)
    expect(firstPoint.cumulative).toBe(1)
  })

  it("per-agent breakdown is correct", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memToday),
        makePoint("2", memYesterday),
        makePoint("3", memFeb20),
        makePoint("4", memOldSchema),
      ]),
    )

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth?days=7") as any)
    const body = await res.json()

    expect(body.agents).toBeDefined()

    // clawd has memToday (Feb 22) and memFeb20 (Feb 20)
    expect(body.agents.clawd).toBeDefined()
    const clawdFeb22 = body.agents.clawd.find(
      (d: any) => d.date === "2026-02-22",
    )
    expect(clawdFeb22).toBeDefined()
    expect(clawdFeb22.added).toBe(1)

    const clawdFeb20 = body.agents.clawd.find(
      (d: any) => d.date === "2026-02-20",
    )
    expect(clawdFeb20).toBeDefined()
    expect(clawdFeb20.added).toBe(1)

    // ana has memYesterday (Feb 21)
    expect(body.agents.ana).toBeDefined()
    const anaFeb21 = body.agents.ana.find(
      (d: any) => d.date === "2026-02-21",
    )
    expect(anaFeb21).toBeDefined()
    expect(anaFeb21.added).toBe(1)

    // norma has memOldSchema (Feb 19)
    expect(body.agents.norma).toBeDefined()
    const normaFeb19 = body.agents.norma.find(
      (d: any) => d.date === "2026-02-19",
    )
    expect(normaFeb19).toBeDefined()
    expect(normaFeb19.added).toBe(1)
  })

  it("days param is respected", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memToday),
        makePoint("2", memYesterday),
      ]),
    )

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth?days=3") as any)
    const body = await res.json()

    // 3 days: Feb 19 to Feb 22 = 4 entries
    expect(body.points.length).toBe(4)
    expect(body.points[0].date).toBe("2026-02-19")
    expect(body.points[3].date).toBe("2026-02-22")
  })

  it("days clamped to max 365", async () => {
    mockScroll.mockResolvedValue(scrollResponse([]))

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth?days=999") as any)
    const body = await res.json()

    // Should be clamped to 365 days: 366 entries
    expect(body.points.length).toBe(366)
  })

  it("handles dual schema (old user_id/created_at)", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memOldSchema), // uses user_id and created_at
      ]),
    )

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth?days=7") as any)
    const body = await res.json()

    // norma should appear in agents (resolved from user_id)
    expect(body.agents.norma).toBeDefined()
    const normaFeb19 = body.agents.norma.find(
      (d: any) => d.date === "2026-02-19",
    )
    expect(normaFeb19).toBeDefined()
    expect(normaFeb19.added).toBe(1)

    // Feb 19 point should have added=1
    const feb19 = body.points.find((p: any) => p.date === "2026-02-19")
    expect(feb19).toBeDefined()
    expect(feb19.added).toBe(1)
  })

  it("empty collection returns empty points array with zero cumulative", async () => {
    mockScroll.mockResolvedValue(scrollResponse([]))

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth") as any)
    const body = await res.json()

    expect(body.points).toBeInstanceOf(Array)
    expect(body.points.length).toBe(31) // still has day entries
    for (const point of body.points) {
      expect(point.added).toBe(0)
      expect(point.cumulative).toBe(0)
    }
    expect(body.agents).toEqual({})
  })

  it("returns 500 on error", async () => {
    mockScroll.mockRejectedValue(new Error("connection refused"))

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth") as any)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("points sorted chronologically", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memToday),
        makePoint("2", memYesterday),
        makePoint("3", memFeb20),
      ]),
    )

    const { GET } = await import("@/app/api/growth/route")
    const res = await GET(makeRequest("/api/growth?days=7") as any)
    const body = await res.json()

    const dates = body.points.map((p: any) => p.date)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })
})
