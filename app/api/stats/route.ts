import { NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { agentFilter } from "@/lib/memory"

export async function GET() {
  try {
    const client = getQdrantClient()
    const collection = getCollection()

    const agentsEnv = process.env.AGENTS
    const agents = agentsEnv
      ? agentsEnv.split(",").map((a) => a.trim()).filter(Boolean)
      : ["clawd", "ana", "norma"]

    const agentCounts: Record<string, number> = {}
    let total = 0

    for (const agent of agents) {
      const result = await client.count(collection, {
        filter: agentFilter(agent),
        exact: true,
      })
      agentCounts[agent] = result.count
      total += result.count
    }

    return NextResponse.json({
      total,
      agents: agentCounts,
      collection,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to fetch stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    )
  }
}
