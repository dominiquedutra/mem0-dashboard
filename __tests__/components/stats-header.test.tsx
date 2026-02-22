import { render, screen } from "@testing-library/react"
import StatsHeader from "@/components/stats-header"
import type { StatsResponse } from "@/types/memory"

const mockStats: StatsResponse = {
  total: 150,
  agents: {
    clawd: 80,
    ana: 45,
    norma: 25,
  },
  collection: "agent_memories",
  lastUpdated: "2025-01-01T00:00:00Z",
}

describe("StatsHeader", () => {
  it("renders skeleton when loading", () => {
    render(<StatsHeader stats={null} loading={true} />)
    expect(screen.getByTestId("stats-skeleton")).toBeInTheDocument()
  })

  it("renders nothing when not loading and no stats", () => {
    const { container } = render(<StatsHeader stats={null} loading={false} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders total count", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)
    expect(screen.getByText("150")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })

  it("renders agent counts", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)
    expect(screen.getByText("80")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("25")).toBeInTheDocument()
    expect(screen.getByText("clawd")).toBeInTheDocument()
    expect(screen.getByText("ana")).toBeInTheDocument()
    expect(screen.getByText("norma")).toBeInTheDocument()
  })

  it("renders 'memories' label for each card", () => {
    render(<StatsHeader stats={mockStats} loading={false} />)
    const memoryLabels = screen.getAllByText("memories")
    expect(memoryLabels).toHaveLength(4) // total + 3 agents
  })
})
