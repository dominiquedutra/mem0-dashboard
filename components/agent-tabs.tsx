"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getAgentTabClasses } from "@/lib/colors"

interface AgentTabsProps {
  agents: string[]
  counts: Record<string, number>
  selected: string | null
  onSelect: (agent: string | null) => void
}

export default function AgentTabs({
  agents,
  counts,
  selected,
  onSelect,
}: AgentTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border" role="tablist">
      <button
        role="tab"
        aria-selected={selected === null}
        data-active={selected === null}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors",
          "hover:text-foreground text-muted-foreground",
          "data-[active=true]:text-foreground data-[active=true]:border-primary"
        )}
        onClick={() => onSelect(null)}
      >
        All
        <Badge variant="secondary" className="ml-2 text-xs">
          {Object.values(counts).reduce((sum, c) => sum + c, 0)}
        </Badge>
      </button>
      {agents.map((agent) => (
        <button
          key={agent}
          role="tab"
          aria-selected={selected === agent}
          data-active={selected === agent}
          className={cn(
            "px-4 py-2 text-sm font-medium capitalize border-b-2 border-transparent transition-colors",
            "hover:text-foreground text-muted-foreground",
            getAgentTabClasses(agent)
          )}
          onClick={() => onSelect(agent)}
        >
          {agent}
          <Badge variant="secondary" className="ml-2 text-xs">
            {counts[agent] ?? 0}
          </Badge>
        </button>
      ))}
    </div>
  )
}
