import { NextResponse } from "next/server"
import { discoverAgents } from "@/lib/memory"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const agents = await discoverAgents()
    return NextResponse.json({ agents })
  } catch (error) {
    console.error("Failed to fetch agents:", error)
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    )
  }
}
