import { NextRequest, NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { resolveAgent, resolveTimestamp } from "@/lib/memory"
import type { RawQdrantPayload, TimelineBucket } from "@/types/memory"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const hours = Math.min(Number(searchParams.get("hours")) || 168, 168)
    const granularityParam = searchParams.get("granularity") as
      | "hour"
      | "day"
      | null
    const granularity = granularityParam ?? (hours <= 48 ? "hour" : "day")

    const client = getQdrantClient()
    const collection = getCollection()

    // Scroll all points in batches
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

    // Filter by time window
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Group by time bucket + agent
    const bucketMap = new Map<string, TimelineBucket>()

    for (const point of allPoints) {
      const timestamp = resolveTimestamp(point.payload)
      if (!timestamp) continue

      const date = new Date(timestamp)
      if (date <= cutoff) continue

      const agent = resolveAgent(point.payload)
      const bucketKey =
        granularity === "hour"
          ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:00`
          : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`

      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, { time: bucketKey, total: 0 })
      }

      const bucket = bucketMap.get(bucketKey)!
      bucket.total += 1
      bucket[agent] = ((bucket[agent] as number) || 0) + 1
    }

    // Sort chronologically
    const buckets = Array.from(bucketMap.values()).sort((a, b) =>
      a.time.localeCompare(b.time),
    )

    return NextResponse.json({ hours, granularity, buckets })
  } catch (error) {
    console.error("Failed to fetch timeline data:", error)
    return NextResponse.json(
      { error: "Failed to fetch timeline data" },
      { status: 500 },
    )
  }
}
