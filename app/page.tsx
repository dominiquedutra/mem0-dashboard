"use client"

import { useEffect, useState, useCallback } from "react"
import type { StatsResponse } from "@/types/memory"
import StatsHeader from "@/components/stats-header"
import AgentTabs from "@/components/agent-tabs"
import MemoryList from "@/components/memory-list"
import ActivityFeed from "@/components/activity-feed"
import QueryExplorer from "@/components/query-explorer"
import LiveIndicator from "@/components/live-indicator"
import PerformanceStatsView from "@/components/performance-stats"
import { Brain } from "lucide-react"

type View = "memories" | "performance"

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeView, setActiveView] = useState<View>("memories")
  const [agents, setAgents] = useState<string[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats")
      const data: StatsResponse = await res.json()
      setStats(data)
      setLastUpdated(new Date())
    } catch {
      // Keep existing stats on error
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents")
      const data = await res.json()
      setAgents(data.agents ?? [])
    } catch {
      // Fallback handled by stats agents
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchAgents()

    const interval = setInterval(() => {
      fetchStats()
    }, 60000)

    return () => clearInterval(interval)
  }, [fetchStats, fetchAgents])

  const handleRefresh = () => {
    setStatsLoading(true)
    fetchStats()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Mem0 Dashboard</h1>
            </div>
            <LiveIndicator lastUpdated={lastUpdated} onRefresh={handleRefresh} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <StatsHeader stats={stats} loading={statsLoading} />

        {/* View Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeView === "memories"
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
            onClick={() => setActiveView("memories")}
          >
            Memories
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeView === "performance"
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
            onClick={() => setActiveView("performance")}
          >
            Performance
          </button>
        </div>

        {activeView === "memories" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              <AgentTabs
                agents={agents}
                counts={stats?.agents ?? {}}
                selected={selectedAgent}
                onSelect={setSelectedAgent}
              />
              <MemoryList agent={selectedAgent} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <ActivityFeed />
              <QueryExplorer />
            </div>
          </div>
        ) : (
          <PerformanceStatsView />
        )}
      </main>
    </div>
  )
}
