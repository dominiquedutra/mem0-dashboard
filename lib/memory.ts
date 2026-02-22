import type { RawQdrantPayload, Memory } from "@/types/memory"
import { getQdrantClient, getCollection } from "@/lib/qdrant"

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

export async function discoverAgents(): Promise<string[]> {
  const agentsEnv = process.env.AGENTS
  if (agentsEnv && agentsEnv.trim().length > 0) {
    return agentsEnv.split(",").map((a) => a.trim()).filter(Boolean)
  }

  const client = getQdrantClient()
  const collection = getCollection()

  const agentSet = new Set<string>()
  let nextOffset: string | number | undefined = undefined
  let fetched = 0
  const maxFetch = 500

  do {
    const batch = await client.scroll(collection, {
      limit: 100,
      offset: nextOffset,
      with_payload: true,
      with_vector: false,
    })

    for (const point of batch.points) {
      const agent = resolveAgent(point.payload as unknown as RawQdrantPayload)
      if (agent !== "unknown") {
        agentSet.add(agent)
      }
      fetched++
    }

    nextOffset = (batch.next_page_offset as string | number | undefined) ?? undefined
  } while (nextOffset !== undefined && fetched < maxFetch)

  return Array.from(agentSet).sort()
}
