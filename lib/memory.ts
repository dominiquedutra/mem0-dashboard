import type { RawQdrantPayload, Memory } from "@/types/memory"

export function resolveAgent(payload: RawQdrantPayload): string {
  return payload.userId ?? payload.user_id ?? "unknown"
}

export function resolveTimestamp(payload: RawQdrantPayload): string | null {
  return payload.createdAt ?? payload.created_at ?? null
}

export function resolveRunId(payload: RawQdrantPayload): string | null {
  return payload.runId ?? null
}

export function formatRunLabel(runId: string | null): string {
  if (!runId) return "—"

  if (runId.startsWith("agent:main:discord:channel:")) {
    const id = runId.split(":").pop() ?? ""
    return `discord #${id.slice(-4)}`
  }

  if (runId.startsWith("agent:main:discord:thread:")) {
    return "discord thread"
  }

  if (runId.startsWith("agent:main:cron:")) {
    return "cron"
  }

  if (runId.startsWith("agent:main:telegram:")) {
    return "telegram"
  }

  if (runId.startsWith("agent:sub:")) {
    return "sub-agent"
  }

  return "—"
}

export function toMemory(id: string, payload: RawQdrantPayload): Memory {
  const runId = resolveRunId(payload)
  return {
    id,
    agent: resolveAgent(payload),
    data: payload.data,
    createdAt: resolveTimestamp(payload),
    runId,
    runLabel: formatRunLabel(runId),
    hash: payload.hash,
  }
}

export function agentFilter(agent: string) {
  return {
    should: [
      { key: "userId", match: { value: agent } },
      { key: "user_id", match: { value: agent } },
    ],
  }
}
