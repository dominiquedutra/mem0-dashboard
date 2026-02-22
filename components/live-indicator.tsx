"use client"

import { formatDistanceToNow } from "date-fns"

interface LiveIndicatorProps {
  lastUpdated: Date | null
  onRefresh: () => void
}

export default function LiveIndicator({
  lastUpdated,
  onRefresh,
}: LiveIndicatorProps) {
  return (
    <button
      onClick={onRefresh}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      title="Click to refresh"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      <span className="font-medium text-green-400">Live</span>
      {lastUpdated && (
        <span>
          Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </span>
      )}
    </button>
  )
}
