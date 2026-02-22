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

// ---------- Qdrant client mock ----------

const mockScroll = jest.fn()
const mockGetCollectionInfo = jest.fn()

jest.mock("@/lib/qdrant", () => ({
  getQdrantClient: jest.fn(() => ({
    scroll: mockScroll,
    getCollection: mockGetCollectionInfo,
  })),
  getCollection: jest.fn(() => "test-collection"),
}))

// ---------- Helpers ----------

import type { RawQdrantPayload } from "@/types/memory"

const now = new Date("2026-02-22T12:00:00Z")

function makePoint(id: string, daysAgo: number): { id: string; payload: RawQdrantPayload } {
  const ts = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  return {
    id,
    payload: {
      userId: "clawd",
      createdAt: ts.toISOString(),
      data: "test memory",
      hash: "abc123",
    },
  }
}

function setupCollectionInfo(overrides: Record<string, unknown> = {}) {
  mockGetCollectionInfo.mockResolvedValue({
    status: overrides.status ?? "green",
    points_count: overrides.points_count ?? 1135,
    config: {
      params: {
        vectors: {
          size: overrides.size ?? 1536,
          distance: overrides.distance ?? "Cosine",
        },
      },
    },
  })
}

function setupMetricsFetch(metricsText?: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      metricsText ??
      `# HELP process_resident_memory_bytes
process_resident_memory_bytes 58458112
# HELP collections_vector_total
collections_vector_total 1135
`,
  } as Response)
}

function setupScrollPoints(points: { id: string; payload: RawQdrantPayload }[]) {
  // Return all points in one batch (next_page_offset = null)
  mockScroll.mockResolvedValue({
    points,
    next_page_offset: null,
  })
}

async function loadRoute() {
  const mod = await import("@/app/api/storage/route")
  return mod
}

// ---------- Tests ----------

describe("GET /api/storage", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    jest.useFakeTimers()
    jest.setSystemTime(now)
    process.env = {
      ...originalEnv,
      QDRANT_URL: "http://localhost:6333",
      QDRANT_COLLECTION: "test-collection",
    }
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
    process.env = originalEnv
  })

  it("calculates disk estimation correctly", async () => {
    setupCollectionInfo({ points_count: 1135 })
    setupMetricsFetch()
    // 3 points in last 7 days, 2 older
    setupScrollPoints([
      makePoint("1", 1),
      makePoint("2", 3),
      makePoint("3", 6),
      makePoint("4", 10),
      makePoint("5", 20),
    ])

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.disk.points_count).toBe(1135)
    expect(json.disk.bytes_per_point_avg).toBe(18500)
    // 1135 * 18500 / (1024 * 1024) ≈ 20.02
    const expectedMb = (1135 * 18500) / (1024 * 1024)
    expect(json.disk.estimated_mb).toBeCloseTo(expectedMb, 2)
  })

  it("parses RAM from Prometheus metrics", async () => {
    setupCollectionInfo()
    setupMetricsFetch(
      `# HELP process_resident_memory_bytes
process_resident_memory_bytes 58458112
`
    )
    setupScrollPoints([])

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    // 58458112 / (1024 * 1024) ≈ 55.74
    const expectedRss = 58458112 / (1024 * 1024)
    expect(json.ram.qdrant_rss_mb).toBeCloseTo(expectedRss, 2)
  })

  it("calculates growth projections correctly", async () => {
    setupCollectionInfo({ points_count: 1135 })
    setupMetricsFetch()
    // 3 points in last 7 days (days ago: 1, 3, 6), 2 older (10, 20)
    setupScrollPoints([
      makePoint("1", 1),
      makePoint("2", 3),
      makePoint("3", 6),
      makePoint("4", 10),
      makePoint("5", 20),
    ])

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.growth.last_7d_memories).toBe(3)
    expect(json.growth.avg_per_day).toBeCloseTo(3 / 7, 4)

    const avgPerDay = 3 / 7
    const mbPerDay = (avgPerDay * 18500) / (1024 * 1024)
    expect(json.growth.estimated_mb_per_day).toBeCloseTo(mbPerDay, 4)

    const estimatedMb = (1135 * 18500) / (1024 * 1024)
    expect(json.growth.projected_mb_30d).toBeCloseTo(estimatedMb + mbPerDay * 30, 2)
    expect(json.growth.projected_mb_365d).toBeCloseTo(estimatedMb + mbPerDay * 365, 2)
  })

  it("returns collection info", async () => {
    setupCollectionInfo({
      status: "green",
      size: 1536,
      distance: "Cosine",
    })
    setupMetricsFetch()
    setupScrollPoints([])

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.collection.name).toBe("test-collection")
    expect(json.collection.vector_dimensions).toBe(1536)
    expect(json.collection.distance_metric).toBe("Cosine")
    expect(json.collection.status).toBe("green")
  })

  it("handles missing /metrics gracefully with RAM = 0", async () => {
    setupCollectionInfo()
    global.fetch = jest.fn().mockRejectedValue(new Error("connection refused"))
    setupScrollPoints([])

    const consoleSpy = jest.spyOn(console, "error").mockImplementation()

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ram.qdrant_rss_mb).toBe(0)

    consoleSpy.mockRestore()
  })

  it("returns 500 on Qdrant error", async () => {
    mockGetCollectionInfo.mockRejectedValue(new Error("Qdrant unreachable"))
    setupMetricsFetch()
    setupScrollPoints([])

    const consoleSpy = jest.spyOn(console, "error").mockImplementation()

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeTruthy()

    consoleSpy.mockRestore()
  })

  it("handles empty collection with 0 points", async () => {
    setupCollectionInfo({ points_count: 0 })
    setupMetricsFetch()
    setupScrollPoints([])

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.disk.points_count).toBe(0)
    expect(json.disk.estimated_mb).toBe(0)
    expect(json.growth.last_7d_memories).toBe(0)
    expect(json.growth.avg_per_day).toBe(0)
    expect(json.growth.estimated_mb_per_day).toBe(0)
    expect(json.growth.projected_mb_30d).toBe(0)
    expect(json.growth.projected_mb_365d).toBe(0)
  })
})
