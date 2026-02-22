"use client"

import type { StatsResponse } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface StatsHeaderProps {
  stats: StatsResponse | null
  loading: boolean
}

const agentColors: Record<string, string> = {
  clawd: "text-blue-400",
  ana: "text-green-400",
  norma: "text-orange-400",
}

function StatCard({
  label,
  count,
  colorClass,
}: {
  label: string
  count: number
  colorClass?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium capitalize ${colorClass ?? "text-muted-foreground"}`}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${colorClass ?? ""}`}>{count.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">memories</p>
      </CardContent>
    </Card>
  )
}

export default function StatsHeader({ stats, loading }: StatsHeaderProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="stats-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats || !stats.agents) return null

  const agents = Object.entries(stats.agents)

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard label="Total" count={stats.total} />
      {agents.map(([agent, count]) => (
        <StatCard
          key={agent}
          label={agent}
          count={count}
          colorClass={agentColors[agent] ?? "text-gray-400"}
        />
      ))}
    </div>
  )
}
