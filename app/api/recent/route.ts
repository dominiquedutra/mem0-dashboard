import { NextRequest, NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { agentFilter, toMemory } from "@/lib/memory"
import type { RawQdrantPayload } from "@/types/memory"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const hours = Math.min(Number(searchParams.get("hours")) || 24, 168)
    const agent = searchParams.get("agent") || undefined

    const client = getQdrantClient()
    const collection = getCollection()

    const filter = agent ? agentFilter(agent) : undefined

    // Scroll all matching points in batches of 100
    const allPoints: { id: string; payload: RawQdrantPayload }[] = []
    let nextOffset: string | number | undefined = undefined
    const batchSize = 100

    do {
      const batch = await client.scroll(collection, {
        filter,
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

      nextOffset = (batch.next_page_offset as string | number | undefined) ?? undefined
    } while (nextOffset !== undefined)

    // Convert to Memory objects and filter by time window
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const memories = allPoints
      .map((p) => toMemory(p.id, p.payload))
      .filter((m) => {
        if (!m.createdAt) return false
        return new Date(m.createdAt) > cutoff
      })

    // Sort newest first
    memories.sort((a, b) => {
      const ta = a.createdAt ?? ""
      const tb = b.createdAt ?? ""
      return tb.localeCompare(ta)
    })

    // Return up to 50
    return NextResponse.json({
      hours,
      cutoff: cutoff.toISOString(),
      total: memories.length,
      memories: memories.slice(0, 50),
    })
  } catch (error) {
    console.error("Failed to fetch recent memories:", error)
    return NextResponse.json(
      { error: "Failed to fetch recent memories" },
      { status: 500 },
    )
  }
}
