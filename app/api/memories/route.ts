import { NextRequest, NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { agentFilter, toMemory } from "@/lib/memory"
import type { RawQdrantPayload, MemoriesResponse } from "@/types/memory"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const agent = searchParams.get("agent") || undefined
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200)
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0)
    const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest"

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

    // Convert to Memory objects
    const memories = allPoints.map((p) => toMemory(p.id, p.payload))

    // Sort by resolved timestamp
    memories.sort((a, b) => {
      const ta = a.createdAt ?? ""
      const tb = b.createdAt ?? ""
      return sort === "newest"
        ? tb.localeCompare(ta)
        : ta.localeCompare(tb)
    })

    // Apply pagination
    const paged = memories.slice(offset, offset + limit)

    const response: MemoriesResponse = {
      total: memories.length,
      offset,
      limit,
      memories: paged,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to fetch memories:", error)
    return NextResponse.json(
      { error: "Failed to fetch memories" },
      { status: 500 },
    )
  }
}
