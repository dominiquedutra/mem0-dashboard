import { NextRequest, NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { resolveAgent, resolveTimestamp } from "@/lib/memory"
import type { RawQdrantPayload, GrowthResponse } from "@/types/memory"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 1), 365)

    const client = getQdrantClient()
    const collection = getCollection()

    // Scroll all points
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

    // Build date range: from (now - days) to now (inclusive)
    const now = new Date()
    const startDate = new Date(now)
    startDate.setUTCDate(startDate.getUTCDate() - days)
    startDate.setUTCHours(0, 0, 0, 0)

    const endDate = new Date(now)
    endDate.setUTCHours(0, 0, 0, 0)

    // Format a Date as YYYY-MM-DD
    const toDateStr = (d: Date) => d.toISOString().slice(0, 10)

    // Generate all dates in range
    const dateList: string[] = []
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      dateList.push(toDateStr(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const startDateStr = dateList[0]

    // Count memories per date and per agent+date
    const dailyCounts: Record<string, number> = {}
    const agentDailyCounts: Record<string, Record<string, number>> = {}
    let preWindowCount = 0

    for (const point of allPoints) {
      const ts = resolveTimestamp(point.payload)
      if (!ts) continue

      const dateStr = ts.slice(0, 10)
      const agent = resolveAgent(point.payload)

      if (dateStr < startDateStr) {
        // Memory is before the window — contributes to initial cumulative
        preWindowCount++
        continue
      }

      // Within the window
      dailyCounts[dateStr] = (dailyCounts[dateStr] ?? 0) + 1

      if (!agentDailyCounts[agent]) {
        agentDailyCounts[agent] = {}
      }
      agentDailyCounts[agent][dateStr] = (agentDailyCounts[agent][dateStr] ?? 0) + 1
    }

    // Build points array with cumulative
    let cumulative = preWindowCount
    const points = dateList.map((date) => {
      const added = dailyCounts[date] ?? 0
      cumulative += added
      return { date, added, cumulative }
    })

    // Build agents record
    const agents: Record<string, Array<{ date: string; added: number }>> = {}
    for (const [agent, dateCounts] of Object.entries(agentDailyCounts)) {
      agents[agent] = Object.entries(dateCounts)
        .map(([date, added]) => ({ date, added }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    const response: GrowthResponse = { points, agents }
    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to fetch growth data:", error)
    return NextResponse.json(
      { error: "Failed to fetch growth data" },
      { status: 500 },
    )
  }
}
