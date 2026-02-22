import { NextResponse } from "next/server"
import type { PerformanceStats } from "@/types/memory"

export const dynamic = "force-dynamic"

function formatUptime(startupIso: string): string {
  const start = new Date(startupIso).getTime()
  const now = Date.now()
  let diffMs = now - start

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  diffMs -= days * 24 * 60 * 60 * 1000
  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  diffMs -= hours * 60 * 60 * 1000
  const minutes = Math.floor(diffMs / (60 * 1000))

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`)
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`)
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`)

  return parts.length > 0 ? parts.join(", ") : "just started"
}

interface StatusEntry {
  count: number
  avg_duration_micros: number
}

type ResponseMap = Record<string, Record<string, StatusEntry>>

function getEntry(responses: ResponseMap, path: string, status: string): StatusEntry {
  return responses?.[path]?.[status] ?? { count: 0, avg_duration_micros: 0 }
}

function parsePrometheusMetrics(text: string): { total: number; perCollection: Record<string, number> } {
  let total = 0
  const perCollection: Record<string, number> = {}

  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.startsWith("#") || trimmed.length === 0) continue

    const totalMatch = trimmed.match(/^collections_vector_total\s+(\d+)/)
    if (totalMatch) {
      total = parseInt(totalMatch[1], 10)
      continue
    }

    const collMatch = trimmed.match(/^collection_vectors\{collection="([^"]+)"\}\s+(\d+)/)
    if (collMatch) {
      perCollection[collMatch[1]] = parseInt(collMatch[2], 10)
    }
  }

  return { total, perCollection }
}

export async function GET() {
  const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333"

  let telemetryData: Record<string, unknown> | null = null
  let metricsText: string | null = null

  try {
    const telemetryRes = await fetch(`${qdrantUrl}/telemetry`, { cache: "no-store" })
    if (!telemetryRes.ok) throw new Error(`Telemetry returned ${telemetryRes.status}`)
    telemetryData = await telemetryRes.json()
  } catch (error) {
    console.error("Failed to fetch Qdrant telemetry:", error)
    return NextResponse.json({ error: "Failed to fetch Qdrant telemetry" }, { status: 500 })
  }

  try {
    const metricsRes = await fetch(`${qdrantUrl}/metrics`, { cache: "no-store" })
    if (!metricsRes.ok) throw new Error(`Metrics returned ${metricsRes.status}`)
    metricsText = await metricsRes.text()
  } catch (error) {
    console.error("Failed to fetch Qdrant metrics (continuing with partial data):", error)
  }

  const result = (telemetryData as Record<string, unknown>)?.result as Record<string, unknown> | undefined
  const app = result?.app as Record<string, string> | undefined
  const responses = (
    (result?.requests as Record<string, unknown>)?.rest as Record<string, unknown>
  )?.responses as ResponseMap ?? {}

  const version = app?.version ?? "unknown"
  const startup = app?.startup ?? new Date().toISOString()

  // Search stats: combine search + query endpoints
  const search200 = getEntry(responses, "POST /collections/{name}/points/search", "200")
  const search500 = getEntry(responses, "POST /collections/{name}/points/search", "500")
  const query200 = getEntry(responses, "POST /collections/{name}/points/query", "200")

  const searchSuccessTotal = search200.count + query200.count
  const searchErrorTotal = search500.count
  const searchTotalAll = searchSuccessTotal + searchErrorTotal

  // Weighted average latency for search
  let searchAvgLatencyMs = 0
  if (searchSuccessTotal > 0) {
    const totalMicros = search200.count * search200.avg_duration_micros + query200.count * query200.avg_duration_micros
    searchAvgLatencyMs = Math.round((totalMicros / searchSuccessTotal) / 1000)
  }

  const successRate = searchTotalAll > 0
    ? Math.round((searchSuccessTotal / searchTotalAll) * 10000) / 100
    : 100

  // Write stats
  const write200 = getEntry(responses, "PUT /collections/{name}/points", "200")
  const delete200 = getEntry(responses, "POST /collections/{name}/points/delete", "200")
  const payload200 = getEntry(responses, "POST /collections/{name}/points/payload", "200")

  const writeAvgLatencyMs = write200.count > 0
    ? Math.round(write200.avg_duration_micros / 1000)
    : 0

  // Vector stats from Prometheus
  const vectorStats = metricsText
    ? parsePrometheusMetrics(metricsText)
    : { total: 0, perCollection: {} }

  const stats: PerformanceStats = {
    qdrant: {
      version,
      uptime_since: startup,
      uptime_human: formatUptime(startup),
    },
    search: {
      total_calls: searchSuccessTotal,
      avg_latency_ms: searchAvgLatencyMs,
      success_rate: successRate,
      errors: searchErrorTotal,
    },
    writes: {
      total_calls: write200.count,
      avg_latency_ms: writeAvgLatencyMs,
      deletes: delete200.count,
      payload_updates: payload200.count,
    },
    vectors: {
      total: vectorStats.total,
      per_collection: vectorStats.perCollection,
    },
  }

  return NextResponse.json(stats)
}
