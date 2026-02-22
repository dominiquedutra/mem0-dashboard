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

export interface TimelineBucket {
  time: string
  total: number
  [agent: string]: number | string
}

// --- M1: mem0 Health ---
export interface Mem0Health {
  deduplication: {
    attempted_writes: number
    stored_memories: number
    dedup_rate: number
    saved_embeddings: number
  }
  velocity: {
    today: number
    yesterday: number
    last_7d: number
    trend: "up" | "down" | "stable"
  }
  batch_size: {
    avg_facts_per_batch: number
  }
  top_sources: Array<{
    run_id: string
    label: string
    count: number
  }>
  memory_density: Array<{
    agent: string
    avg_chars: number
    count: number
  }>
}

// --- M2: Storage & Capacity ---
export interface StorageStats {
  disk: {
    estimated_mb: number
    points_count: number
    bytes_per_point_avg: number
  }
  ram: {
    qdrant_rss_mb: number
  }
  growth: {
    last_7d_memories: number
    avg_per_day: number
    estimated_mb_per_day: number
    projected_mb_30d: number
    projected_mb_365d: number
  }
  collection: {
    name: string
    vector_dimensions: number
    distance_metric: string
    status: string
  }
}

// --- M3: Settings ---
export interface DashboardSettings {
  mem0: {
    embedder_model: string
    embedding_dimensions: number
    distance_metric: string
    llm_extractor: string
    min_score: number
    sync_window: string
  }
  qdrant: {
    url: string
    collection: string
    status: string
    version: string
    auth_enabled: boolean
  }
  dashboard: {
    refresh_interval_s: number
    agents: string[]
    page_size: number
    port: number
  }
}

// --- M4: Growth Chart ---
export interface GrowthPoint {
  date: string
  added: number
  cumulative: number
}

export interface GrowthResponse {
  points: GrowthPoint[]
  agents: Record<string, Array<{ date: string; added: number }>>
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
