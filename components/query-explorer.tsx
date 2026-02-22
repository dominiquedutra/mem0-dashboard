"use client"

import { useState } from "react"
import { Search, Loader2 } from "lucide-react"
import type { ExploreResponse, ExploreResult } from "@/types/memory"
import { formatDistanceToNow } from "date-fns"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function scoreColor(score: number): string {
  if (score >= 0.7) return "bg-green-500/20 text-green-400 border-green-500/30"
  if (score >= 0.4) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
  return "bg-red-500/20 text-red-400 border-red-500/30"
}

function ResultItem({ result }: { result: ExploreResult }) {
  const pct = Math.round(result.score * 100)
  return (
    <div className="flex flex-col gap-1 p-3 rounded-md border border-border">
      <div className="flex items-center gap-2">
        <Badge className={scoreColor(result.score)}>{pct}%</Badge>
        <span className="text-sm flex-1">{result.data}</span>
      </div>
      {result.createdAt && (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(result.createdAt), {
            addSuffix: true,
          })}
        </span>
      )}
    </div>
  )
}

export default function QueryExplorer() {
  const [query, setQuery] = useState("")
  const [agent, setAgent] = useState("")
  const [topK, setTopK] = useState("5")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ExploreResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExplore = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
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
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Query Explorer</CardTitle>
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
            <option value="">All</option>
            <option value="clawd">clawd</option>
            <option value="ana">ana</option>
            <option value="norma">norma</option>
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
          </Select>
          <Button onClick={handleExplore} disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Explore
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {results && (
          <div className="space-y-2">
            {results.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No results found.
              </p>
            ) : (
              results.results.map((result) => (
                <ResultItem key={result.id} result={result} />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
