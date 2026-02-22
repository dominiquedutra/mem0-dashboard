"use client"

import { useState, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import type { ExploreResponse, ExploreResult } from "@/types/memory"
import { formatDistanceToNow } from "date-fns"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const AGENT_COLORS: Record<string, string> = {
  clawd: "#3b82f6",
  ana: "#22c55e",
  norma: "#f97316",
  unknown: "#6b7280",
}

function scoreColor(score: number): string {
  if (score >= 0.7) return "text-green-400"
  if (score >= 0.4) return "text-yellow-400"
  return "text-red-400"
}

function scoreBarColor(score: number): string {
  if (score >= 0.7) return "bg-green-500"
  if (score >= 0.4) return "bg-yellow-500"
  return "bg-red-500"
}

function ResultItem({ result }: { result: ExploreResult }) {
  const pct = Math.round(result.score * 100)
  const agentColor = AGENT_COLORS[result.agent] ?? AGENT_COLORS.unknown

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              style={{ borderColor: agentColor, color: agentColor }}
            >
              {result.agent}
            </Badge>
            {result.runLabel && result.runLabel !== "—" && (
              <span className="text-xs text-muted-foreground">{result.runLabel}</span>
            )}
          </div>
          <span className={`text-sm font-mono font-bold ${scoreColor(result.score)}`}>
            {pct}%
          </span>
        </div>

        {/* Score bar */}
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${scoreBarColor(result.score)}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-sm leading-relaxed">{result.data}</p>

        {result.createdAt && (
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface QueryExplorerProps {
  agents?: string[]
}

export default function QueryExplorer({ agents = [] }: QueryExplorerProps) {
  const [query, setQuery] = useState("")
  const [agent, setAgent] = useState("")
  const [topK, setTopK] = useState("10")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ExploreResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<string[]>([])

  const handleExplore = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResults(null)

    // Update query history (deduplicate, keep last 5)
    setQueryHistory((prev) => {
      const filtered = prev.filter((h) => h !== q)
      return [q, ...filtered].slice(0, 5)
    })

    // If using a history chip, also update the input
    if (searchQuery) setQuery(q)

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          agent: agent || null,
          topK: Number(topK),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(
          errBody.error ?? `Request failed with status ${res.status}`
        )
      }

      const data: ExploreResponse = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [query, agent, topK])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Query Explorer</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search memories using semantic similarity via OpenAI embeddings
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter a semantic query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleExplore()
                }}
              />
            </div>
            <Select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="w-32"
              aria-label="Agent filter"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
            <Select
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              className="w-20"
              aria-label="Top K results"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </Select>
            <Button onClick={() => handleExplore()} disabled={loading || !query.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Explore
            </Button>
          </div>

          {/* Query History */}
          {queryHistory.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Recent:</span>
              {queryHistory.map((h) => (
                <button
                  key={h}
                  onClick={() => handleExplore(h)}
                  className="px-2 py-0.5 text-xs rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                >
                  {h.length > 40 ? h.slice(0, 40) + "..." : h}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.results.length} result{results.results.length !== 1 ? "s" : ""} for &ldquo;{results.query}&rdquo;
              {results.agent ? ` (${results.agent})` : ""}
            </p>
          </div>

          {results.results.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No results found.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.results.map((result) => (
                <ResultItem key={result.id} result={result} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
