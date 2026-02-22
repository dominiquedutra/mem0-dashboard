"use client"

import { useEffect, useState } from "react"
import type { Mem0Health } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const agentColorMap: Record<string, string> = {
  clawd: "#3b82f6",
  ana: "#22c55e",
  norma: "#f97316",
  unknown: "#6b7280",
}

const agentTextColor: Record<string, string> = {
  clawd: "text-blue-400",
  ana: "text-green-400",
  norma: "text-orange-400",
  unknown: "text-gray-400",
}

export default function Mem0HealthView({
  refreshInterval = 60000,
}: {
  refreshInterval?: number
}) {
  const [health, setHealth] = useState<Mem0Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/mem0-health")
        if (!res.ok) throw new Error("Failed to fetch mem0 health")
        const data: Mem0Health = await res.json()
        setHealth(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
    const timer = setInterval(fetchHealth, refreshInterval)
    return () => clearInterval(timer)
  }, [refreshInterval])

  if (loading) {
    return (
      <div className="space-y-4" data-testid="health-skeleton">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full mb-2" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full mb-2" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !health) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>{error ?? "Unable to load mem0 health metrics"}</p>
          <p className="text-xs mt-1">Make sure Qdrant is reachable</p>
        </CardContent>
      </Card>
    )
  }

  const maxSourceCount =
    health.top_sources.length > 0
      ? Math.max(...health.top_sources.map((s) => s.count))
      : 1

  const trendArrow =
    health.velocity.trend === "up"
      ? "\u2191"
      : health.velocity.trend === "down"
        ? "\u2193"
        : "\u2192"

  const trendColor =
    health.velocity.trend === "up"
      ? "text-green-400"
      : health.velocity.trend === "down"
        ? "text-red-400"
        : "text-muted-foreground"

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">mem0 Health</h2>

      {/* Top row: Dedup, Velocity, Batch Size */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deduplication Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dedup Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(health.deduplication.dedup_rate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {health.deduplication.saved_embeddings.toLocaleString()} embeddings
              saved
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {health.deduplication.stored_memories.toLocaleString()} stored /{" "}
              {health.deduplication.attempted_writes.toLocaleString()} attempted
            </p>
          </CardContent>
        </Card>

        {/* Velocity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {health.velocity.today}
              </span>
              <span className="text-sm text-muted-foreground">today</span>
              <span className={`text-lg font-bold ${trendColor}`}>
                {trendArrow}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {health.velocity.yesterday} yesterday &middot;{" "}
              {health.velocity.last_7d} last 7d
            </p>
          </CardContent>
        </Card>

        {/* Batch Size */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Batch Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.batch_size.avg_facts_per_batch}
            </div>
            <p className="text-xs text-muted-foreground">
              avg facts per batch
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Top Sources + Memory Density */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health.top_sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-2">
                {health.top_sources.map((source) => (
                  <div key={source.run_id} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate text-muted-foreground">
                      {source.label}
                    </span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{
                          width: `${(source.count / maxSourceCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right">
                      {source.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Memory Density */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Memory Density
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health.memory_density.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-3">
                {health.memory_density.map((entry) => (
                  <div key={entry.agent} className="flex items-center gap-3">
                    <span
                      className={`text-sm font-medium capitalize w-16 ${agentTextColor[entry.agent] ?? "text-gray-400"}`}
                    >
                      {entry.agent}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 rounded"
                          style={{
                            width: `${Math.min(entry.avg_chars / 2, 100)}%`,
                            backgroundColor:
                              agentColorMap[entry.agent] ?? "#6b7280",
                            minWidth: "4px",
                          }}
                        />
                        <span className="text-xs font-mono">
                          {entry.avg_chars} chars
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {entry.count} memories
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
