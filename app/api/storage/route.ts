import { NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { resolveTimestamp } from "@/lib/memory"
import type { RawQdrantPayload, StorageStats } from "@/types/memory"

export const dynamic = "force-dynamic"

const BYTES_PER_POINT_AVG = 18500

function parseRssMb(metricsText: string): number {
  for (const line of metricsText.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("#") || trimmed.length === 0) continue
    const match = trimmed.match(/^process_resident_memory_bytes\s+(\d+(?:\.\d+)?)/)
    if (match) {
      return parseFloat(match[1]) / (1024 * 1024)
    }
  }
  return 0
}

export async function GET() {
  const client = getQdrantClient()
  const collection = getCollection()
  const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333"

  try {
    // 1. Collection info
    const collectionInfo = await client.getCollection(collection)
    const pointsCount = collectionInfo.points_count ?? 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vectorsConfig = (collectionInfo as any).config?.params?.vectors
    const vectorDimensions: number = vectorsConfig?.size ?? 0
    const distanceMetric: string = vectorsConfig?.distance ?? "unknown"
    const status: string = (collectionInfo as any).status ?? "unknown"

    // 2. RAM from Prometheus /metrics
    let qdrantRssMb = 0
    try {
      const metricsRes = await fetch(`${qdrantUrl}/metrics`, { cache: "no-store" })
      if (metricsRes.ok) {
        const metricsText = await metricsRes.text()
        qdrantRssMb = parseRssMb(metricsText)
      }
    } catch (err) {
      console.error("Failed to fetch Qdrant /metrics:", err)
    }

    // 3. Scroll all points for 7d growth count
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
      nextOffset = (batch.next_page_offset as string | number | undefined) ?? undefined
    } while (nextOffset !== undefined)

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let last7dCount = 0
    for (const point of allPoints) {
      const ts = resolveTimestamp(point.payload)
      if (ts) {
        const tsMs = new Date(ts).getTime()
        if (tsMs >= sevenDaysAgo) {
          last7dCount++
        }
      }
    }

    const avgPerDay = last7dCount / 7
    const estimatedMb = (pointsCount * BYTES_PER_POINT_AVG) / (1024 * 1024)
    const estimatedMbPerDay = (avgPerDay * BYTES_PER_POINT_AVG) / (1024 * 1024)

    const stats: StorageStats = {
      disk: {
        estimated_mb: estimatedMb,
        points_count: pointsCount,
        bytes_per_point_avg: BYTES_PER_POINT_AVG,
      },
      ram: {
        qdrant_rss_mb: qdrantRssMb,
      },
      growth: {
        last_7d_memories: last7dCount,
        avg_per_day: avgPerDay,
        estimated_mb_per_day: estimatedMbPerDay,
        projected_mb_30d: estimatedMb + estimatedMbPerDay * 30,
        projected_mb_365d: estimatedMb + estimatedMbPerDay * 365,
      },
      collection: {
        name: collection,
        vector_dimensions: vectorDimensions,
        distance_metric: distanceMetric,
        status,
      },
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Failed to fetch storage stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch storage stats" },
      { status: 500 }
    )
  }
}
