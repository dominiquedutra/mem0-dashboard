"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import type { Memory } from "@/types/memory"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ActivityFeedProps {
  refreshKey?: number
}

const agentBadgeStyles: Record<string, string> = {
  clawd: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ana: "bg-green-500/20 text-green-400 border-green-500/30",
  norma: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
}

export default function ActivityFeed({
  refreshKey,
}: ActivityFeedProps) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch("/api/recent?hours=24")
        const json = await res.json()
        setMemories(json.memories ?? [])
      } catch {
        setMemories([])
      } finally {
        setLoading(false)
      }
    }

    fetchRecent()
  }, [refreshKey])

  const items = memories.slice(0, 10)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent activity in the last 24 hours.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((memory) => (
              <div
                key={memory.id}
                className="flex items-center gap-3 text-sm"
              >
                <Badge
                  className={
                    agentBadgeStyles[memory.agent] ??
                    agentBadgeStyles.unknown
                  }
                >
                  {memory.agent}
                </Badge>
                <span className="flex-1 truncate text-muted-foreground">
                  {memory.data.length > 60
                    ? memory.data.slice(0, 60) + "..."
                    : memory.data}
                </span>
                {memory.createdAt && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(memory.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
