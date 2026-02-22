"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import type { GrowthResponse } from "@/types/memory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAgentColor } from "@/lib/colors"

type TimeRange = "7d" | "30d" | "all"

function formatXLabel(date: string): string {
  const d = new Date(date + "T00:00:00Z")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null

  const total = payload.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-zinc-300 mb-1.5">
        {formatXLabel(label)}
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

export default function GrowthChart({
  refreshKey,
}: {
  refreshKey?: number
}) {
  const [range, setRange] = useState<TimeRange>("30d")
  const [data, setData] = useState<GrowthResponse | null>(null)
  const [agents, setAgents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const daysForRange = (r: TimeRange) => {
    switch (r) {
      case "7d":
        return 7
      case "30d":
        return 30
      case "all":
        return 365
    }
  }

  const fetchGrowth = useCallback(async () => {
    try {
      const days = daysForRange(range)
      const res = await fetch(`/api/growth?days=${days}`)
      if (!res.ok) throw new Error("Failed to fetch growth data")
      const body: GrowthResponse = await res.json()
      setData(body)
      setAgents(Object.keys(body.agents).sort())
    } catch {
      setData(null)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    fetchGrowth()
  }, [fetchGrowth, refreshKey])

  // Build chart data: one row per date with per-agent added counts
  const chartData = data
    ? data.points.map((point) => {
        const entry: Record<string, number | string> = {
          date: point.date,
        }
        for (const agent of agents) {
          const agentDay = data.agents[agent]?.find(
            (d) => d.date === point.date,
          )
          entry[agent] = agentDay?.added ?? 0
        }
        return entry
      })
    : []

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-7 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const hasData = chartData.some((row) =>
    agents.some((a) => (row[a] as number) > 0),
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Memory Growth</CardTitle>
          <div className="flex rounded-md border border-zinc-700 overflow-hidden text-xs">
            {(["7d", "30d", "all"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 transition-colors ${
                  range === r
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {r === "all" ? "All" : r}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
            No memory growth data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={{ stroke: "#27272a" }}
                tickLine={false}
                tickFormatter={formatXLabel}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              {agents.map((agent) => (
                <Area
                  key={agent}
                  type="monotone"
                  dataKey={agent}
                  stackId="memories"
                  stroke={getAgentColor(agent)}
                  fill={getAgentColor(agent)}
                  fillOpacity={0.4}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
        {agents.length > 0 && hasData && (
          <div className="flex items-center justify-center gap-4 mt-3">
            {agents.map((agent) => (
              <div key={agent} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor:
                      getAgentColor(agent),
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
