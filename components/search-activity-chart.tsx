"use client"

import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import type { SearchSnapshot } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SearchActivityChartProps {
  snapshots: SearchSnapshot[]
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-zinc-300 mb-1">{label}</p>
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-zinc-400">Searches</span>
        </div>
        <span className="font-mono text-zinc-200">{payload[0].value}</span>
      </div>
    </div>
  )
}

export default function SearchActivityChart({ snapshots }: SearchActivityChartProps) {
  const chartData = useMemo(() => {
    if (snapshots.length < 2) return []

    return snapshots.slice(1).map((snap, i) => ({
      time: formatTime(snap.time),
      delta: Math.max(0, snap.total - snapshots[i].total),
    }))
  }, [snapshots])

  const cumulativeTotal = snapshots.length > 0 ? snapshots[snapshots.length - 1].total : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Search Activity</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Since Qdrant restart &middot; {cumulativeTotal.toLocaleString()} total searches
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            Collecting data... ({snapshots.length}/2 readings)
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="delta"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
