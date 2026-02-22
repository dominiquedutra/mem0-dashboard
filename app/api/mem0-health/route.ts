import { NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { resolveAgent, resolveTimestamp, formatRunLabel } from "@/lib/memory"
import type { RawQdrantPayload, Mem0Health } from "@/types/memory"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const client = getQdrantClient()
    const collection = getCollection()
    const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333"

    // --- Fetch data in parallel ---
    const [telemetryRes, collectionInfo, allPoints] = await Promise.all([
      fetchTelemetry(qdrantUrl),
      client.getCollection(collection),
      scrollAll(client, collection),
    ])

    // --- Deduplication ---
    const attempted_writes = telemetryRes
    const stored_memories = collectionInfo.points_count ?? 0
    const dedup_rate =
      attempted_writes === 0 ? 0 : 1 - stored_memories / attempted_writes
    const saved_embeddings = attempted_writes - stored_memories

    // --- Velocity ---
    const now = new Date()
    const todayStr = toDateString(now)
    const yesterdayStr = toDateString(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
    )
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const dateCounts = new Map<string, number>()
    const sourceCounts = new Map<string, number>()
    const agentChars = new Map<string, { total: number; count: number }>()
    const uniqueSeconds = new Set<string>()

    for (const point of allPoints) {
      const payload = point.payload
      const ts = resolveTimestamp(payload)
      const agent = resolveAgent(payload)
      const runId = payload.runId ?? null

      // Velocity: group by date
      if (ts) {
        const dateStr = toDateString(new Date(ts))
        dateCounts.set(dateStr, (dateCounts.get(dateStr) ?? 0) + 1)

        // Batch size: unique seconds
        const secondStr = ts.slice(0, 19) // YYYY-MM-DDTHH:MM:SS
        uniqueSeconds.add(secondStr)
      }

      // Top sources: group by runId
      const sourceKey = runId ?? "__null__"
      sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1)

      // Memory density: per agent
      const dataLen = (payload.data ?? "").length
      const entry = agentChars.get(agent) ?? { total: 0, count: 0 }
      entry.total += dataLen
      entry.count += 1
      agentChars.set(agent, entry)
    }

    const todayCount = dateCounts.get(todayStr) ?? 0
    const yesterdayCount = dateCounts.get(yesterdayStr) ?? 0

    let last7d = 0
    dateCounts.forEach((count, dateStr) => {
      if (new Date(dateStr) >= sevenDaysAgo) {
        last7d += count
      }
    })

    const trend: "up" | "down" | "stable" =
      todayCount > yesterdayCount
        ? "up"
        : todayCount < yesterdayCount
          ? "down"
          : "stable"

    // --- Batch Size ---
    const avg_facts_per_batch =
      uniqueSeconds.size === 0
        ? 0
        : Math.round(stored_memories / uniqueSeconds.size)

    // --- Top Sources ---
    const top_sources = Array.from(sourceCounts.entries())
      .map(([key, count]) => {
        const runId = key === "__null__" ? null : key
        const rawLabel = formatRunLabel(runId)
        const label = rawLabel === "—" && runId === null ? "seed/unknown" : rawLabel
        return { run_id: runId ?? "null", label, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // --- Memory Density ---
    const memory_density = Array.from(agentChars.entries())
      .map(([agent, { total, count }]) => ({
        agent,
        avg_chars: Math.round(total / count),
        count,
      }))
      .sort((a, b) => b.count - a.count)

    const health: Mem0Health = {
      deduplication: {
        attempted_writes,
        stored_memories,
        dedup_rate,
        saved_embeddings,
      },
      velocity: {
        today: todayCount,
        yesterday: yesterdayCount,
        last_7d: last7d,
        trend,
      },
      batch_size: {
        avg_facts_per_batch,
      },
      top_sources,
      memory_density,
    }

    return NextResponse.json(health)
  } catch (error) {
    console.error("Failed to fetch mem0 health:", error)
    return NextResponse.json(
      { error: "Failed to fetch mem0 health metrics" },
      { status: 500 },
    )
  }
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function fetchTelemetry(qdrantUrl: string): Promise<number> {
  const res = await fetch(`${qdrantUrl}/telemetry`)
  const data = await res.json()
  return (
    data?.result?.requests?.rest?.responses?.PUT?.["200"] ?? 0
  )
}

async function scrollAll(
  client: ReturnType<typeof getQdrantClient>,
  collection: string,
): Promise<Array<{ id: string; payload: RawQdrantPayload }>> {
  const allPoints: { id: string; payload: RawQdrantPayload }[] = []
  let nextOffset: string | number | undefined = undefined
  const batchSize = 100

  do {
    const batch = await client.scroll(collection, {
      limit: batchSize,
      offset: nextOffset,
      with_payload: true,
      with_vector: false,
    })

    for (const point of batch.points) {
      allPoints.push({
        id: typeof point.id === "string" ? point.id : String(point.id),
        payload: point.payload as unknown as RawQdrantPayload,
      })
    }

    nextOffset =
      (batch.next_page_offset as string | number | undefined) ?? undefined
  } while (nextOffset !== undefined)

  return allPoints
}
