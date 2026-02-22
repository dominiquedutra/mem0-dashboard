import {
  resolveAgent,
  resolveTimestamp,
  resolveRunId,
  formatRunLabel,
  toMemory,
  agentFilter,
} from "@/lib/memory"
import type { RawQdrantPayload } from "@/types/memory"

describe("resolveAgent", () => {
  it("returns userId when present", () => {
    const payload = { userId: "clawd", data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveAgent(payload)).toBe("clawd")
  })

  it("falls back to user_id when userId is absent", () => {
    const payload = { user_id: "ana", data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveAgent(payload)).toBe("ana")
  })

  it("prefers userId over user_id when both present", () => {
    const payload = { userId: "clawd", user_id: "clawd", data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveAgent(payload)).toBe("clawd")
  })

  it("returns 'unknown' when neither field exists", () => {
    const payload = { data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveAgent(payload)).toBe("unknown")
  })
})

describe("resolveTimestamp", () => {
  it("returns createdAt when present", () => {
    const payload = { createdAt: "2026-02-22T11:00:00Z", data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveTimestamp(payload)).toBe("2026-02-22T11:00:00Z")
  })

  it("falls back to created_at when createdAt is absent", () => {
    const payload = { created_at: "2026-02-21T17:18:25.835258-08:00", data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveTimestamp(payload)).toBe("2026-02-21T17:18:25.835258-08:00")
  })

  it("returns null when neither field exists", () => {
    const payload = { data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveTimestamp(payload)).toBeNull()
  })
})

describe("resolveRunId", () => {
  it("returns runId when present", () => {
    const payload = { runId: "agent:main:discord:channel:123", data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveRunId(payload)).toBe("agent:main:discord:channel:123")
  })

  it("returns null when runId is absent", () => {
    const payload = { data: "test", hash: "abc" } as RawQdrantPayload
    expect(resolveRunId(payload)).toBeNull()
  })
})

describe("formatRunLabel", () => {
  it("formats discord channel with last 4 chars", () => {
    expect(formatRunLabel("agent:main:discord:channel:1474854736590278929")).toBe("discord #8929")
  })

  it("formats discord thread", () => {
    expect(formatRunLabel("agent:main:discord:thread:12345")).toBe("discord thread")
  })

  it("formats cron", () => {
    expect(formatRunLabel("agent:main:cron:550e8400-e29b-41d4-a716-446655440000")).toBe("cron")
  })

  it("formats telegram", () => {
    expect(formatRunLabel("agent:main:telegram:chat:789")).toBe("telegram")
  })

  it("formats sub-agent", () => {
    expect(formatRunLabel("agent:sub:research")).toBe("sub-agent")
  })

  it("returns dash for null", () => {
    expect(formatRunLabel(null)).toBe("—")
  })

  it("returns dash for unknown patterns", () => {
    expect(formatRunLabel("something:else")).toBe("—")
  })
})

describe("toMemory", () => {
  it("converts new schema payload to Memory", () => {
    const payload: RawQdrantPayload = {
      userId: "clawd",
      createdAt: "2026-02-22T11:51:46.670Z",
      runId: "agent:main:discord:channel:1474854736590278929",
      data: "User diagnosed the issue.",
      hash: "b30d89fc3a48c2a76a",
    }
    const memory = toMemory("00b89546-0122-49ea-8741-c1e32082e5cd", payload)
    expect(memory).toEqual({
      id: "00b89546-0122-49ea-8741-c1e32082e5cd",
      agent: "clawd",
      data: "User diagnosed the issue.",
      createdAt: "2026-02-22T11:51:46.670Z",
      runId: "agent:main:discord:channel:1474854736590278929",
      runLabel: "discord #8929",
      hash: "b30d89fc3a48c2a76a",
    })
  })

  it("converts old schema payload to Memory", () => {
    const payload: RawQdrantPayload = {
      user_id: "ana",
      created_at: "2026-02-21T17:18:25.835258-08:00",
      data: "Contatos para o projeto.",
      hash: "4efe94994e49623ae9e4",
    }
    const memory = toMemory("00fd14fb-70e9-4f1d-a39b-6c163567621b", payload)
    expect(memory).toEqual({
      id: "00fd14fb-70e9-4f1d-a39b-6c163567621b",
      agent: "ana",
      data: "Contatos para o projeto.",
      createdAt: "2026-02-21T17:18:25.835258-08:00",
      runId: null,
      runLabel: "—",
      hash: "4efe94994e49623ae9e4",
    })
  })
})

describe("agentFilter", () => {
  it("creates dual-field should filter", () => {
    expect(agentFilter("clawd")).toEqual({
      should: [
        { key: "userId", match: { value: "clawd" } },
        { key: "user_id", match: { value: "clawd" } },
      ],
    })
  })
})
