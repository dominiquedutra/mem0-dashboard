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

describe("GET /api/performance", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      QDRANT_URL: "http://localhost:6333",
      QDRANT_COLLECTION: "test-collection",
    }
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = originalEnv
  })

  function makeTelemetry(overrides: Record<string, unknown> = {}) {
    return {
      result: {
        app: {
          name: "qdrant",
          version: overrides.version ?? "1.13.2",
          startup: overrides.startup ?? "2026-02-19T10:00:00Z",
        },
        requests: {
          rest: {
            responses: {
              "POST /collections/{name}/points/search": {
                "200": {
                  count: overrides.searchCount ?? 150,
                  avg_duration_micros: overrides.searchAvgMicros ?? 12500,
                },
                ...(overrides.searchErrors ? {
                  "500": { count: overrides.searchErrors, avg_duration_micros: 5000 },
                } : {}),
              },
              "POST /collections/{name}/points/query": {
                "200": {
                  count: overrides.queryCount ?? 50,
                  avg_duration_micros: overrides.queryAvgMicros ?? 8000,
                },
              },
              "PUT /collections/{name}/points": {
                "200": {
                  count: overrides.writeCount ?? 300,
                  avg_duration_micros: overrides.writeAvgMicros ?? 25000,
                },
              },
              "POST /collections/{name}/points/delete": {
                "200": {
                  count: overrides.deleteCount ?? 10,
                  avg_duration_micros: 5000,
                },
              },
              "POST /collections/{name}/points/payload": {
                "200": {
                  count: overrides.payloadCount ?? 5,
                  avg_duration_micros: 3000,
                },
              },
            },
          },
        },
      },
    }
  }

  function makePrometheusMetrics(overrides: Record<string, unknown> = {}) {
    const total = overrides.vectorTotal ?? 1234
    const perCollection = overrides.perCollection ?? 1100
    const collectionName = overrides.collectionName ?? "test-collection"
    return [
      `# HELP collections_vector_total total number of vectors`,
      `# TYPE collections_vector_total gauge`,
      `collections_vector_total ${total}`,
      `# HELP collection_vectors number of vectors per collection`,
      `# TYPE collection_vectors gauge`,
      `collection_vectors{collection="${collectionName}"} ${perCollection}`,
    ].join("\n")
  }

  function mockFetch(telemetry: object, prometheus: string) {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url
      if (urlStr.includes("/telemetry")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(telemetry),
        } as Response)
      }
      if (urlStr.includes("/metrics")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(prometheus),
        } as Response)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`))
    }) as jest.Mock
  }

  async function loadRoute() {
    const mod = await import("@/app/api/performance/route")
    return mod
  }

  it("returns performance stats from telemetry and metrics", async () => {
    mockFetch(makeTelemetry(), makePrometheusMetrics())

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.qdrant.version).toBe("1.13.2")
    expect(json.qdrant.uptime_since).toBe("2026-02-19T10:00:00Z")
    expect(json.qdrant.uptime_human).toBeTruthy()
    // search total = search 200 count + query 200 count
    expect(json.search.total_calls).toBe(200) // 150 + 50
    expect(json.search.avg_latency_ms).toBeGreaterThan(0)
    expect(json.search.success_rate).toBe(100)
    expect(json.search.errors).toBe(0)
    expect(json.writes.total_calls).toBe(300)
    expect(json.writes.avg_latency_ms).toBeGreaterThan(0)
    expect(json.writes.deletes).toBe(10)
    expect(json.writes.payload_updates).toBe(5)
    expect(json.vectors.total).toBe(1234)
    expect(json.vectors.per_collection).toEqual({ "test-collection": 1100 })
  })

  it("calculates success rate with errors", async () => {
    mockFetch(
      makeTelemetry({ searchCount: 90, searchErrors: 10 }),
      makePrometheusMetrics(),
    )

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    // search 200 = 90, query 200 = 50, total success = 140, errors = 10, total = 150
    // success_rate = 140/150 * 100 = 93.33
    expect(json.search.success_rate).toBeLessThan(100)
    expect(json.search.errors).toBe(10)
  })

  it("calculates weighted average latency for search + query", async () => {
    mockFetch(
      makeTelemetry({
        searchCount: 100,
        searchAvgMicros: 10000, // 10ms
        queryCount: 100,
        queryAvgMicros: 20000, // 20ms
      }),
      makePrometheusMetrics(),
    )

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    // weighted avg: (100*10000 + 100*20000) / (100+100) / 1000 = 15ms
    expect(json.search.avg_latency_ms).toBe(15)
  })

  it("parses multiple collections from Prometheus metrics", async () => {
    const metrics = [
      "collections_vector_total 2000",
      `collection_vectors{collection="col-a"} 1200`,
      `collection_vectors{collection="col-b"} 800`,
    ].join("\n")

    mockFetch(makeTelemetry(), metrics)

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.vectors.total).toBe(2000)
    expect(json.vectors.per_collection).toEqual({
      "col-a": 1200,
      "col-b": 800,
    })
  })

  it("handles telemetry fetch failure gracefully", async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url
      if (urlStr.includes("/telemetry")) {
        return Promise.reject(new Error("connection refused"))
      }
      if (urlStr.includes("/metrics")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(makePrometheusMetrics()),
        } as Response)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`))
    }) as jest.Mock

    const consoleSpy = jest.spyOn(console, "error").mockImplementation()

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeTruthy()

    consoleSpy.mockRestore()
  })

  it("handles metrics fetch failure gracefully with partial data", async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url
      if (urlStr.includes("/telemetry")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeTelemetry()),
        } as Response)
      }
      if (urlStr.includes("/metrics")) {
        return Promise.reject(new Error("metrics down"))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`))
    }) as jest.Mock

    const consoleSpy = jest.spyOn(console, "error").mockImplementation()

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    // Should still return 200 with partial data (telemetry ok, metrics failed)
    expect(res.status).toBe(200)
    expect(json.qdrant.version).toBe("1.13.2")
    expect(json.vectors.total).toBe(0)
    expect(json.vectors.per_collection).toEqual({})

    consoleSpy.mockRestore()
  })

  it("handles missing response entries gracefully", async () => {
    const telemetry = {
      result: {
        app: {
          name: "qdrant",
          version: "1.13.2",
          startup: "2026-02-19T10:00:00Z",
        },
        requests: {
          rest: {
            responses: {},
          },
        },
      },
    }

    mockFetch(telemetry, makePrometheusMetrics())

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.search.total_calls).toBe(0)
    expect(json.search.avg_latency_ms).toBe(0)
    expect(json.writes.total_calls).toBe(0)
    expect(json.writes.deletes).toBe(0)
    expect(json.writes.payload_updates).toBe(0)
  })

  it("generates human-readable uptime string", async () => {
    // Set startup to ~2 days, 3 hours ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000).toISOString()
    mockFetch(
      makeTelemetry({ startup: twoDaysAgo }),
      makePrometheusMetrics(),
    )

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.qdrant.uptime_human).toMatch(/2 days/)
    expect(json.qdrant.uptime_human).toMatch(/3 hours/)
  })
})
