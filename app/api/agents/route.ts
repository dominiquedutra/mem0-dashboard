import { NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { resolveAgent } from "@/lib/memory"
import type { RawQdrantPayload } from "@/types/memory"

export async function GET() {
  try {
    // If AGENTS env var is set, use it directly
    const agentsEnv = process.env.AGENTS
    if (agentsEnv && agentsEnv.trim().length > 0) {
      const agents = agentsEnv.split(",").map((a) => a.trim()).filter(Boolean)
      return NextResponse.json({ agents })
    }

    // Auto-detect from Qdrant collection
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

    return NextResponse.json({ agents: Array.from(agentSet).sort() })
  } catch (error) {
    console.error("Failed to fetch agents:", error)
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    )
  }
}
