const KNOWN_COLORS: Record<string, string> = {
  clawd: "#3b82f6",
  ana: "#22c55e",
  norma: "#f97316",
}

const KNOWN_TAILWIND: Record<string, string> = {
  clawd: "text-blue-400",
  ana: "text-green-400",
  norma: "text-orange-400",
}

const PALETTE = ["#a855f7", "#ec4899", "#14b8a6", "#eab308", "#ef4444", "#06b6d4"]

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

export function getAgentColor(agent: string): string {
  if (KNOWN_COLORS[agent]) return KNOWN_COLORS[agent]
  if (agent === "unknown") return "#6b7280"
  return PALETTE[Math.abs(hashCode(agent)) % PALETTE.length]
}

/**
 * Returns a Tailwind text color class for known agents.
 * Unknown/dynamic agents get gray since Tailwind can't use arbitrary hex at runtime.
 */
export function getAgentTailwindClass(agent: string): string {
  return KNOWN_TAILWIND[agent] ?? "text-gray-400"
}

const KNOWN_TAB_CLASSES: Record<string, string> = {
  clawd: "data-[active=true]:text-blue-400 data-[active=true]:border-blue-400",
  ana: "data-[active=true]:text-green-400 data-[active=true]:border-green-400",
  norma: "data-[active=true]:text-orange-400 data-[active=true]:border-orange-400",
}

/**
 * Returns Tailwind data-attribute classes for agent tab styling.
 * Unknown/dynamic agents get gray.
 */
export function getAgentTabClasses(agent: string): string {
  return KNOWN_TAB_CLASSES[agent] ?? "data-[active=true]:text-gray-400 data-[active=true]:border-gray-400"
}
