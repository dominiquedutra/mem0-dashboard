import { NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import type { DashboardSettings } from "@/types/memory"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const client = getQdrantClient()
    const collection = getCollection()
    const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333"

    const collectionInfo = await client.getCollection(collection)

    let version = "unknown"
    try {
      const telemetryRes = await fetch(`${qdrantUrl}/telemetry`)
      if (telemetryRes.ok) {
        const telemetry = await telemetryRes.json()
        version = telemetry?.result?.app?.version ?? "unknown"
      }
    } catch {
      // telemetry fetch failed, keep version as "unknown"
    }

    const agentsEnv = process.env.AGENTS
    const agents = agentsEnv
      ? agentsEnv.split(",").map((a) => a.trim()).filter(Boolean)
      : ["clawd", "ana", "norma"]

    // vectors can be a direct config object or a named map
    const vectors = collectionInfo.config?.params?.vectors as
      | { size?: number; distance?: string }
      | undefined

    const settings: DashboardSettings = {
      mem0: {
        embedder_model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        embedding_dimensions: (vectors && typeof vectors.size === "number") ? vectors.size : 0,
        distance_metric: (vectors && typeof vectors.distance === "string") ? vectors.distance : "unknown",
        min_score: parseFloat(process.env.MIN_SCORE ?? "0.2"),
      },
      qdrant: {
        url: qdrantUrl,
        collection,
        status: collectionInfo.status ?? "unknown",
        version,
        auth_enabled: false,
      },
      dashboard: {
        refresh_interval_s: parseInt(process.env.REFRESH_INTERVAL ?? "60", 10),
        agents,
        page_size: parseInt(process.env.PAGE_SIZE ?? "50", 10),
        port: parseInt(process.env.DASHBOARD_PORT ?? "8765", 10),
      },
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Failed to fetch settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    )
  }
}
