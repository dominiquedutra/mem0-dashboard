import { NextRequest, NextResponse } from "next/server"
import { getQdrantClient, getCollection } from "@/lib/qdrant"
import { embedQuery } from "@/lib/openai"
import { toMemory, agentFilter } from "@/lib/memory"
import type { RawQdrantPayload, ExploreResult } from "@/types/memory"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Query Explorer requires an OpenAI API key. Set OPENAI_API_KEY in .env" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { query, agent, topK = 10 } = body

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const trimmedQuery = query.trim()
    const embedding = await embedQuery(trimmedQuery)

    const client = getQdrantClient()
    const collection = getCollection()

    const filter = agent && agent !== "all" ? agentFilter(agent) : undefined

    const results = await client.search(collection, {
      vector: embedding,
      limit: Math.min(topK, 50),
      with_payload: true,
      score_threshold: 0.0,
      ...(filter ? { filter } : {}),
    })

    const exploreResults: ExploreResult[] = results.map((r) => {
      const payload = r.payload as unknown as RawQdrantPayload
      const memory = toMemory(String(r.id), payload)
      return { ...memory, score: r.score }
    })

    return NextResponse.json({
      query: trimmedQuery,
      agent: agent || null,
      results: exploreResults,
    })
  } catch (error) {
    console.error("Explore failed:", error)
    return NextResponse.json({ error: "Explore query failed" }, { status: 500 })
  }
}
