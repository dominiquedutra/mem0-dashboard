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

// Module-level storage: survives component unmount/remount (tab switches)
let persistedSnapshots: SearchSnapshot[] = []

export function pushSnapshot(snapshot: SearchSnapshot) {
  // Deduplicate: don't add if last snapshot has same total and was < 5s ago
  const last = persistedSnapshots[persistedSnapshots.length - 1]
  if (last && last.total === snapshot.total && snapshot.time - last.time < 5000) {
    return
  }
  persistedSnapshots.push(snapshot)
  // Keep last 60 snapshots (~ 1 hour at 60s interval)
  if (persistedSnapshots.length > 60) {
    persistedSnapshots = persistedSnapshots.slice(-60)
  }
}

export function getSnapshots(): SearchSnapshot[] {
  return persistedSnapshots
}

interface SearchActivityChartProps {
  uptimeSince: string
  totalSearches: number
  totalWrites: number
  snapshots: SearchSnapshot[]
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function computeRate(total: number, uptimeSince: string): { perHour: number; perDay: number } {
  const uptimeMs = Date.now() - new Date(uptimeSince).getTime()
  const uptimeHours = uptimeMs / (1000 * 60 * 60)
  if (uptimeHours <= 0) return { perHour: 0, perDay: 0 }
  const perHour = total / uptimeHours
  return { perHour, perDay: perHour * 24 }
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

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-zinc-300 mb-1">{label}</p>
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
    </div>
  )
}

export default function SearchActivityChart({
  uptimeSince,
  totalSearches,
  totalWrites,
  snapshots,
}: SearchActivityChartProps) {
  const searchRate = computeRate(totalSearches, uptimeSince)
  const writeRate = computeRate(totalWrites, uptimeSince)

  const chartData = useMemo(() => {
    if (snapshots.length < 2) return []

    return snapshots.slice(1).map((snap, i) => {
      const prev = snapshots[i]
      const elapsedMin = (snap.time - prev.time) / (1000 * 60)
      const delta = Math.max(0, snap.total - prev.total)
      // Normalize to per-minute rate for consistent Y axis
      const rate = elapsedMin > 0 ? Math.round(delta / elapsedMin * 10) / 10 : 0
      return {
        time: formatTime(snap.time),
        searches: delta,
        rate,
      }
    })
  }, [snapshots])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Search &amp; Write Rates</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Average rates since Qdrant restart
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rate cards — always visible, computed from uptime */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RateCard
            label="Searches / hour"
            value={searchRate.perHour.toFixed(1)}
          />
          <RateCard
            label="Searches / day"
            value={searchRate.perDay.toFixed(0)}
          />
          <RateCard
            label="Writes / hour"
            value={writeRate.perHour.toFixed(1)}
          />
          <RateCard
            label="Writes / day"
            value={writeRate.perDay.toFixed(0)}
          />
        </div>

        {/* Live delta chart — accumulates over session */}
        {chartData.length > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Live search delta (per refresh interval, {snapshots.length} readings this session)
            </p>
            <ResponsiveContainer width="100%" height={160}>
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
                  name="searches"
                  type="monotone"
                  dataKey="searches"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Live search deltas will appear after 2 refresh cycles ({snapshots.length}/2 readings)
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold font-mono">{value}</p>
    </div>
  )
}
