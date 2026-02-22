"use client"

import type { StatsResponse } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAgentTailwindClass } from "@/lib/colors"

interface StatsHeaderProps {
  stats: StatsResponse | null
  loading: boolean
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

  // Sort agents by count descending
  const sorted = Object.entries(stats.agents).sort(([, a], [, b]) => b - a)

  // Always 4 cards: Total + 3 agent slots
  // If <=3 agents, show them all. If >3, show top 2 + "Others" (rest combined).
  let displayCards: Array<{ label: string; count: number; colorClass: string }>

  if (sorted.length <= 3) {
    displayCards = sorted.map(([agent, count]) => ({
      label: agent,
      count,
      colorClass: getAgentTailwindClass(agent),
    }))
  } else {
    const top2 = sorted.slice(0, 2)
    const rest = sorted.slice(2)
    const othersCount = rest.reduce((sum, [, count]) => sum + count, 0)

    displayCards = [
      ...top2.map(([agent, count]) => ({
        label: agent,
        count,
        colorClass: getAgentTailwindClass(agent),
      })),
      { label: "Others", count: othersCount, colorClass: "text-gray-400" },
    ]
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard label="Total" count={stats.total} />
      {displayCards.map(({ label, count, colorClass }) => (
        <StatCard
          key={label}
          label={label}
          count={count}
          colorClass={colorClass}
        />
      ))}
    </div>
  )
}
