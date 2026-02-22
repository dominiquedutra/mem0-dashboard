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
import SettingsView from "@/components/settings-view"
import { Brain } from "lucide-react"

type View = "memories" | "performance" | "settings" | "explorer"

const VALID_VIEWS: View[] = ["memories", "performance", "settings", "explorer"]

function parseHash(): { view: View; agent: string | null } {
  if (typeof window === "undefined") return { view: "memories", agent: null }
  const hash = window.location.hash.replace("#", "")
  const [viewPart, queryPart] = hash.split("?")
  const view = VALID_VIEWS.includes(viewPart as View) ? (viewPart as View) : "memories"
  let agent: string | null = null
  if (queryPart) {
    const params = new URLSearchParams(queryPart)
    agent = params.get("agent") || null
  }
  return { view, agent }
}

function updateHash(view: View, agent: string | null) {
  let hash = `#${view}`
  if (agent) hash += `?agent=${encodeURIComponent(agent)}`
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", hash)
  }
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(() => parseHash().agent)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeView, setActiveView] = useState<View>(() => parseHash().view)
  const [agents, setAgents] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [hashReady, setHashReady] = useState(false)

  // Mark ready after first render so sync effect doesn't clobber initial hash
  useEffect(() => {
    setHashReady(true)
  }, [])

  // Sync hash on view/agent change (skip initial render)
  useEffect(() => {
    if (hashReady) {
      updateHash(activeView, selectedAgent)
    }
  }, [activeView, selectedAgent, hashReady])

  // Listen for browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const { view, agent } = parseHash()
      setActiveView(view)
      if (agent !== undefined) setSelectedAgent(agent)
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

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

  // Initial fetch
  useEffect(() => {
    fetchStats()
    fetchAgents()
  }, [fetchStats, fetchAgents])

  // Single centralized auto-refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Re-fetch stats whenever refreshKey changes (skip initial mount)
  useEffect(() => {
    if (refreshKey > 0) {
      fetchStats()
      fetchAgents()
    }
  }, [refreshKey, fetchStats, fetchAgents])

  const handleRefresh = () => {
    setStatsLoading(true)
    setRefreshKey((k) => k + 1)
  }

  const viewTabs: { key: View; label: string }[] = [
    { key: "memories", label: "Memories" },
    { key: "explorer", label: "Explorer" },
    { key: "performance", label: "Performance" },
    { key: "settings", label: "Settings" },
  ]

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
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === tab.key
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
              onClick={() => setActiveView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeView === "memories" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              <AgentTabs
                agents={agents}
                counts={stats?.agents ?? {}}
                selected={selectedAgent}
                onSelect={setSelectedAgent}
              />
              <MemoryList agent={selectedAgent} refreshKey={refreshKey} onRefresh={handleRefresh} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <ActivityFeed refreshKey={refreshKey} />
            </div>
          </div>
        )}

        {activeView === "explorer" && <QueryExplorer agents={agents} />}

        {activeView === "performance" && <PerformanceStatsView refreshKey={refreshKey} onRefresh={handleRefresh} />}

        {activeView === "settings" && <SettingsView refreshKey={refreshKey} onRefresh={handleRefresh} />}
      </main>
    </div>
  )
}
