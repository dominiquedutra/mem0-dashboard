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

const mockGetCollectionInfo = jest.fn()
const mockScroll = jest.fn()

jest.mock("@/lib/qdrant", () => ({
  getQdrantClient: jest.fn(() => ({
    getCollection: mockGetCollectionInfo,
    scroll: mockScroll,
  })),
  getCollection: jest.fn(() => "test-collection"),
}))

// ---------- tests ----------

describe("GET /api/settings", () => {
  const originalEnv = process.env
  const originalFetch = global.fetch
  const now = new Date("2026-02-22T12:00:00Z")

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    jest.useFakeTimers()
    jest.setSystemTime(now)

    process.env = {
      ...originalEnv,
      QDRANT_URL: "http://qdrant.example.com:6333",
      QDRANT_COLLECTION: "openclaw-memories",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
      AGENTS: "clawd, norma, ana",
      REFRESH_INTERVAL: "60",
      DASHBOARD_PORT: "8765",
    }

    mockGetCollectionInfo.mockResolvedValue({
      status: "green",
      points_count: 1135,
      config: {
        params: {
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        },
      },
    })

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              app: { version: "1.17.0", startup: "2026-02-21T18:12:00Z" },
            },
          }),
      } as Response),
    )
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
    process.env = originalEnv
  })

  async function loadRoute() {
    const mod = await import("@/app/api/settings/route")
    return mod
  }

  it("returns all settings with correct values from env vars", async () => {
    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)

    // mem0 section
    expect(json.mem0.embedder_model).toBe("text-embedding-3-small")
    expect(json.mem0.embedding_dimensions).toBe(1536)
    expect(json.mem0.distance_metric).toBe("Cosine")

    // qdrant section
    expect(json.qdrant.url).toBe("http://qdrant.example.com:6333")
    expect(json.qdrant.collection).toBe("test-collection")
    expect(json.qdrant.status).toBe("green")
    expect(json.qdrant.auth_enabled).toBe(false)

    // dashboard section
    expect(json.dashboard.refresh_interval_s).toBe(60)
    expect(json.dashboard.agents).toEqual(["clawd", "norma", "ana"])
    expect(json.dashboard.port).toBe(8765)
  })

  it("uses defaults when env vars are not set", async () => {
    delete process.env.QDRANT_URL
    delete process.env.QDRANT_COLLECTION
    delete process.env.OPENAI_EMBEDDING_MODEL
    delete process.env.AGENTS
    delete process.env.REFRESH_INTERVAL
    delete process.env.DASHBOARD_PORT

    // discoverAgents() auto-detects from Qdrant when AGENTS is unset
    mockScroll.mockResolvedValue({
      points: [
        { id: "1", payload: { userId: "clawd", data: "d1", hash: "h1" } },
        { id: "2", payload: { user_id: "ana", data: "d2", hash: "h2" } },
      ],
      next_page_offset: null,
    })

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.mem0.embedder_model).toBe("text-embedding-3-small")
    expect(json.qdrant.url).toBe("http://localhost:6333")
    expect(json.dashboard.refresh_interval_s).toBe(60)
    expect(json.dashboard.agents).toEqual(["ana", "clawd"])
    expect(json.dashboard.page_size).toBe(50)
    expect(json.dashboard.port).toBe(8765)
  })

  it("returns Qdrant version from telemetry", async () => {
    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.qdrant.version).toBe("1.17.0")
  })

  it("returns collection dimensions and distance from collection info", async () => {
    mockGetCollectionInfo.mockResolvedValue({
      status: "green",
      points_count: 500,
      config: {
        params: {
          vectors: {
            size: 3072,
            distance: "Euclid",
          },
        },
      },
    })

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.mem0.embedding_dimensions).toBe(3072)
    expect(json.mem0.distance_metric).toBe("Euclid")
  })

  it("parses AGENTS string correctly (trims spaces)", async () => {
    process.env.AGENTS = "  alice , bob ,  charlie  "

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(json.dashboard.agents).toEqual(["alice", "bob", "charlie"])
  })

  it("returns 500 on Qdrant error", async () => {
    mockGetCollectionInfo.mockRejectedValue(new Error("connection refused"))

    const consoleSpy = jest.spyOn(console, "error").mockImplementation()

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBeTruthy()

    consoleSpy.mockRestore()
  })
})
