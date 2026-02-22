"use client"

import { useEffect, useState } from "react"
import type { PerformanceStats } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ActivityChart from "@/components/activity-chart"

export default function PerformanceStatsView({
  refreshInterval = 60000,
}: {
  refreshInterval?: number
}) {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/performance")
        if (!res.ok) throw new Error("Failed to fetch performance stats")
        const data: PerformanceStats = await res.json()
        setStats(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const timer = setInterval(fetchStats, refreshInterval)
    return () => clearInterval(timer)
  }, [refreshInterval])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
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
    )
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>{error ?? "Unable to load performance stats"}</p>
          <p className="text-xs mt-1">Make sure Qdrant is reachable</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance</h2>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Qdrant v{stats.qdrant.version}</span>
          <span>Uptime: {stats.qdrant.uptime_human}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Searches" value={stats.search.total_calls.toLocaleString()} sub={`avg ${stats.search.avg_latency_ms.toFixed(1)}ms`} />
        <StatCard label="Writes" value={stats.writes.total_calls.toLocaleString()} sub={`avg ${stats.writes.avg_latency_ms.toFixed(1)}ms`} />
        <StatCard label="Success Rate" value={`${(stats.search.success_rate * 100).toFixed(1)}%`} sub={`${stats.search.errors} errors`} />
        <StatCard label="Deletes" value={stats.writes.deletes.toLocaleString()} />
        <StatCard label="Payload Updates" value={stats.writes.payload_updates.toLocaleString()} />
        <StatCard label="Vectors" value={stats.vectors.total.toLocaleString()} />
      </div>

      <ActivityChart refreshInterval={refreshInterval} />

      <p className="text-xs text-muted-foreground">
        Stats since last Qdrant restart ({stats.qdrant.uptime_since ? new Date(stats.qdrant.uptime_since).toLocaleString() : "unknown"})
      </p>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
