export interface RawQdrantPayload {
  userId?: string
  createdAt?: string
  runId?: string
  user_id?: string
  created_at?: string
  data: string
  hash: string
}

export interface Memory {
  id: string
  agent: string
  data: string
  createdAt: string | null
  runId: string | null
  runLabel: string
  hash: string
}

export interface AgentStats {
  [agent: string]: number
}

export interface StatsResponse {
  total: number
  agents: AgentStats
  collection: string
  lastUpdated: string
}

export interface MemoriesResponse {
  total: number
  offset: number
  limit: number
  memories: Memory[]
}

export interface ExploreResult extends Memory {
  score: number
}

export interface ExploreResponse {
  query: string
  agent: string | null
  results: ExploreResult[]
}

export interface PerformanceStats {
  qdrant: {
    version: string
    uptime_since: string
    uptime_human: string
  }
  search: {
    total_calls: number
    avg_latency_ms: number
    success_rate: number
    errors: number
  }
  writes: {
    total_calls: number
    avg_latency_ms: number
    deletes: number
    payload_updates: number
  }
  vectors: {
    total: number
    per_collection: Record<string, number>
  }
}
