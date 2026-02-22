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

// Memories spread across multiple hours on the same day
const memClawd11am: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-22T11:00:00Z",
  data: "clawd memory at 11am",
  hash: "h1",
}

const memClawd11am2: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-22T11:30:00Z",
  data: "clawd second memory at 11am",
  hash: "h2",
}

const memAna10am: RawQdrantPayload = {
  userId: "ana",
  createdAt: "2026-02-22T10:00:00Z",
  data: "ana memory at 10am",
  hash: "h3",
}

const memNorma11am: RawQdrantPayload = {
  userId: "norma",
  createdAt: "2026-02-22T11:45:00Z",
  data: "norma memory at 11am",
  hash: "h4",
}

// Old schema memory
const memOldSchema: RawQdrantPayload = {
  user_id: "ana",
  created_at: "2026-02-21T09:00:00Z",
  data: "old schema memory",
  hash: "h5",
}

// Memories on different days (for daily grouping)
const memFeb20: RawQdrantPayload = {
  userId: "clawd",
  createdAt: "2026-02-20T14:00:00Z",
  data: "feb 20 memory",
  hash: "h6",
}

const memFeb19: RawQdrantPayload = {
  userId: "ana",
  createdAt: "2026-02-19T08:00:00Z",
  data: "feb 19 memory",
  hash: "h7",
}

// Stale memory (older than 7 days)
const memStale: RawQdrantPayload = {
  userId: "norma",
  createdAt: "2026-02-10T01:00:00Z",
  data: "stale memory",
  hash: "h8",
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

// ===== GET /api/timeline =====

describe("GET /api/timeline", () => {
  it("groups memories by hour within a 24h window", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memClawd11am),
        makePoint("2", memClawd11am2),
        makePoint("3", memAna10am),
        makePoint("4", memNorma11am),
      ]),
    )

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline?hours=24") as any)
    const body = await res.json()

    expect(body.granularity).toBe("hour")
    expect(body.buckets).toBeInstanceOf(Array)

    // Find the 11:00 bucket (should have clawd=2, norma=1, total=3)
    const hour11 = body.buckets.find((b: any) => b.time.includes("11:00"))
    expect(hour11).toBeDefined()
    expect(hour11.total).toBe(3)
    expect(hour11.clawd).toBe(2)
    expect(hour11.norma).toBe(1)

    // Find the 10:00 bucket (should have ana=1, total=1)
    const hour10 = body.buckets.find((b: any) => b.time.includes("10:00"))
    expect(hour10).toBeDefined()
    expect(hour10.total).toBe(1)
    expect(hour10.ana).toBe(1)
  })

  it("groups memories by day for >48h window", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memClawd11am),
        makePoint("2", memAna10am),
        makePoint("3", memFeb20),
        makePoint("4", memFeb19),
        makePoint("5", memOldSchema),
      ]),
    )

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline?hours=168") as any)
    const body = await res.json()

    expect(body.granularity).toBe("day")
    expect(body.buckets).toBeInstanceOf(Array)

    // Feb 22 should have clawd=1, ana=1 (both 11am and 10am memories)
    const feb22 = body.buckets.find((b: any) => b.time === "2026-02-22")
    expect(feb22).toBeDefined()
    expect(feb22.total).toBe(2)
    expect(feb22.clawd).toBe(1)
    expect(feb22.ana).toBe(1)

    // Feb 21 should have ana=1 (old schema)
    const feb21 = body.buckets.find((b: any) => b.time === "2026-02-21")
    expect(feb21).toBeDefined()
    expect(feb21.total).toBe(1)
    expect(feb21.ana).toBe(1)

    // Feb 20 should have clawd=1
    const feb20 = body.buckets.find((b: any) => b.time === "2026-02-20")
    expect(feb20).toBeDefined()
    expect(feb20.total).toBe(1)
    expect(feb20.clawd).toBe(1)
  })

  it("handles dual schema payloads correctly", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memClawd11am),
        makePoint("2", memOldSchema),
      ]),
    )

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline?hours=48") as any)
    const body = await res.json()

    // Both should be counted — old schema uses user_id/created_at
    expect(body.buckets.length).toBeGreaterThanOrEqual(2)

    const totalMemories = body.buckets.reduce(
      (sum: number, b: any) => sum + b.total,
      0,
    )
    expect(totalMemories).toBe(2)
  })

  it("respects explicit granularity parameter", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([makePoint("1", memClawd11am)]),
    )

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(
      makeRequest("/api/timeline?hours=24&granularity=day") as any,
    )
    const body = await res.json()

    expect(body.granularity).toBe("day")
  })

  it("returns empty buckets array when no data", async () => {
    mockScroll.mockResolvedValue(scrollResponse([]))

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline") as any)
    const body = await res.json()

    expect(body.buckets).toEqual([])
    expect(body.hours).toBeDefined()
    expect(body.granularity).toBeDefined()
  })

  it("clamps hours to 168 max", async () => {
    mockScroll.mockResolvedValue(scrollResponse([]))

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline?hours=999") as any)
    const body = await res.json()

    expect(body.hours).toBe(168)
  })

  it("defaults to 168 hours when no hours param", async () => {
    mockScroll.mockResolvedValue(scrollResponse([]))

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline") as any)
    const body = await res.json()

    expect(body.hours).toBe(168)
  })

  it("excludes memories outside the time window", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memClawd11am),
        makePoint("2", memStale), // older than 7 days
      ]),
    )

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline?hours=24") as any)
    const body = await res.json()

    const totalMemories = body.buckets.reduce(
      (sum: number, b: any) => sum + b.total,
      0,
    )
    expect(totalMemories).toBe(1) // only the recent one
  })

  it("sorts buckets chronologically (oldest first)", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", memClawd11am),
        makePoint("2", memAna10am),
      ]),
    )

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline?hours=24") as any)
    const body = await res.json()

    const times = body.buckets.map((b: any) => b.time)
    const sorted = [...times].sort()
    expect(times).toEqual(sorted)
  })

  it("returns 500 on Qdrant error", async () => {
    mockScroll.mockRejectedValue(new Error("connection refused"))

    const { GET } = await import("@/app/api/timeline/route")
    const res = await GET(makeRequest("/api/timeline") as any)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
