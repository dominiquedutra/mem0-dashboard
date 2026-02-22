"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Copy, Check } from "lucide-react"
import type { Memory } from "@/types/memory"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface MemoryCardProps {
  memory: Memory
}

const agentBadgeStyles: Record<string, string> = {
  clawd: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ana: "bg-green-500/20 text-green-400 border-green-500/30",
  norma: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
}

export default function MemoryCard({ memory }: MemoryCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(memory.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const badgeStyle =
    agentBadgeStyles[memory.agent] ?? agentBadgeStyles.unknown

  return (
    <Card className="hover:border-muted-foreground/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={badgeStyle}>{memory.agent}</Badge>
            <Badge variant="secondary">{memory.runLabel}</Badge>
          </div>
          {memory.createdAt && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(memory.createdAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-3">{memory.data}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>ID: {memory.id.slice(0, 8)}</span>
          <button
            onClick={handleCopy}
            className="hover:text-foreground transition-colors"
            title="Copy full ID"
            aria-label="Copy memory ID"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
