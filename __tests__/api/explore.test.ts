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
  private _body: unknown

  constructor(_url: string, opts?: { body?: string }) {
    this._body = opts?.body ? JSON.parse(opts.body) : {}
  }

  async json() {
    return this._body
  }
}

jest.mock("next/server", () => ({
  NextResponse: MockNextResponse,
  NextRequest: MockNextRequest,
}))

// ---------- lib mocks ----------

jest.mock("@/lib/openai", () => ({
  embedQuery: jest.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
}))

jest.mock("@/lib/qdrant", () => ({
  getQdrantClient: jest.fn(),
  getCollection: jest.fn(() => "test-collection"),
}))

import { POST } from "@/app/api/explore/route"
import { embedQuery } from "@/lib/openai"
import { getQdrantClient } from "@/lib/qdrant"

function makeRequest(body: object) {
  return new MockNextRequest("http://localhost:3000/api/explore", {
    body: JSON.stringify(body),
  }) as any
}

function makeQdrantResult(overrides: Partial<{
  id: string
  score: number
  userId: string | null
  user_id: string
  data: string
  hash: string
  createdAt: string | null
  created_at: string
  runId: string
}> = {}) {
  return {
    id: overrides.id ?? "abc-123",
    score: overrides.score ?? 0.95,
    payload: {
      ...("userId" in overrides ? (overrides.userId != null ? { userId: overrides.userId } : {}) : { userId: "clawd" }),
      ...(overrides.user_id !== undefined ? { user_id: overrides.user_id } : {}),
      data: overrides.data ?? "Some memory data",
      hash: overrides.hash ?? "deadbeef",
      ...("createdAt" in overrides ? (overrides.createdAt != null ? { createdAt: overrides.createdAt } : {}) : { createdAt: "2026-02-22T10:00:00Z" }),
      ...(overrides.created_at !== undefined ? { created_at: overrides.created_at } : {}),
      ...(overrides.runId !== undefined ? { runId: overrides.runId } : {}),
    },
  }
}

describe("POST /api/explore", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns error when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY

    const res = await POST(makeRequest({ query: "test" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/OPENAI_API_KEY/)
  })

  it("returns error for empty query", async () => {
    const res = await POST(makeRequest({ query: "" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/required/i)
  })

  it("returns error for missing query", async () => {
    const res = await POST(makeRequest({}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/required/i)
  })

  it("returns error for whitespace-only query", async () => {
    const res = await POST(makeRequest({ query: "   " }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/required/i)
  })

  it("returns ranked results with scores", async () => {
    const mockSearch = jest.fn().mockResolvedValue([
      makeQdrantResult({ id: "id-1", score: 0.95, data: "First memory" }),
      makeQdrantResult({ id: "id-2", score: 0.80, data: "Second memory" }),
    ])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    const res = await POST(makeRequest({ query: "test query" }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.query).toBe("test query")
    expect(json.agent).toBeNull()
    expect(json.results).toHaveLength(2)
    expect(json.results[0].id).toBe("id-1")
    expect(json.results[0].score).toBe(0.95)
    expect(json.results[0].data).toBe("First memory")
    expect(json.results[0].agent).toBe("clawd")
    expect(json.results[1].score).toBe(0.80)

    expect(embedQuery).toHaveBeenCalledWith("test query")
    expect(mockSearch).toHaveBeenCalledWith("test-collection", expect.objectContaining({
      vector: expect.any(Array),
      limit: 10,
      with_payload: true,
    }))
  })

  it("filters by agent when specified", async () => {
    const mockSearch = jest.fn().mockResolvedValue([])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    const res = await POST(makeRequest({ query: "test", agent: "clawd" }))

    expect(res.status).toBe(200)
    expect(mockSearch).toHaveBeenCalledWith("test-collection", expect.objectContaining({
      filter: {
        should: [
          { key: "userId", match: { value: "clawd" } },
          { key: "user_id", match: { value: "clawd" } },
        ],
      },
    }))

    const json = await res.json()
    expect(json.agent).toBe("clawd")
  })

  it("does not filter when agent is 'all'", async () => {
    const mockSearch = jest.fn().mockResolvedValue([])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    await POST(makeRequest({ query: "test", agent: "all" }))

    expect(mockSearch).toHaveBeenCalledWith("test-collection", expect.not.objectContaining({
      filter: expect.anything(),
    }))
  })

  it("handles dual schema payloads (old user_id / created_at)", async () => {
    const mockSearch = jest.fn().mockResolvedValue([
      makeQdrantResult({
        id: "old-id",
        score: 0.88,
        user_id: "ana",
        userId: null,
        created_at: "2026-02-21T17:18:25.835258-08:00",
        createdAt: null,
        data: "Old schema data",
      }),
    ])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    const res = await POST(makeRequest({ query: "old data" }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.results).toHaveLength(1)
    expect(json.results[0].agent).toBe("ana")
    expect(json.results[0].createdAt).toBe("2026-02-21T17:18:25.835258-08:00")
    expect(json.results[0].score).toBe(0.88)
  })

  it("respects custom topK up to 50", async () => {
    const mockSearch = jest.fn().mockResolvedValue([])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    await POST(makeRequest({ query: "test", topK: 25 }))

    expect(mockSearch).toHaveBeenCalledWith("test-collection", expect.objectContaining({
      limit: 25,
    }))
  })

  it("caps topK at 50", async () => {
    const mockSearch = jest.fn().mockResolvedValue([])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    await POST(makeRequest({ query: "test", topK: 100 }))

    expect(mockSearch).toHaveBeenCalledWith("test-collection", expect.objectContaining({
      limit: 50,
    }))
  })

  it("trims query whitespace", async () => {
    const mockSearch = jest.fn().mockResolvedValue([])

    ;(getQdrantClient as jest.Mock).mockReturnValue({ search: mockSearch })

    const res = await POST(makeRequest({ query: "  hello world  " }))
    const json = await res.json()

    expect(embedQuery).toHaveBeenCalledWith("hello world")
    expect(json.query).toBe("hello world")
  })

  it("returns 500 on unexpected error", async () => {
    ;(getQdrantClient as jest.Mock).mockReturnValue({
      search: jest.fn().mockRejectedValue(new Error("connection refused")),
    })

    const consoleSpy = jest.spyOn(console, "error").mockImplementation()

    const res = await POST(makeRequest({ query: "test" }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toMatch(/failed/i)

    consoleSpy.mockRestore()
  })
})
