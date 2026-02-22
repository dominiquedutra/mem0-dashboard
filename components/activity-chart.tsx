"use client"

import { useEffect, useState, useCallback } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import type { TimelineBucket } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const AGENT_COLORS: Record<string, string> = {
  clawd: "#3b82f6",
  ana: "#22c55e",
  norma: "#f97316",
  unknown: "#6b7280",
}

type TimeRange = "24h" | "7d"

interface ActivityChartProps {
  refreshInterval?: number
}

function formatXLabel(time: string, granularity: string): string {
  if (granularity === "hour") {
    // "2026-02-22T11:00" → "11:00"
    const match = time.match(/T(\d{2}:\d{2})/)
    return match ? match[1] : time
  }
  // "2026-02-22" → "Feb 22"
  const date = new Date(time + "T00:00:00Z")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function CustomTooltip({
  active,
  payload,
  label,
  granularity,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  granularity: string
}) {
  if (!active || !payload?.length || !label) return null

  const total = payload.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-zinc-300 mb-1.5">
        {granularity === "hour" ? label : formatXLabel(label, "day")}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-zinc-400">{entry.name}</span>
          </div>
          <span className="font-mono text-zinc-200">{entry.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="mt-1 border-t border-zinc-700 pt-1 flex justify-between text-xs">
          <span className="text-zinc-400">Total</span>
          <span className="font-mono font-medium text-zinc-200">{total}</span>
        </div>
      )}
    </div>
  )
}

export default function ActivityChart({
  refreshInterval = 60000,
}: ActivityChartProps) {
  const [range, setRange] = useState<TimeRange>("7d")
  const [buckets, setBuckets] = useState<TimelineBucket[]>([])
  const [granularity, setGranularity] = useState<string>("day")
  const [agents, setAgents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTimeline = useCallback(async () => {
    try {
      const hours = range === "24h" ? 24 : 168
      const res = await fetch(`/api/timeline?hours=${hours}`)
      if (!res.ok) throw new Error("Failed to fetch timeline")
      const data = await res.json()
      setBuckets(data.buckets ?? [])
      setGranularity(data.granularity ?? "day")

      // Discover agents from bucket data
      const agentSet = new Set<string>()
      for (const bucket of data.buckets ?? []) {
        for (const key of Object.keys(bucket)) {
          if (key !== "time" && key !== "total") agentSet.add(key)
        }
      }
      setAgents(Array.from(agentSet).sort())
    } catch {
      setBuckets([])
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    fetchTimeline()
    const timer = setInterval(fetchTimeline, refreshInterval)
    return () => clearInterval(timer)
  }, [fetchTimeline, refreshInterval])

  // Format data for Recharts — ensure agent keys exist in every bucket
  const chartData = buckets.map((bucket) => {
    const entry: Record<string, number | string> = {
      time: formatXLabel(bucket.time, granularity),
      rawTime: bucket.time,
    }
    for (const agent of agents) {
      entry[agent] = (bucket[agent] as number) ?? 0
    }
    return entry
  })

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-28" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Memory Activity</CardTitle>
          <div className="flex rounded-md border border-zinc-700 overflow-hidden text-xs">
            <button
              onClick={() => setRange("24h")}
              className={`px-3 py-1 transition-colors ${
                range === "24h"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              24h
            </button>
            <button
              onClick={() => setRange("7d")}
              className={`px-3 py-1 transition-colors ${
                range === "7d"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              7d
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
            No memory activity in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
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
              <Tooltip
                content={<CustomTooltip granularity={granularity} />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {agents.map((agent) => (
                <Bar
                  key={agent}
                  dataKey={agent}
                  stackId="memories"
                  fill={AGENT_COLORS[agent] ?? AGENT_COLORS.unknown}
                  radius={
                    agent === agents[agents.length - 1]
                      ? [2, 2, 0, 0]
                      : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        {agents.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-3">
            {agents.map((agent) => (
              <div key={agent} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor:
                      AGENT_COLORS[agent] ?? AGENT_COLORS.unknown,
                  }}
                />
                <span className="text-zinc-400">{agent}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
