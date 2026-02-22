import type { RawQdrantPayload } from "@/types/memory"

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

function scrollResponse(
  points: ReturnType<typeof makePoint>[],
  nextOffset?: string | number | null,
) {
  return { points, next_page_offset: nextOffset ?? null }
}

// ---------- tests ----------

describe("discoverAgents", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    delete process.env.AGENTS
  })

  it("returns agents from AGENTS env var when set", async () => {
    process.env.AGENTS = "clawd, ana, norma"

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["clawd", "ana", "norma"])
    expect(mockScroll).not.toHaveBeenCalled()
  })

  it("trims and filters empty entries from AGENTS env", async () => {
    process.env.AGENTS = "  alice , , bob ,  "

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["alice", "bob"])
  })

  it("auto-detects agents from Qdrant when AGENTS is not set", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", { userId: "clawd", data: "d1", hash: "h1" } as RawQdrantPayload),
        makePoint("2", { user_id: "ana", data: "d2", hash: "h2" } as RawQdrantPayload),
        makePoint("3", { userId: "flux", data: "d3", hash: "h3" } as RawQdrantPayload),
      ]),
    )

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["ana", "clawd", "flux"])
    expect(mockScroll).toHaveBeenCalled()
  })

  it("auto-detects agents from Qdrant when AGENTS is empty string", async () => {
    process.env.AGENTS = ""

    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", { userId: "clawd", data: "d1", hash: "h1" } as RawQdrantPayload),
      ]),
    )

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["clawd"])
  })

  it("excludes 'unknown' from auto-detected agents", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", { userId: "clawd", data: "d1", hash: "h1" } as RawQdrantPayload),
        makePoint("2", { data: "d2", hash: "h2" } as RawQdrantPayload), // resolves to "unknown"
      ]),
    )

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["clawd"])
    expect(agents).not.toContain("unknown")
  })

  it("returns sorted agents from auto-detection", async () => {
    mockScroll.mockResolvedValue(
      scrollResponse([
        makePoint("1", { userId: "zeta", data: "d1", hash: "h1" } as RawQdrantPayload),
        makePoint("2", { userId: "alpha", data: "d2", hash: "h2" } as RawQdrantPayload),
        makePoint("3", { userId: "mid", data: "d3", hash: "h3" } as RawQdrantPayload),
      ]),
    )

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["alpha", "mid", "zeta"])
  })

  it("paginates through Qdrant up to maxFetch", async () => {
    // First batch returns 100 points, with a next_page_offset
    const batch1Points = Array.from({ length: 100 }, (_, i) =>
      makePoint(`id-${i}`, { userId: "agent1", data: `d${i}`, hash: `h${i}` } as RawQdrantPayload),
    )
    // Second batch returns remaining points
    const batch2Points = Array.from({ length: 50 }, (_, i) =>
      makePoint(`id-${100 + i}`, { userId: "agent2", data: `d${100 + i}`, hash: `h${100 + i}` } as RawQdrantPayload),
    )

    mockScroll
      .mockResolvedValueOnce(scrollResponse(batch1Points, "next-offset"))
      .mockResolvedValueOnce(scrollResponse(batch2Points))

    const { discoverAgents } = await import("@/lib/memory")
    const agents = await discoverAgents()

    expect(agents).toEqual(["agent1", "agent2"])
    expect(mockScroll).toHaveBeenCalledTimes(2)
  })
})
