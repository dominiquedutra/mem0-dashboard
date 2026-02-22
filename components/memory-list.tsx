"use client"

import { useEffect, useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import type { MemoriesResponse } from "@/types/memory"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import MemoryCard from "@/components/memory-card"

interface MemoryListProps {
  agent: string | null
}

const PAGE_SIZE = 20

export default function MemoryList({ agent }: MemoryListProps) {
  const [data, setData] = useState<MemoriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    setOffset(0)
    setSearch("")
  }, [agent])

  useEffect(() => {
    const fetchMemories = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        })
        if (agent) params.set("agent", agent)

        const res = await fetch(`/api/memories?${params}`)
        if (!res.ok) throw new Error("API error")
        const json: MemoriesResponse = await res.json()
        if (!json.memories) throw new Error("Invalid response")
        setData(json)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchMemories()
  }, [agent, offset])

  const filtered = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data.memories
    const term = search.toLowerCase()
    return data.memories.filter((m) =>
      m.data.toLowerCase().includes(term)
    )
  }, [data, search])

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load memories.</p>
        <p className="text-xs mt-1">Check that Qdrant is reachable via QDRANT_URL</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search memories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {data?.total ?? 0} memories
      </p>

      <div className="space-y-3">
        {filtered.map((memory, i) => (
          <motion.div
            key={memory.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <MemoryCard memory={memory} />
          </motion.div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(0)}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Prev
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= (data?.total ?? 0)}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= (data?.total ?? 0)}
              onClick={() => setOffset((totalPages - 1) * PAGE_SIZE)}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
