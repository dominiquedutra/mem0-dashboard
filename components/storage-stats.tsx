"use client"

import { useEffect, useState } from "react"
import type { StorageStats } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function StorageStatsView({
  refreshInterval = 60000,
}: {
  refreshInterval?: number
}) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/storage")
        if (!res.ok) throw new Error("Failed to fetch storage stats")
        const data: StorageStats = await res.json()
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
    )
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>{error ?? "Unable to load storage stats"}</p>
          <p className="text-xs mt-1">Make sure Qdrant is reachable</p>
        </CardContent>
      </Card>
    )
  }

  const statusColor =
    stats.collection.status === "green"
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : stats.collection.status === "yellow"
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        : "bg-red-500/20 text-red-400 border-red-500/30"

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Storage &amp; Capacity</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Disk"
          value={`${stats.disk.estimated_mb.toFixed(1)} MB`}
          sub={`${stats.disk.points_count.toLocaleString()} points`}
        />
        <StatCard
          label="RAM"
          value={`${stats.ram.qdrant_rss_mb.toFixed(1)} MB`}
          sub="Qdrant RSS"
        />
        <StatCard
          label="Growth Rate"
          value={`${stats.growth.estimated_mb_per_day.toFixed(3)} MB/day`}
          sub={`${stats.growth.avg_per_day.toFixed(1)} memories/day`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Growth Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">30-day projection</p>
              <p className="text-lg font-semibold">
                {stats.growth.projected_mb_30d.toFixed(1)} MB
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">365-day projection</p>
              <p className="text-lg font-semibold">
                {stats.growth.projected_mb_365d.toFixed(1)} MB
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Based on {stats.growth.last_7d_memories} memories added in the last 7 days
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{stats.collection.name}</span>
          <span>{stats.collection.vector_dimensions}d {stats.collection.distance_metric}</span>
        </div>
        <Badge className={statusColor}>{stats.collection.status}</Badge>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
